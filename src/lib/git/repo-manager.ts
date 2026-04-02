// =============================================================================
// Codanium — DB-Backed Repository Manager
// =============================================================================
// Manages Git-like version control using PostgreSQL tables instead of
// filesystem Git repos. Each project has a "main" branch, and each Kanban
// card gets its own feature branch. Branches, commits, and merges are all
// tracked in the database.
//
// When pushing to GitHub, the file tree is reconstructed from the DB and
// pushed via the GitHub Git Data API.
// =============================================================================

import { prisma } from '@/lib/prisma';
import { createHash } from 'crypto';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RepoInitResult {
  branchId: string;
  branchName: string;
}

export interface CardBranchResult {
  branchId: string;
  branchName: string;
}

export interface CommitResult {
  commitId: string;
  sha: string;
}

// ---------------------------------------------------------------------------
// Core Operations
// ---------------------------------------------------------------------------

/**
 * Initialize the "main" branch for a new project.
 * Called during project creation (seedProject).
 */
export async function initializeRepo(projectId: string): Promise<RepoInitResult> {
  const branch = await prisma.gitBranch.upsert({
    where: {
      projectId_name: { projectId, name: 'main' },
    },
    create: {
      name: 'main',
      status: 'ACTIVE',
      author: 'system',
      lastCommit: generateSha('init'),
      projectId,
    },
    update: {}, // No-op if already exists
  });

  // Create initial commit on main
  const sha = generateSha(`init-${projectId}-${Date.now()}`);
  await prisma.gitCommit.create({
    data: {
      message: 'Initial commit — project initialized',
      author: 'system',
      sha,
      branchId: branch.id,
      projectId,
    },
  });

  // Update branch last commit
  await prisma.gitBranch.update({
    where: { id: branch.id },
    data: { lastCommit: sha },
  });

  console.log(`[RepoManager] Initialized repo for project ${projectId}`);

  return { branchId: branch.id, branchName: 'main' };
}

/**
 * Create a feature branch for a card.
 * Called when a card transitions to IN_PROGRESS.
 */
export async function createCardBranch(
  projectId: string,
  cardId: string,
  cardTitle: string,
): Promise<CardBranchResult> {
  // Generate branch name from card title
  const slug = cardTitle
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const branchName = `card/${slug}-${cardId.slice(-6)}`;

  // Get the main branch's latest commit
  const mainBranch = await prisma.gitBranch.findFirst({
    where: { projectId, name: 'main' },
  });

  const branch = await prisma.gitBranch.upsert({
    where: {
      projectId_name: { projectId, name: branchName },
    },
    create: {
      name: branchName,
      status: 'ACTIVE',
      author: 'system',
      lastCommit: mainBranch?.lastCommit ?? generateSha('branch'),
      behind: 0,
      ahead: 0,
      projectId,
    },
    update: {
      status: 'ACTIVE', // Reactivate if was stale
    },
  });

  // Create branch creation commit
  const sha = generateSha(`branch-${branchName}-${Date.now()}`);
  await prisma.gitCommit.create({
    data: {
      message: `Create branch ${branchName} from main`,
      author: 'system',
      sha,
      branchId: branch.id,
      projectId,
    },
  });

  console.log(`[RepoManager] Created branch "${branchName}" for card ${cardId}`);

  return { branchId: branch.id, branchName };
}

/**
 * Record a commit on a branch.
 * Called when an artifact is created or updated.
 */
export async function recordCommit(
  branchId: string,
  projectId: string,
  message: string,
  author: string,
): Promise<CommitResult> {
  const sha = generateSha(`${message}-${author}-${Date.now()}`);

  const commit = await prisma.gitCommit.create({
    data: {
      message,
      author,
      sha,
      branchId,
      projectId,
    },
  });

  // Update branch last commit and ahead count
  await prisma.gitBranch.update({
    where: { id: branchId },
    data: {
      lastCommit: sha,
      ahead: { increment: 1 },
    },
  });

  return { commitId: commit.id, sha };
}

/**
 * Merge a card's branch into main.
 * Called when a card transitions to DONE.
 */
export async function mergeBranch(
  branchId: string,
  projectId: string,
): Promise<void> {
  // Get branch info
  const branch = await prisma.gitBranch.findUnique({
    where: { id: branchId },
    select: { name: true, lastCommit: true },
  });

  if (!branch) {
    console.warn(`[RepoManager] Branch ${branchId} not found, skipping merge`);
    return;
  }

  // Mark branch as merged
  await prisma.gitBranch.update({
    where: { id: branchId },
    data: {
      status: 'MERGED',
      behind: 0,
      ahead: 0,
    },
  });

  // Get main branch
  const mainBranch = await prisma.gitBranch.findFirst({
    where: { projectId, name: 'main' },
  });

  if (mainBranch) {
    // Create merge commit on main
    const sha = generateSha(`merge-${branch.name}-${Date.now()}`);
    await prisma.gitCommit.create({
      data: {
        message: `Merge ${branch.name} into main`,
        author: 'system',
        sha,
        branchId: mainBranch.id,
        projectId,
      },
    });

    // Update main branch last commit
    await prisma.gitBranch.update({
      where: { id: mainBranch.id },
      data: { lastCommit: sha },
    });
  }

  console.log(`[RepoManager] Merged branch "${branch.name}" into main`);
}

// ---------------------------------------------------------------------------
// Query Operations
// ---------------------------------------------------------------------------

/**
 * Get the "main tree" — all artifacts that are part of the main branch.
 * This includes:
 *   - Artifacts from cards with state DONE or RELEASED (merged branches)
 *   - Artifacts not linked to any card (legacy/manual)
 *
 * For duplicate filenames, the latest version wins.
 */
export async function getMainTree(projectId: string) {
  // Get all artifacts on main (unlinked or from completed cards)
  const artifacts = await prisma.artifact.findMany({
    where: {
      projectId,
      OR: [
        { cardId: null },         // Not linked to any card
        {
          card: {
            state: { in: ['DONE', 'RELEASED'] },
          },
        },
      ],
    },
    select: {
      id: true,
      name: true,
      type: true,
      content: true,
      ownerAgent: true,
      version: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Deduplicate by name (latest version wins)
  const seen = new Set<string>();
  const deduped = [];
  for (const art of artifacts) {
    if (!seen.has(art.name)) {
      seen.add(art.name);
      deduped.push(art);
    }
  }

  return deduped;
}

/**
 * Get artifacts specific to a branch (via its card).
 */
export async function getBranchArtifacts(cardId: string) {
  return prisma.artifact.findMany({
    where: { cardId },
    select: {
      id: true,
      name: true,
      type: true,
      content: true,
      ownerAgent: true,
      version: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
}

/**
 * Get commit history for a branch.
 */
export async function getBranchCommits(branchId: string, limit = 50) {
  return prisma.gitCommit.findMany({
    where: { branchId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

/**
 * Get project commit history across all branches.
 */
export async function getProjectCommits(projectId: string, limit = 100) {
  return prisma.gitCommit.findMany({
    where: { projectId },
    include: {
      branch: { select: { name: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a 7-character SHA-like hash.
 */
export function generateSha(content: string): string {
  return createHash('sha256')
    .update(content)
    .digest('hex')
    .slice(0, 7);
}
