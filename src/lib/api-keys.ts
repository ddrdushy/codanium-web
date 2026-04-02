// =============================================================================
// Codanium — API Key Service
// =============================================================================
// Generate, hash, and validate API keys. Keys use SHA-256 hashing (same
// pattern as email tokens in src/lib/email/index.ts).
//
// Key format: ats_sk_<32-hex-chars>
// Storage:    SHA-256 hash in DB, raw key shown only once on creation
// =============================================================================

import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import type { UserPlan } from '@/generated/prisma/enums';

// ---------------------------------------------------------------------------
// Plan Limits
// ---------------------------------------------------------------------------

export const API_KEY_LIMITS: Record<UserPlan, number> = {
  STARTER: 2,
  PRO: 10,
  ENTERPRISE: 50,
};

// ---------------------------------------------------------------------------
// Key Generation
// ---------------------------------------------------------------------------

/**
 * Generate a new API key.
 * Returns raw key (shown once), hash (stored in DB), and prefix (for display).
 */
export function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const randomPart = crypto.randomBytes(32).toString('hex');
  const raw = `ats_sk_${randomPart}`;
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  const prefix = raw.substring(0, 12); // "ats_sk_xxxxx"
  return { raw, hash, prefix };
}

/**
 * Hash a raw API key for lookup.
 */
export function hashApiKey(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// ---------------------------------------------------------------------------
// Key Validation
// ---------------------------------------------------------------------------

/**
 * Validate an API key: hash → lookup → check revoked/expired → update lastUsedAt.
 * Returns the user ID if valid, null otherwise.
 */
export async function validateApiKey(
  raw: string,
): Promise<{ userId: string; keyId: string; scopes: string[] } | null> {
  if (!raw || !raw.startsWith('ats_sk_')) {
    return null;
  }

  const hash = hashApiKey(raw);

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
    select: {
      id: true,
      userId: true,
      scopes: true,
      revokedAt: true,
      expiresAt: true,
    },
  });

  if (!apiKey) {
    return null;
  }

  // Check revoked
  if (apiKey.revokedAt) {
    return null;
  }

  // Check expired
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return null;
  }

  // Update lastUsedAt (non-blocking)
  prisma.apiKey
    .update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    })
    .catch(() => {
      // Non-fatal
    });

  return {
    userId: apiKey.userId,
    keyId: apiKey.id,
    scopes: apiKey.scopes,
  };
}
