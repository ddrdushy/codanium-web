// =============================================================================
// AI Team Studio — Git Sync Logic
// =============================================================================
// Orchestrates a full sync: fetch branches, PRs, and releases from GitHub
// and upsert them into existing Prisma models. Called by the git-sync worker.
// =============================================================================

import { prisma } from '@/lib/prisma';
import { eventBus } from '@/lib/ai/orchestration/event-bus';
import {
  createGitHubClient,
  fetchBranches,
  fetchBranchCommitAuthor,
  fetchPullRequests,
  fetchReleases,
} from './github-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SyncResult {
  branches: number;
  pullRequests: number;
  releases: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

/**
 * Perform a full git sync for a project.
 *
 * 1. Load project config (encrypted token, repo owner/name)
 * 2. Create Octokit client
 * 3. Fetch + upsert branches, PRs, releases
 * 4. Update project.gitLastSyncAt
 * 5. Emit EventBus event
 */
export async function syncProjectGit(projectId: string): Promise<SyncResult> {
  const result: SyncResult = { branches: 0, pullRequests: 0, releases: 0, errors: [] };

  // ── Load project config ───────────────────────────────────────────────
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      id: true,
      gitProvider: true,
      gitRepoOwner: true,
      gitRepoName: true,
      gitTokenEncrypted: true,
      gitSyncEnabled: true,
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  if (!project.gitTokenEncrypted || !project.gitRepoOwner || !project.gitRepoName) {
    throw new Error(`Project ${projectId} has no git configuration`);
  }

  if (project.gitProvider !== 'github') {
    throw new Error(`Unsupported git provider: ${project.gitProvider}`);
  }

  const owner = project.gitRepoOwner;
  const repo = project.gitRepoName;
  const client = createGitHubClient(project.gitTokenEncrypted);

  // ── Sync Branches ─────────────────────────────────────────────────────
  try {
    const branches = await fetchBranches(client, owner, repo);

    for (const branch of branches) {
      // Enrich with commit author for the first 10 branches
      let author = branch.author;
      if (result.branches < 10 && branch.lastCommit) {
        author = await fetchBranchCommitAuthor(client, owner, repo, branch.lastCommit);
      }

      await prisma.gitBranch.upsert({
        where: {
          projectId_name: { projectId, name: branch.name },
        },
        update: {
          lastCommit: branch.lastCommit,
          author,
          status: 'ACTIVE',
        },
        create: {
          name: branch.name,
          lastCommit: branch.lastCommit,
          author,
          status: 'ACTIVE',
          projectId,
        },
      });
      result.branches++;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error syncing branches';
    result.errors.push(`Branches: ${msg}`);
    console.error(`[GitSync] Branch sync error for ${projectId}:`, err);
  }

  // ── Sync Pull Requests ────────────────────────────────────────────────
  try {
    const prs = await fetchPullRequests(client, owner, repo);

    for (const pr of prs) {
      const prStatus = pr.status === 'open' ? 'OPEN' : pr.status === 'merged' ? 'MERGED' : 'CLOSED';

      await prisma.gitPullRequest.upsert({
        where: {
          projectId_number: { projectId, number: pr.number },
        },
        update: {
          title: pr.title,
          branch: pr.branch,
          status: prStatus,
          author: pr.author,
          avatar: pr.avatar,
          reviewers: pr.reviewers,
          additions: pr.additions,
          deletions: pr.deletions,
          comments: pr.comments,
        },
        create: {
          number: pr.number,
          title: pr.title,
          branch: pr.branch,
          status: prStatus,
          author: pr.author,
          avatar: pr.avatar,
          reviewers: pr.reviewers,
          additions: pr.additions,
          deletions: pr.deletions,
          comments: pr.comments,
          projectId,
        },
      });
      result.pullRequests++;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error syncing PRs';
    result.errors.push(`PRs: ${msg}`);
    console.error(`[GitSync] PR sync error for ${projectId}:`, err);
  }

  // ── Sync Releases ─────────────────────────────────────────────────────
  try {
    const releases = await fetchReleases(client, owner, repo);

    for (const release of releases) {
      const releaseStatus = release.status === 'released'
        ? 'RELEASED'
        : release.status === 'draft'
          ? 'DRAFT'
          : 'PRE_RELEASE';

      await prisma.gitRelease.upsert({
        where: {
          projectId_version: { projectId, version: release.version },
        },
        update: {
          date: release.date,
          status: releaseStatus,
          changes: release.changes,
          features: release.features,
        },
        create: {
          version: release.version,
          date: release.date,
          status: releaseStatus,
          changes: release.changes,
          features: release.features,
          projectId,
        },
      });
      result.releases++;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error syncing releases';
    result.errors.push(`Releases: ${msg}`);
    console.error(`[GitSync] Release sync error for ${projectId}:`, err);
  }

  // ── Update last sync timestamp ────────────────────────────────────────
  await prisma.project.update({
    where: { id: projectId },
    data: { gitLastSyncAt: new Date() },
  });

  // ── Emit event ────────────────────────────────────────────────────────
  await eventBus.emit({
    type: 'git.sync.completed',
    actor: 'system',
    projectId,
    payload: {
      branches: result.branches,
      pullRequests: result.pullRequests,
      releases: result.releases,
      errors: result.errors,
    },
  });

  console.log(
    `[GitSync] Completed for ${projectId}: ${result.branches} branches, ${result.pullRequests} PRs, ${result.releases} releases`,
  );

  return result;
}
