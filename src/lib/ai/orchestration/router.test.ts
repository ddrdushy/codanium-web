import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    chatMessage: { findMany: vi.fn().mockResolvedValue([]) },
    agent: { findMany: vi.fn().mockResolvedValue([]) },
    document: { findFirst: vi.fn().mockResolvedValue(null) },
    sDLCStage: { findFirst: vi.fn().mockResolvedValue(null) },
    card: { count: vi.fn().mockResolvedValue(0) },
    project: { findUnique: vi.fn().mockResolvedValue({ id: 'proj-1', currentStage: 'Idea & Planning' }) },
  },
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('../gateway', () => ({
  llmGateway: {
    complete: vi.fn().mockResolvedValue({ content: 'BA', usage: { prompt: 0, completion: 0, total: 0 } }),
    resolve: vi.fn().mockResolvedValue({
      provider: { name: 'mock' },
      config: { provider: 'mock', defaultModel: 'test' },
      isMock: true,
    }),
  },
}));

import { VSCODE_REQUIRED_SENTINEL } from './router';

describe('Message Router', () => {
  it('exports VSCODE_REQUIRED_SENTINEL constant', () => {
    expect(VSCODE_REQUIRED_SENTINEL).toBe('__VSCODE_REQUIRED__');
  });

  it('MessageRouter class is importable', async () => {
    const { MessageRouter } = await import('./router');
    expect(MessageRouter).toBeDefined();
    const router = new MessageRouter();
    expect(typeof router.route).toBe('function');
  });
});
