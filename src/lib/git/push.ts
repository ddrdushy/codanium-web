// =============================================================================
// AI Team Studio — Git Push to GitHub
// =============================================================================
// Orchestrates pushing project artifacts to GitHub as a single commit on a
// new branch. Optionally creates a PR. Called by the git-push worker.
//
// Flow:
//   1. Load project git config + all "main tree" artifacts
//   2. Build Git tree entries (file path mapping by artifact type)
//   3. GitHub Git Data API: getRef → createTree → createCommit → createBranchRef
//   4. Optional: createPullRequest
//   5. Sync DB (new branch/PR appears in UI)
//   6. Emit event
// =============================================================================

import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/ai/orchestration/event-bus';
import {
  createGitHubClient,
  getRef,
  getCommitTreeSha,
  createTree,
  createCommit,
  createBranchRef,
  createPullRequest,
  type GitTreeEntry,
  type GitPullRequestResult,
} from './github-client';
import { getMainTree } from './repo-manager';
import { syncProjectGit } from './sync';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PushOptions {
  projectId: string;
  branchName: string;
  commitMessage: string;
  createPR: boolean;
  prTitle?: string;
  triggeredBy: string; // userId
}

export interface PushResult {
  success: boolean;
  branchName: string;
  commitSha: string;
  commitUrl: string;
  filesCount: number;
  pr?: GitPullRequestResult;
  error?: string;
}

// ---------------------------------------------------------------------------
// File Path Mapping
// ---------------------------------------------------------------------------

/** Map artifact types to directory prefixes */
const TYPE_DIR_MAP: Record<string, string> = {
  CODE: 'src',
  CONFIG: '',          // root level (Dockerfile, package.json, etc.)
  TEST: 'tests',
  DOCUMENT: 'docs',
  WIREFRAME: 'wireframes',
};

/** Config file names that should live at root, not in src/ */
const ROOT_FILES = new Set([
  'package.json', 'package-lock.json', 'tsconfig.json', 'tsconfig.node.json',
  'next.config.ts', 'next.config.js', 'next.config.mjs',
  'vite.config.ts', 'vite.config.js',
  'tailwind.config.ts', 'tailwind.config.js',
  'postcss.config.js', 'postcss.config.mjs',
  'eslint.config.js', 'eslint.config.mjs', '.eslintrc.json', '.eslintrc.js',
  'prettier.config.js', '.prettierrc', '.prettierrc.json',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  '.dockerignore', '.gitignore', '.env', '.env.example', '.env.local',
  'README.md', 'LICENSE',
]);

/**
 * Map an artifact to a file path for the GitHub tree.
 * - If name already contains '/', use as-is (explicit path)
 * - If name is a known root file, place at root
 * - Otherwise, prefix with type-based directory
 */
function artifactToPath(name: string, type: string): string {
  // Already has a directory path — use as-is
  if (name.includes('/')) {
    return name.startsWith('/') ? name.slice(1) : name;
  }

  // Known root files (configs, etc.)
  if (ROOT_FILES.has(name) || type === 'CONFIG') {
    return name;
  }

  const dir = TYPE_DIR_MAP[type] ?? 'src';
  return dir ? `${dir}/${name}` : name;
}

// ---------------------------------------------------------------------------
// Push Logic
// ---------------------------------------------------------------------------

export async function pushProjectToGitHub(options: PushOptions): Promise<PushResult> {
  const { projectId, branchName, commitMessage, createPR: shouldCreatePR, prTitle, triggeredBy } = options;

  // ── 1. Load project config ────────────────────────────────────────────
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      name: true,
      gitProvider: true,
      gitRepoOwner: true,
      gitRepoName: true,
      gitDefaultBranch: true,
      gitTokenEncrypted: true,
    },
  });

  if (!project) throw new Error(`Project ${projectId} not found`);
  if (!project.gitTokenEncrypted || !project.gitRepoOwner || !project.gitRepoName) {
    throw new Error('Git integration is not configured');
  }

  const owner = project.gitRepoOwner;
  const repo = project.gitRepoName;
  const baseBranch = project.gitDefaultBranch ?? 'main';
  const client = createGitHubClient(project.gitTokenEncrypted);

  // ── 2. Load main tree (all merged artifacts) ─────────────────────────
  const artifacts = await getMainTree(projectId);

  if (artifacts.length === 0) {
    throw new Error('No artifacts to push. Generate some files first.');
  }

  // Also load documents
  const documents = await prisma.document.findMany({
    where: { projectId },
    select: { title: true, content: true, type: true },
  });

  // ── 3. Build tree entries ─────────────────────────────────────────────
  const treeEntries: GitTreeEntry[] = [];

  // Add artifacts
  for (const artifact of artifacts) {
    const path = artifactToPath(artifact.name, artifact.type);
    treeEntries.push({
      path,
      mode: '100644',
      type: 'blob',
      content: artifact.content,
    });
  }

  // Add documents in docs/
  for (const doc of documents) {
    const safeName = doc.title
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .replace(/\s+/g, '-')
      .toLowerCase();
    treeEntries.push({
      path: `docs/${safeName}.md`,
      mode: '100644',
      type: 'blob',
      content: doc.content,
    });
  }

  // ── 4. Git Data API sequence ──────────────────────────────────────────
  // Step 4a: Get base branch commit SHA
  const baseCommitSha = await getRef(client, owner, repo, baseBranch);

  // Step 4b: Get base tree SHA
  const baseTreeSha = await getCommitTreeSha(client, owner, repo, baseCommitSha);

  // Step 4c: Create new tree with all files
  const newTreeSha = await createTree(client, owner, repo, baseTreeSha, treeEntries);

  // Step 4d: Create commit
  const { commitSha, commitUrl } = await createCommit(
    client, owner, repo, commitMessage, newTreeSha, baseCommitSha,
  );

  // Step 4e: Create branch
  await createBranchRef(client, owner, repo, branchName, commitSha);

  // ── 5. Optional: Create Pull Request ──────────────────────────────────
  let pr: GitPullRequestResult | undefined;
  if (shouldCreatePR) {
    const title = prTitle ?? `AI Team Studio: ${commitMessage}`;
    const body = buildPRBody(project.name, artifacts, documents.length);
    pr = await createPullRequest(client, owner, repo, title, body, branchName, baseBranch);
  }

  // ── 6. Sync DB ────────────────────────────────────────────────────────
  try {
    await syncProjectGit(projectId);
  } catch (syncErr) {
    // Non-fatal: push succeeded, sync can retry later
    console.warn(`[GitPush] Post-push sync failed for ${projectId}:`, syncErr);
  }

  // ── 7. Emit event ────────────────────────────────────────────────────
  try {
    await eventBus.emit({
      type: 'git.push.completed',
      actor: triggeredBy,
      projectId,
      payload: {
        branchName,
        commitSha,
        filesCount: treeEntries.length,
        prNumber: pr?.number ?? null,
      },
    });
  } catch {
    // Non-fatal
  }

  console.log(
    `[GitPush] Completed: ${treeEntries.length} files → ${owner}/${repo}:${branchName}` +
    (pr ? ` (PR #${pr.number})` : ''),
  );

  return {
    success: true,
    branchName,
    commitSha,
    commitUrl,
    filesCount: treeEntries.length,
    pr,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a Markdown PR body listing files grouped by agent.
 */
function buildPRBody(
  projectName: string,
  artifacts: Array<{ name: string; type: string; ownerAgent: string; version: number }>,
  docCount: number,
): string {
  const agentGroups = new Map<string, string[]>();
  for (const art of artifacts) {
    const list = agentGroups.get(art.ownerAgent) ?? [];
    list.push(`\`${art.name}\` (${art.type.toLowerCase()}, v${art.version})`);
    agentGroups.set(art.ownerAgent, list);
  }

  let body = `## AI Team Studio Delivery\n\n`;
  body += `**Project**: ${projectName}\n`;
  body += `**Code Files**: ${artifacts.length}\n`;
  body += `**Documents**: ${docCount}\n`;
  body += `**Generated by**: AI Team Studio agents\n\n`;
  body += `### Files by Agent\n\n`;

  for (const [agent, files] of agentGroups) {
    body += `#### ${agent}\n`;
    for (const file of files) {
      body += `- ${file}\n`;
    }
    body += `\n`;
  }

  body += `---\n`;
  body += `*This PR was automatically created by [AI Team Studio](https://aiteamstudio.com).*\n`;

  return body;
}
