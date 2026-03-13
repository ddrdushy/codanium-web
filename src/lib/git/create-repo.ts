// =============================================================================
// AI Team Studio — GitHub Repository Creation
// =============================================================================
// Orchestrates creating a new GitHub repository for a project, saving the
// config, initializing the DB-backed repo, and optionally pushing initial
// artifacts.
//
// Flow:
//   1. Validate inputs + decrypt token
//   2. Create GitHub repo via Octokit
//   3. Save git config on the Project model
//   4. Initialize local DB repo (main branch + initial commit)
//   5. Optional: push current artifacts as first commit
//   6. Emit event
// =============================================================================

import { prisma } from '@/lib/prisma';
import { encrypt } from '@/lib/ai/encryption';
import { eventBus } from '@/lib/ai/orchestration/event-bus';
import {
  createGitHubClient,
  createRepository,
  type CreateRepoResult,
} from './github-client';
import { initializeRepo } from './repo-manager';
import { addGitPushJob } from '@/lib/queue/git-push-queue';
import { addRepeatableGitSync } from '@/lib/queue/git-sync-queue';
import { isRedisAvailable } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CreateRepoOptions {
  projectId: string;
  /** GitHub PAT (plain text — will be encrypted before storing). */
  token: string;
  /** Repository name (e.g., "my-cool-app"). */
  repoName: string;
  /** Optional description for the GitHub repo. */
  description?: string;
  /** Create under this GitHub org; if omitted, under the user's account. */
  org?: string;
  /** Private repo? Default true. */
  isPrivate?: boolean;
  /** Push existing artifacts right after creation? Default false. */
  pushArtifacts?: boolean;
  /** Who triggered (userId). */
  triggeredBy: string;
}

export interface CreateRepoResultFull {
  success: boolean;
  repo: CreateRepoResult;
  pushJobId?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export async function createProjectRepo(
  options: CreateRepoOptions,
): Promise<CreateRepoResultFull> {
  const {
    projectId,
    token,
    repoName,
    description,
    org,
    isPrivate = true,
    pushArtifacts = false,
    triggeredBy,
  } = options;

  // ── 1. Validate project ────────────────────────────────────────────────
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, description: true, gitRepoName: true },
  });

  if (!project) throw new Error(`Project ${projectId} not found`);

  // ── 2. Create GitHub repo ──────────────────────────────────────────────
  const encryptedToken = encrypt(token);
  const client = createGitHubClient(encryptedToken);

  const repo = await createRepository(client, {
    name: repoName,
    description: description ?? project.description ?? `${project.name} — built by AI Team Studio`,
    isPrivate,
    autoInit: true,
    org,
  });

  console.log(`[CreateRepo] Created GitHub repo: ${repo.fullName} (${repo.htmlUrl})`);

  // ── 3. Save git config on project ─────────────────────────────────────
  const { randomBytes } = await import('crypto');
  const webhookSecret = randomBytes(32).toString('hex');

  await prisma.project.update({
    where: { id: projectId },
    data: {
      gitProvider: 'github',
      gitRepoOwner: repo.owner,
      gitRepoName: repo.name,
      gitDefaultBranch: repo.defaultBranch,
      gitTokenEncrypted: encryptedToken,
      gitWebhookSecret: webhookSecret,
      gitSyncEnabled: true,
    },
  });

  // ── 4. Initialize DB repo (main branch) ────────────────────────────────
  await initializeRepo(projectId);

  // ── 5. Enable periodic sync ────────────────────────────────────────────
  if (await isRedisAvailable()) {
    try {
      await addRepeatableGitSync(projectId);
    } catch (err) {
      console.warn('[CreateRepo] Failed to schedule repeatable sync:', err);
    }
  }

  // ── 6. Optional: push existing artifacts ───────────────────────────────
  let pushJobId: string | undefined;

  if (pushArtifacts) {
    try {
      // Check if there are artifacts to push
      const artifactCount = await prisma.artifact.count({ where: { projectId } });
      if (artifactCount > 0 && (await isRedisAvailable())) {
        pushJobId = await addGitPushJob({
          projectId,
          branchName: `ai-team-studio/initial-delivery-${Date.now()}`,
          commitMessage: 'Initial delivery from AI Team Studio',
          createPR: true,
          prTitle: `🚀 Initial delivery: ${project.name}`,
          triggeredBy,
        });
        console.log(`[CreateRepo] Queued initial push job: ${pushJobId}`);
      }
    } catch (err) {
      console.warn('[CreateRepo] Failed to queue initial push:', err);
    }
  }

  // ── 7. Emit event ─────────────────────────────────────────────────────
  try {
    await eventBus.emit({
      type: 'git.repo.created',
      actor: triggeredBy,
      projectId,
      payload: {
        repoFullName: repo.fullName,
        repoUrl: repo.htmlUrl,
        isPrivate: repo.isPrivate,
        pushJobId: pushJobId ?? null,
      },
    });
  } catch {
    // Non-fatal
  }

  return {
    success: true,
    repo,
    pushJobId,
  };
}
