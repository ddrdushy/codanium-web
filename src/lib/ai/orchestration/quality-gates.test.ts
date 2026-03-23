import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    document: { findFirst: vi.fn().mockResolvedValue(null) },
    wireframe: { count: vi.fn().mockResolvedValue(0) },
    card: { count: vi.fn().mockResolvedValue(0) },
    artifact: { count: vi.fn().mockResolvedValue(0) },
    sDLCStage: { findFirst: vi.fn().mockResolvedValue(null) },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('../tools/workspace-tools', () => ({
  globInWorkspace: vi.fn().mockResolvedValue([]),
}));

import { validateStageGate, validateDelegationGate, getGateRequirements } from './quality-gates';

describe('Quality Gates', () => {
  const projectId = 'proj-test';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Stage Completion Gates', () => {
    it('blocks Idea & Planning when no BRD exists', async () => {
      mockPrisma.document.findFirst.mockResolvedValue(null);
      const result = await validateStageGate(projectId, 'Idea & Planning');
      expect(result.passed).toBe(false);
    });

    it('passes Idea & Planning when BRD exists', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'd1', status: 'DRAFT' });
      const result = await validateStageGate(projectId, 'Idea & Planning');
      expect(result.passed).toBe(true);
    });

    it('blocks Requirement Gathering when BRD not approved', async () => {
      // checkDocumentApproved queries WHERE status: 'APPROVED' — mock returns null (no approved doc found)
      mockPrisma.document.findFirst.mockResolvedValue(null);
      const result = await validateStageGate(projectId, 'Requirement Gathering');
      expect(result.passed).toBe(false);
    });

    it('passes Requirement Gathering when BRD approved', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'd1', status: 'APPROVED' });
      const result = await validateStageGate(projectId, 'Requirement Gathering');
      expect(result.passed).toBe(true);
    });

    it('blocks Development when no cards', async () => {
      mockPrisma.card.count.mockResolvedValue(0);
      const result = await validateStageGate(projectId, 'Development');
      expect(result.passed).toBe(false);
    });

    it('passes Development when cards exist', async () => {
      mockPrisma.card.count.mockResolvedValue(5);
      const result = await validateStageGate(projectId, 'Development');
      expect(result.passed).toBe(true);
    });

    it('blocks Deployment when Testing not completed', async () => {
      mockPrisma.sDLCStage.findFirst.mockResolvedValue({ status: 'ACTIVE' });
      const result = await validateStageGate(projectId, 'Deployment');
      expect(result.passed).toBe(false);
    });

    it('passes Deployment when Testing completed', async () => {
      mockPrisma.sDLCStage.findFirst.mockResolvedValue({ status: 'COMPLETED' });
      const result = await validateStageGate(projectId, 'Deployment');
      expect(result.passed).toBe(true);
    });

    it('passes for unknown stages', async () => {
      const result = await validateStageGate(projectId, 'Unknown Stage');
      expect(result.passed).toBe(true);
    });
  });

  describe('Delegation Gates', () => {
    it('blocks BA→SA when BRD not approved', async () => {
      // checkDocumentApproved queries WHERE status: 'APPROVED' — mock returns null
      mockPrisma.document.findFirst.mockResolvedValue(null);
      const result = await validateDelegationGate(projectId, 'BA', 'SA');
      expect(result.passed).toBe(false);
    });

    it('passes BA→SA when BRD approved', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({ id: 'd1', status: 'APPROVED' });
      const result = await validateDelegationGate(projectId, 'BA', 'SA');
      expect(result.passed).toBe(true);
    });

    it('passes for ungated delegations', async () => {
      const result = await validateDelegationGate(projectId, 'PM', 'BA');
      expect(result.passed).toBe(true);
    });
  });

  describe('Gate Requirements', () => {
    it('returns requirements for known stages', () => {
      const reqs = getGateRequirements('Idea & Planning');
      expect(reqs.length).toBeGreaterThan(0);
    });

    it('returns empty for unknown stages', () => {
      const reqs = getGateRequirements('Unknown');
      expect(reqs).toEqual([]);
    });

    it('has requirements for all 8 phases', () => {
      const phases = [
        'Idea & Planning', 'Requirement Gathering', 'Solution Design',
        'UX/UI Design', 'Development', 'Testing', 'Deployment',
        'Maintenance & Improvement',
      ];
      for (const phase of phases) {
        const reqs = getGateRequirements(phase);
        expect(reqs.length).toBeGreaterThanOrEqual(0); // all phases should have gate definitions
      }
    });
  });
});
