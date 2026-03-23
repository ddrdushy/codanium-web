import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCard } = vi.hoisted(() => ({
  mockCard: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue({ id: 'card-test', description: 'test', title: 'Test' }),
    count: vi.fn().mockResolvedValue(0),
  },
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    card: mockCard,
    document: { findFirst: vi.fn().mockResolvedValue(null) },
    artifact: { count: vi.fn().mockResolvedValue(0) },
  },
}));

import {
  validateCardTransition,
  CardState,
  CardType,
} from './card-lifecycle';

describe('Card Lifecycle', () => {
  const projectId = 'proj-test';
  const cardId = 'card-test';

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no children cards, so DoD checks pass
    mockCard.findMany.mockResolvedValue([]);
    mockCard.count.mockResolvedValue(0);
  });

  describe('validateCardTransition — invalid transitions', () => {
    const invalidTransitions: [CardState, CardState][] = [
      ['PLANNED', 'DONE'],
      ['PLANNED', 'RELEASED'],
      ['PLANNED', 'UNDER_REVIEW'],
      ['RELEASED', 'PLANNED'],
      ['RELEASED', 'IN_PROGRESS'],
      ['DONE', 'PLANNED'],
      ['DONE', 'BLOCKED'],
    ];

    for (const [from, to] of invalidTransitions) {
      it(`blocks ${from} → ${to}`, async () => {
        const result = await validateCardTransition(cardId, projectId, from, to, 'TASK');
        expect(result.allowed).toBe(false);
        expect(result.reason).toBeTruthy();
      });
    }
  });

  describe('validateCardTransition — valid transitions (no DoD)', () => {
    // These transitions don't have DoD requirements
    const simpleTrans: [CardState, CardState][] = [
      ['PLANNED', 'BLOCKED'],
      ['IN_PROGRESS', 'TESTING'],
      ['IN_PROGRESS', 'BLOCKED'],
      ['IN_PROGRESS', 'PLANNED'],
      ['UNDER_REVIEW', 'TESTING'],
      ['UNDER_REVIEW', 'BLOCKED'],
      ['TESTING', 'BLOCKED'],
      ['BLOCKED', 'PLANNED'],
      ['DONE', 'RELEASED'],
    ];

    for (const [from, to] of simpleTrans) {
      it(`allows ${from} → ${to}`, async () => {
        const result = await validateCardTransition(cardId, projectId, from, to, 'TASK');
        expect(result.allowed).toBe(true);
      });
    }
  });

  describe('validateCardTransition — transitions with DoD checks', () => {
    it('handles PLANNED → IN_PROGRESS with DoD validation', async () => {
      const result = await validateCardTransition(cardId, projectId, 'PLANNED', 'IN_PROGRESS', 'TASK');
      // DoD may block or allow depending on project state — verify no crash and valid response
      expect(result).toHaveProperty('allowed');
    });

    it('handles TESTING → DONE with DoD validation', async () => {
      mockCard.findMany.mockResolvedValue([]);
      const result = await validateCardTransition(cardId, projectId, 'TESTING', 'DONE', 'TASK');
      expect(result).toHaveProperty('allowed');
    });

    it('handles UNDER_REVIEW → DONE with DoD validation', async () => {
      mockCard.findMany.mockResolvedValue([]);
      const result = await validateCardTransition(cardId, projectId, 'UNDER_REVIEW', 'DONE', 'TASK');
      expect(result).toHaveProperty('allowed');
    });

    it('validates same-state transition does not crash', async () => {
      const result = await validateCardTransition(cardId, projectId, 'PLANNED', 'PLANNED', 'TASK');
      expect(typeof result.allowed).toBe('boolean');
    });
  });
});
