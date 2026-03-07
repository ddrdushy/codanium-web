import { describe, it, expect } from 'vitest';
import {
  canAccessTier,
  getMaxTier,
  getTierUpgradeRequired,
  PREVIEW_TIER_ACCESS,
  FEATURE_LIMITS,
} from './plan-limits';

describe('PREVIEW_TIER_ACCESS', () => {
  it('STARTER has sandpack only', () => {
    expect(PREVIEW_TIER_ACCESS.STARTER).toEqual(['sandpack']);
  });

  it('PRO has sandpack and webcontainer', () => {
    expect(PREVIEW_TIER_ACCESS.PRO).toEqual(['sandpack', 'webcontainer']);
  });

  it('ENTERPRISE has all three tiers', () => {
    expect(PREVIEW_TIER_ACCESS.ENTERPRISE).toEqual([
      'sandpack',
      'webcontainer',
      'cloud',
    ]);
  });
});

describe('canAccessTier', () => {
  // STARTER
  it('STARTER can access sandpack', () => {
    expect(canAccessTier('STARTER', 'sandpack')).toBe(true);
  });

  it('STARTER cannot access webcontainer', () => {
    expect(canAccessTier('STARTER', 'webcontainer')).toBe(false);
  });

  it('STARTER cannot access cloud', () => {
    expect(canAccessTier('STARTER', 'cloud')).toBe(false);
  });

  // PRO
  it('PRO can access sandpack', () => {
    expect(canAccessTier('PRO', 'sandpack')).toBe(true);
  });

  it('PRO can access webcontainer', () => {
    expect(canAccessTier('PRO', 'webcontainer')).toBe(true);
  });

  it('PRO cannot access cloud', () => {
    expect(canAccessTier('PRO', 'cloud')).toBe(false);
  });

  // ENTERPRISE
  it('ENTERPRISE can access all tiers', () => {
    expect(canAccessTier('ENTERPRISE', 'sandpack')).toBe(true);
    expect(canAccessTier('ENTERPRISE', 'webcontainer')).toBe(true);
    expect(canAccessTier('ENTERPRISE', 'cloud')).toBe(true);
  });
});

describe('getMaxTier', () => {
  it('returns sandpack for STARTER', () => {
    expect(getMaxTier('STARTER')).toBe('sandpack');
  });

  it('returns webcontainer for PRO', () => {
    expect(getMaxTier('PRO')).toBe('webcontainer');
  });

  it('returns cloud for ENTERPRISE', () => {
    expect(getMaxTier('ENTERPRISE')).toBe('cloud');
  });
});

describe('getTierUpgradeRequired', () => {
  it('sandpack requires no upgrade (available to all)', () => {
    expect(getTierUpgradeRequired('sandpack')).toBeNull();
  });

  it('webcontainer requires PRO', () => {
    expect(getTierUpgradeRequired('webcontainer')).toBe('PRO');
  });

  it('cloud requires ENTERPRISE', () => {
    expect(getTierUpgradeRequired('cloud')).toBe('ENTERPRISE');
  });
});

describe('FEATURE_LIMITS', () => {
  it('STARTER has limited resources', () => {
    expect(FEATURE_LIMITS.STARTER.maxProjects).toBe(3);
    expect(FEATURE_LIMITS.STARTER.maxAgentsPerProject).toBe(10);
    expect(FEATURE_LIMITS.STARTER.maxArtifacts).toBe(100);
  });

  it('PRO has more resources', () => {
    expect(FEATURE_LIMITS.PRO.maxProjects).toBe(20);
    expect(FEATURE_LIMITS.PRO.maxArtifacts).toBe(1000);
  });

  it('ENTERPRISE has unlimited projects and artifacts', () => {
    expect(FEATURE_LIMITS.ENTERPRISE.maxProjects).toBe(-1);
    expect(FEATURE_LIMITS.ENTERPRISE.maxArtifacts).toBe(-1);
  });

  it('all plans have preview tiers matching PREVIEW_TIER_ACCESS', () => {
    expect(FEATURE_LIMITS.STARTER.previewTiers).toEqual(PREVIEW_TIER_ACCESS.STARTER);
    expect(FEATURE_LIMITS.PRO.previewTiers).toEqual(PREVIEW_TIER_ACCESS.PRO);
    expect(FEATURE_LIMITS.ENTERPRISE.previewTiers).toEqual(PREVIEW_TIER_ACCESS.ENTERPRISE);
  });
});
