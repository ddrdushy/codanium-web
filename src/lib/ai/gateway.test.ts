import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must use vi.hoisted for variables referenced in vi.mock factories
const { mockPrisma, mockDecrypt, mockIsEncrypted } = vi.hoisted(() => ({
  mockPrisma: {
    lLMProviderConfig: {
      findFirst: vi.fn().mockResolvedValue(null),
    },
    adminSetting: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
  mockDecrypt: vi.fn((v: string) => v),
  mockIsEncrypted: vi.fn(() => false),
}));

vi.mock('@/lib/prisma', () => ({ prisma: mockPrisma }));
vi.mock('./encryption', () => ({
  decrypt: mockDecrypt,
  isEncrypted: mockIsEncrypted,
}));

import { LLMGateway } from './gateway';

describe('LLM Gateway', () => {
  let gateway: LLMGateway;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.lLMProviderConfig.findFirst.mockResolvedValue(null);
    mockPrisma.adminSetting.findMany.mockResolvedValue([]);
    gateway = new LLMGateway();
  });

  describe('resolve()', () => {
    it('resolves via agent-level config first', async () => {
      mockPrisma.lLMProviderConfig.findFirst.mockResolvedValueOnce({
        provider: 'anthropic',
        apiKeyEncrypted: 'sk-ant-test',
        baseUrl: null,
        organizationId: null,
        defaultModel: 'claude-sonnet-4-20250514',
      });

      const result = await gateway.resolve('proj-1', 'BA', 'usr-1');
      expect(result.config.provider).toBe('anthropic');
      expect(result.config.defaultModel).toBe('claude-sonnet-4-20250514');
      expect(result.isMock).toBe(false);
    });

    it('falls back to project-level config', async () => {
      mockPrisma.lLMProviderConfig.findFirst
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          provider: 'openai',
          apiKeyEncrypted: 'sk-test',
          baseUrl: null,
          organizationId: null,
          defaultModel: 'gpt-4o',
        });

      const result = await gateway.resolve('proj-1', 'BA', 'usr-1');
      expect(result.config.provider).toBe('openai');
    });

    it('falls back to admin settings', async () => {
      mockPrisma.lLMProviderConfig.findFirst.mockResolvedValue(null);
      mockPrisma.adminSetting.findMany.mockResolvedValueOnce([
        { key: 'llm.defaultProvider', value: 'anthropic' },
        { key: 'llm.defaultModel', value: 'claude-sonnet-4-20250514' },
        { key: 'llm.apiKey', value: 'sk-ant-admin' },
      ]);

      const result = await gateway.resolve('proj-1', 'BA', 'usr-1');
      expect(result.config.provider).toBe('anthropic');
      expect(result.config.apiKey).toBe('sk-ant-admin');
    });

    it('throws when no config found', async () => {
      await expect(gateway.resolve('proj-1', 'BA', 'usr-1')).rejects.toThrow(
        'LLM provider not configured'
      );
    });

    it('skips user-level BYOM (removed)', async () => {
      mockPrisma.adminSetting.findMany.mockResolvedValueOnce([
        { key: 'llm.defaultProvider', value: 'ollama' },
        { key: 'llm.defaultModel', value: 'llama3' },
        { key: 'llm.baseUrl', value: 'http://localhost:11434' },
      ]);

      const result = await gateway.resolve('proj-1', 'BA', 'usr-1');
      expect(result.config.provider).toBe('ollama');

      // No USER scope query
      const calls = mockPrisma.lLMProviderConfig.findFirst.mock.calls;
      for (const call of calls) {
        const where = call[0]?.where;
        if (where?.scope) {
          expect(where.scope).not.toBe('USER');
        }
      }
    });

    it('ignores mock provider in admin settings', async () => {
      mockPrisma.adminSetting.findMany.mockResolvedValueOnce([
        { key: 'llm.defaultProvider', value: 'mock' },
      ]);

      await expect(gateway.resolve('proj-1', 'BA', 'usr-1')).rejects.toThrow();
    });
  });
});
