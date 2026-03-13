import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { createGitHubClient, fetchUserAndOrgs } from '@/lib/git/github-client';
import { encrypt } from '@/lib/ai/encryption';

export const dynamic = 'force-dynamic';

/**
 * POST /api/git/user
 *
 * Validate a GitHub PAT and return the authenticated user login + orgs.
 * Used by the "Create Repository" UI to populate the owner selector.
 *
 * Body: { token: string }
 */
export async function POST(request: NextRequest) {
  try {
    const { error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();
    const { token } = body;

    if (!token || typeof token !== 'string' || token.trim().length < 10) {
      return NextResponse.json(
        { error: 'A valid GitHub Personal Access Token is required' },
        { status: 400 },
      );
    }

    // Encrypt token temporarily so we can use the standard client factory
    const encryptedToken = encrypt(token.trim());
    const client = createGitHubClient(encryptedToken);

    const { login, orgs } = await fetchUserAndOrgs(client);

    return NextResponse.json({ login, orgs });
  } catch (err: any) {
    console.error('POST /api/git/user error:', err);

    const status = err?.status ?? 500;
    if (status === 401) {
      return NextResponse.json(
        { error: 'Invalid token. Make sure your GitHub PAT is valid and has the "repo" scope.' },
        { status: 401 },
      );
    }

    return NextResponse.json(
      { error: err?.message ?? 'Failed to validate token' },
      { status: 500 },
    );
  }
}
