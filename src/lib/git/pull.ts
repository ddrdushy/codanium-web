// =============================================================================
// Codanium — Git Pull from GitHub (Bidirectional Sync)
// =============================================================================
// Pulls files from a GitHub branch and upserts them as Artifacts in the DB.
// Called by the /git/pull API route and the GitHub webhook receiver.
//
// Flow:
//   1. Load project git config
//   2. Get recursive file tree via Git Data API
//   3. Batch-fetch file contents (respects GitHub rate limits)
//   4. Infer ArtifactType from path/extension
//   5. Upsert artifacts — bump version only when content changes
//   6. Emit event
// =============================================================================

import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/ai/orchestration/event-bus';
import { createGitHubClient } from './github-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PullOptions {
  projectId: string;
  branch?: string;      // defaults to gitDefaultBranch
  triggeredBy?: string; // userId or 'github-webhook'
}

export interface PullResult {
  success: boolean;
  filesUpserted: number;
  filesSkipped: number;
  branch: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Type Inference
// ---------------------------------------------------------------------------

const EXT_TYPE: Record<string, 'CODE' | 'CONFIG' | 'TEST' | 'DOCUMENT'> = {
  // Code
  ts: 'CODE', tsx: 'CODE', js: 'CODE', jsx: 'CODE', mjs: 'CODE', cjs: 'CODE',
  py: 'CODE', go: 'CODE', rs: 'CODE', java: 'CODE', rb: 'CODE', php: 'CODE',
  cs: 'CODE', cpp: 'CODE', c: 'CODE', h: 'CODE', swift: 'CODE', kt: 'CODE',
  vue: 'CODE', svelte: 'CODE', html: 'CODE', css: 'CODE', scss: 'CODE',
  less: 'CODE', sql: 'CODE', sh: 'CODE', bash: 'CODE', graphql: 'CODE',
  // Config
  json: 'CONFIG', yaml: 'CONFIG', yml: 'CONFIG', toml: 'CONFIG',
  env: 'CONFIG', ini: 'CONFIG', cfg: 'CONFIG', conf: 'CONFIG', xml: 'CONFIG',
  lock: 'CONFIG',
  // Documents
  md: 'DOCUMENT', mdx: 'DOCUMENT', txt: 'DOCUMENT', rst: 'DOCUMENT',
};

const ROOT_CONFIG_FILES = new Set([
  'package.json', 'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
  'tsconfig.json', 'tsconfig.node.json', 'next.config.ts', 'next.config.js',
  'vite.config.ts', 'vite.config.js', 'tailwind.config.ts', 'tailwind.config.js',
  'postcss.config.js', 'postcss.config.mjs', '.eslintrc.json', '.eslintrc.js',
  'eslint.config.js', '.prettierrc', 'prettier.config.js', 'Dockerfile',
  'docker-compose.yml', 'docker-compose.yaml', '.dockerignore', '.gitignore',
  '.env.example', 'Makefile', 'Gemfile', 'requirements.txt', 'pyproject.toml',
  'go.mod', 'go.sum', 'cargo.toml', 'cargo.lock', 'pom.xml', 'build.gradle',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.next', '.turbo', 'dist', 'build', 'out',
  'coverage', '__pycache__', '.venv', 'venv', '.nyc_output', '.cache',
]);

/** Max file size to pull (100 KB). Larger files are skipped. */
const MAX_BYTES = 100_000;

function shouldSkip(path: string): boolean {
  const parts = path.split('/');
  return parts.some(p => SKIP_DIRS.has(p) || p.startsWith('.git'));
}

function inferArtifactType(path: string): 'CODE' | 'CONFIG' | 'TEST' | 'DOCUMENT' | 'WIREFRAME' {
  const lowerPath = path.toLowerCase();
  const fileName = path.split('/').pop() ?? path;
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';

  // Path-based rules (highest priority)
  if (
    lowerPath.startsWith('tests/') ||
    lowerPath.startsWith('test/') ||
    lowerPath.includes('__tests__/') ||
    lowerPath.includes('.test.') ||
    lowerPath.includes('.spec.')
  ) return 'TEST';

  if (lowerPath.startsWith('docs/') || lowerPath.startsWith('documentation/')) return 'DOCUMENT';
  if (lowerPath.startsWith('wireframes/')) return 'WIREFRAME';

  // Known root config files
  if (ROOT_CONFIG_FILES.has(fileName)) return 'CONFIG';

  // Dockerfile variants
  if (fileName.toLowerCase().startsWith('dockerfile')) return 'CONFIG';

  return EXT_TYPE[ext] ?? 'CODE';
}

// ---------------------------------------------------------------------------
// Pull Logic
// ---------------------------------------------------------------------------

/** Batch size for parallel file content fetches (stay under GitHub rate limits). */
const BATCH = 8;

export async function pullBranchFiles(options: PullOptions): Promise<PullResult> {
  const { projectId, branch: requestedBranch, triggeredBy = 'system' } = options;

  // ── 1. Load project config ─────────────────────────────────────────────
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      gitTokenEncrypted: true,
      gitRepoOwner: true,
      gitRepoName: true,
      gitDefaultBranch: true,
    },
  });

  if (!project) throw new Error(`Project ${projectId} not found`);
  if (!project.gitTokenEncrypted || !project.gitRepoOwner || !project.gitRepoName) {
    throw new Error('Git integration is not configured');
  }

  const owner       = project.gitRepoOwner;
  const repo        = project.gitRepoName;
  const branch      = requestedBranch ?? project.gitDefaultBranch ?? 'main';
  const client      = createGitHubClient(project.gitTokenEncrypted);

  // ── 2. Resolve branch tip ──────────────────────────────────────────────
  const { data: refData } = await client.rest.git.getRef({
    owner, repo, ref: `heads/${branch}`,
  });
  const commitSha = refData.object.sha;

  // ── 3. Fetch recursive file tree ───────────────────────────────────────
  const { data: treeData } = await client.rest.git.getTree({
    owner, repo, tree_sha: commitSha, recursive: '1',
  });

  const blobs = (treeData.tree ?? []).filter(
    (entry) =>
      entry.type === 'blob' &&
      entry.path &&
      !shouldSkip(entry.path) &&
      (entry.size ?? 0) <= MAX_BYTES,
  );

  if (blobs.length === 0) {
    return { success: true, filesUpserted: 0, filesSkipped: 0, branch };
  }

  // ── 4. Batch-fetch file contents and upsert artifacts ─────────────────
  let upserted = 0;
  let skipped  = 0;

  for (let i = 0; i < blobs.length; i += BATCH) {
    const batch = blobs.slice(i, i + BATCH);

    await Promise.all(batch.map(async (entry) => {
      const filePath = entry.path!;
      try {
        const { data: fileData } = await client.rest.repos.getContent({
          owner, repo, path: filePath, ref: branch,
        });

        if (Array.isArray(fileData) || fileData.type !== 'file') {
          skipped++;
          return;
        }

        // Decode base64 content
        const content     = Buffer.from(fileData.content, 'base64').toString('utf-8');
        const artifactType = inferArtifactType(filePath);
        const fileName    = filePath.split('/').pop() ?? filePath;

        // Find most recent artifact with this name
        const existing = await prisma.artifact.findFirst({
          where: { projectId, name: fileName },
          orderBy: { version: 'desc' },
        });

        if (existing) {
          if (existing.content !== content) {
            await prisma.artifact.update({
              where: { id: existing.id },
              data: { content, version: existing.version + 1 },
            });
            upserted++;
          } else {
            skipped++;
          }
        } else {
          await prisma.artifact.create({
            data: {
              name:       fileName,
              type:       artifactType,
              content,
              ownerAgent: 'github-sync',
              version:    1,
              projectId,
            },
          });
          upserted++;
        }
      } catch {
        // Binary files, permission errors, etc. — skip silently
        skipped++;
      }
    }));
  }

  // ── 5. Update project last-sync timestamp ─────────────────────────────
  await prisma.project.update({
    where: { id: projectId },
    data:  { gitLastSyncAt: new Date() },
  }).catch(() => {/* non-fatal */});

  // ── 6. Emit event ─────────────────────────────────────────────────────
  try {
    await eventBus.emit({
      type:      'git.pull.completed',
      actor:     triggeredBy,
      projectId,
      payload:   { branch, filesUpserted: upserted, filesSkipped: skipped },
    });
  } catch {
    // Non-fatal
  }

  console.log(
    `[GitPull] ${owner}/${repo}:${branch} → ${upserted} upserted, ${skipped} skipped`,
  );

  return { success: true, filesUpserted: upserted, filesSkipped: skipped, branch };
}
