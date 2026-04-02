// =============================================================================
// Codanium — GitHub Client (Octokit Wrapper)
// =============================================================================
// Provides typed GitHub API methods for fetching branches, pull requests, and
// releases from a connected repository. Uses AES-256-GCM encrypted PATs stored
// per-project in the database.
// =============================================================================

import { Octokit } from 'octokit';
import { decrypt } from '@/lib/ai/encryption';

// ---------------------------------------------------------------------------
// Types — Read Operations
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

// ---------------------------------------------------------------------------
// Types — Push Operations
// ---------------------------------------------------------------------------

export interface GitTreeEntry {
  path: string;
  mode: '100644';     // regular file
  type: 'blob';
  content: string;    // file content (GitHub creates blob automatically)
}

export interface GitPushResult {
  commitSha: string;
  commitUrl: string;
}

export interface GitPullRequestResult {
  number: number;
  title: string;
  url: string;
  htmlUrl: string;
}

// ---------------------------------------------------------------------------
// Git Data API — Push Operations
// ---------------------------------------------------------------------------

/**
 * Get the SHA of a branch ref (e.g., "heads/main").
 */
export async function getRef(
  client: Octokit,
  owner: string,
  repo: string,
  branch: string,
): Promise<string> {
  const { data } = await client.rest.git.getRef({
    owner,
    repo,
    ref: `heads/${branch}`,
  });
  return data.object.sha;
}

/**
 * Get the tree SHA from a commit SHA.
 */
export async function getCommitTreeSha(
  client: Octokit,
  owner: string,
  repo: string,
  commitSha: string,
): Promise<string> {
  const { data } = await client.rest.git.getCommit({
    owner,
    repo,
    commit_sha: commitSha,
  });
  return data.tree.sha;
}

/**
 * Create a new Git tree containing all files.
 * Uses base_tree so existing repo files are preserved.
 */
export async function createTree(
  client: Octokit,
  owner: string,
  repo: string,
  baseTreeSha: string,
  entries: GitTreeEntry[],
): Promise<string> {
  const { data } = await client.rest.git.createTree({
    owner,
    repo,
    base_tree: baseTreeSha,
    tree: entries,
  });
  return data.sha;
}

/**
 * Create a new commit pointing to a tree.
 */
export async function createCommit(
  client: Octokit,
  owner: string,
  repo: string,
  message: string,
  treeSha: string,
  parentCommitSha: string,
): Promise<GitPushResult> {
  const { data } = await client.rest.git.createCommit({
    owner,
    repo,
    message,
    tree: treeSha,
    parents: [parentCommitSha],
  });
  return { commitSha: data.sha, commitUrl: data.html_url };
}

/**
 * Create a new branch ref pointing at a commit SHA.
 */
export async function createBranchRef(
  client: Octokit,
  owner: string,
  repo: string,
  branchName: string,
  commitSha: string,
): Promise<void> {
  await client.rest.git.createRef({
    owner,
    repo,
    ref: `refs/heads/${branchName}`,
    sha: commitSha,
  });
}

/**
 * Create a pull request.
 */
export async function createPullRequest(
  client: Octokit,
  owner: string,
  repo: string,
  title: string,
  body: string,
  head: string,
  base: string,
): Promise<GitPullRequestResult> {
  const { data } = await client.rest.pulls.create({
    owner,
    repo,
    title,
    body,
    head,
    base,
  });
  return {
    number: data.number,
    title: data.title,
    url: data.url,
    htmlUrl: data.html_url,
  };
}

// ---------------------------------------------------------------------------
// Repository Creation
// ---------------------------------------------------------------------------

export interface CreateRepoOptions {
  name: string;
  description?: string;
  isPrivate?: boolean;
  autoInit?: boolean;          // Create with README
  org?: string;                // If set, create under this GitHub org
}

export interface CreateRepoResult {
  owner: string;
  name: string;
  fullName: string;            // "owner/name"
  htmlUrl: string;
  cloneUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
}

/**
 * Create a new GitHub repository.
 * If `org` is provided, creates under that organization; otherwise under the
 * authenticated user's account.
 */
export async function createRepository(
  client: Octokit,
  options: CreateRepoOptions,
): Promise<CreateRepoResult> {
  const { name, description, isPrivate = true, autoInit = true, org } = options;

  let data: any;

  if (org) {
    // Organization repo
    const res = await client.rest.repos.createInOrg({
      org,
      name,
      description: description ?? '',
      private: isPrivate,
      auto_init: autoInit,
    });
    data = res.data;
  } else {
    // User repo
    const res = await client.rest.repos.createForAuthenticatedUser({
      name,
      description: description ?? '',
      private: isPrivate,
      auto_init: autoInit,
    });
    data = res.data;
  }

  return {
    owner: data.owner.login,
    name: data.name,
    fullName: data.full_name,
    htmlUrl: data.html_url,
    cloneUrl: data.clone_url,
    defaultBranch: data.default_branch ?? 'main',
    isPrivate: data.private,
  };
}

/**
 * Fetch the authenticated user's login and list of organizations.
 * Used by the UI to populate owner selection.
 */
export async function fetchUserAndOrgs(
  client: Octokit,
): Promise<{ login: string; orgs: string[] }> {
  const [{ data: user }, { data: orgs }] = await Promise.all([
    client.rest.users.getAuthenticated(),
    client.rest.orgs.listForAuthenticatedUser({ per_page: 50 }),
  ]);

  return {
    login: user.login,
    orgs: orgs.map((o) => o.login),
  };
}

/**
 * Check if a repository exists.
 */
export async function repoExists(
  client: Octokit,
  owner: string,
  repo: string,
): Promise<boolean> {
  try {
    await client.rest.repos.get({ owner, repo });
    return true;
  } catch {
    return false;
  }
}
