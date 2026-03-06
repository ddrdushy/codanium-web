// =============================================================================
// AI Team Studio — GitHub Client (Octokit Wrapper)
// =============================================================================
// Provides typed GitHub API methods for fetching branches, pull requests, and
// releases from a connected repository. Uses AES-256-GCM encrypted PATs stored
// per-project in the database.
// =============================================================================

import { Octokit } from 'octokit';
import { decrypt } from '@/lib/ai/encryption';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GitHubBranch {
  name: string;
  lastCommit: string;
  author: string;
}

export interface GitHubPullRequest {
  number: number;
  title: string;
  branch: string;
  status: 'open' | 'closed' | 'merged';
  author: string;
  avatar: string;
  reviewers: string[];
  additions: number;
  deletions: number;
  comments: number;
}

export interface GitHubRelease {
  version: string;
  date: string;
  status: 'released' | 'draft' | 'pre_release';
  changes: number;
  features: string[];
}

// ---------------------------------------------------------------------------
// Client Factory
// ---------------------------------------------------------------------------

/**
 * Create an authenticated Octokit instance from an encrypted PAT.
 */
export function createGitHubClient(encryptedToken: string): Octokit {
  const token = decrypt(encryptedToken);
  return new Octokit({ auth: token });
}

// ---------------------------------------------------------------------------
// API Methods
// ---------------------------------------------------------------------------

/**
 * Fetch branches from a GitHub repository.
 * Returns up to 100 branches (first page).
 */
export async function fetchBranches(
  client: Octokit,
  owner: string,
  repo: string,
): Promise<GitHubBranch[]> {
  const { data } = await client.rest.repos.listBranches({
    owner,
    repo,
    per_page: 100,
  });

  return data.map((branch) => ({
    name: branch.name,
    lastCommit: branch.commit.sha.slice(0, 7),
    author: branch.commit.url ? '' : '', // Branch API doesn't include author directly
  }));
}

/**
 * Fetch branch details including the last commit author.
 * Called per-branch to enrich author data (optional, used for key branches).
 */
export async function fetchBranchCommitAuthor(
  client: Octokit,
  owner: string,
  repo: string,
  sha: string,
): Promise<string> {
  try {
    const { data } = await client.rest.repos.getCommit({ owner, repo, ref: sha });
    return data.author?.login ?? data.commit.author?.name ?? '';
  } catch {
    return '';
  }
}

/**
 * Fetch pull requests from a GitHub repository.
 * Returns up to 30 most recent PRs across all states.
 */
export async function fetchPullRequests(
  client: Octokit,
  owner: string,
  repo: string,
): Promise<GitHubPullRequest[]> {
  const { data } = await client.rest.pulls.list({
    owner,
    repo,
    state: 'all',
    per_page: 30,
    sort: 'updated',
    direction: 'desc',
  });

  return data.map((pr) => ({
    number: pr.number,
    title: pr.title,
    branch: pr.head.ref,
    status: pr.merged_at ? 'merged' : pr.state === 'closed' ? 'closed' : 'open',
    author: pr.user?.login ?? '',
    avatar: pr.user?.avatar_url ?? '',
    reviewers: pr.requested_reviewers
      ?.filter((r) => r && 'login' in r)
      .map((r) => (r as any).login as string) ?? [],
    additions: (pr as any).additions ?? 0,
    deletions: (pr as any).deletions ?? 0,
    comments: (pr as any).comments ?? 0,
  }));
}

/**
 * Fetch releases from a GitHub repository.
 * Returns up to 20 most recent releases.
 */
export async function fetchReleases(
  client: Octokit,
  owner: string,
  repo: string,
): Promise<GitHubRelease[]> {
  const { data } = await client.rest.repos.listReleases({
    owner,
    repo,
    per_page: 20,
  });

  return data.map((release) => {
    // Parse features from release body (each line starting with - or *)
    const body = release.body ?? '';
    const features = body
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('- ') || line.startsWith('* '))
      .map((line) => line.replace(/^[-*]\s+/, ''))
      .slice(0, 10); // Cap at 10 features

    return {
      version: release.tag_name,
      date: release.published_at ?? release.created_at,
      status: release.draft
        ? 'draft' as const
        : release.prerelease
          ? 'pre_release' as const
          : 'released' as const,
      changes: features.length,
      features,
    };
  });
}
