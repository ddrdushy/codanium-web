import type { UserPlan } from '@/generated/prisma/enums';

// ---------------------------------------------------------------------------
// Preview Tier Types
// ---------------------------------------------------------------------------

export type PreviewTier = 'sandpack' | 'webcontainer' | 'cloud';

// ---------------------------------------------------------------------------
// Preview Tier Access
// ---------------------------------------------------------------------------

/**
 * Maps each plan to the preview tiers it can access.
 *
 * STARTER  → Sandpack only (browser-based React/HTML preview)
 * PRO      → Sandpack + WebContainer (full Node.js in-browser)
 * ENTERPRISE → All tiers including Cloud (any language)
 */
export const PREVIEW_TIER_ACCESS: Record<UserPlan, PreviewTier[]> = {
  STARTER: ['sandpack'],
  PRO: ['sandpack', 'webcontainer'],
  ENTERPRISE: ['sandpack', 'webcontainer', 'cloud'],
};

/**
 * Check if a user's plan allows access to a specific preview tier.
 */
export function canAccessTier(plan: UserPlan, tier: PreviewTier): boolean {
  return PREVIEW_TIER_ACCESS[plan]?.includes(tier) ?? false;
}

/**
 * Get the highest preview tier a plan can access.
 */
export function getMaxTier(plan: UserPlan): PreviewTier {
  const tiers = PREVIEW_TIER_ACCESS[plan];
  return tiers[tiers.length - 1] ?? 'sandpack';
}

/**
 * Get the minimum plan required to access a given tier.
 * Returns null if the tier is available to all plans (sandpack).
 */
export function getTierUpgradeRequired(tier: PreviewTier): UserPlan | null {
  switch (tier) {
    case 'sandpack':
      return null; // Available to all
    case 'webcontainer':
      return 'PRO';
    case 'cloud':
      return 'ENTERPRISE';
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Feature Limits (extensible for future features)
// ---------------------------------------------------------------------------

export const FEATURE_LIMITS: Record<
  UserPlan,
  {
    maxProjects: number;
    maxAgentsPerProject: number;
    maxArtifacts: number;
    previewTiers: PreviewTier[];
  }
> = {
  STARTER: {
    maxProjects: 3,
    maxAgentsPerProject: 10,
    maxArtifacts: 100,
    previewTiers: ['sandpack'],
  },
  PRO: {
    maxProjects: 20,
    maxAgentsPerProject: 23,
    maxArtifacts: 1000,
    previewTiers: ['sandpack', 'webcontainer'],
  },
  ENTERPRISE: {
    maxProjects: -1, // Unlimited
    maxAgentsPerProject: 23,
    maxArtifacts: -1, // Unlimited
    previewTiers: ['sandpack', 'webcontainer', 'cloud'],
  },
};
