import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Must use vi.hoisted for variables referenced in vi.mock factories
const { mockPrisma, mockDecrypt, mockIsEncrypted } = vi.hoisted(() => ({
  mockPrisma: {
    lLMProviderConfig: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
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

import { LLMGateway, NoBYOKConfiguredError } from './gateway';

describe('LLM Gateway', () => {
  let gateway: LLMGateway;

  beforeEach(() => {
    // resetAllMocks (vs clearAllMocks) drains queued mockResolvedValueOnce
    // values so they can't leak between tests. We re-establish defaults below.
    vi.resetAllMocks();
    mockPrisma.lLMProviderConfig.findFirst.mockResolvedValue(null);
    mockPrisma.lLMProviderConfig.findMany.mockResolvedValue([]);
    mockPrisma.adminSetting.findMany.mockResolvedValue([]);
    mockDecrypt.mockImplementation((v: string) => v);
    mockIsEncrypted.mockReturnValue(false);
    gateway = new LLMGateway();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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

    it('throws NoBYOKConfiguredError when authenticated user has no config in any scope', async () => {
      const promise = gateway.resolve('proj-1', 'BA', 'usr-1');
      await expect(promise).rejects.toBeInstanceOf(NoBYOKConfiguredError);
      await expect(promise).rejects.toMatchObject({ code: 'NO_BYOK_CONFIGURED' });
    });

    it('throws generic error when no userId and no config (system-context call)', async () => {
      await expect(gateway.resolve('proj-1', 'BA', undefined)).rejects.toThrow(
        'LLM provider not configured'
      );
    });

    it('resolves USER-scope BYOK first and short-circuits other scopes', async () => {
      mockPrisma.lLMProviderConfig.findFirst.mockResolvedValueOnce({
        provider: 'anthropic',
        apiKeyEncrypted: 'sk-ant-user',
        baseUrl: null,
        organizationId: null,
        defaultModel: 'claude-sonnet-4-20250514',
      });

      const result = await gateway.resolve('proj-1', 'BA', 'usr-1');
      expect(result.scope).toBe('USER');
      expect(result.billingType).toBe('BYOK');
      expect(result.config.apiKey).toBe('sk-ant-user');

      // First findFirst query should target USER scope
      const firstCall = mockPrisma.lLMProviderConfig.findFirst.mock.calls[0];
      expect(firstCall[0].where.scope).toBe('USER');
      expect(firstCall[0].where.userId).toBe('usr-1');

      // Only one query — USER hit short-circuited the rest
      expect(mockPrisma.lLMProviderConfig.findFirst).toHaveBeenCalledTimes(1);
    });

    it('REQUIRE_USER_BYOK forbids platform/admin fallback for authenticated users', async () => {
      vi.stubEnv('REQUIRE_USER_BYOK', 'true');

      const promise = gateway.resolve('proj-1', 'BA', 'usr-1');
      await expect(promise).rejects.toBeInstanceOf(NoBYOKConfiguredError);
      // Admin settings should never have been queried — gate blocks before fallback
      expect(mockPrisma.adminSetting.findMany).not.toHaveBeenCalled();
    });

    it('REQUIRE_USER_BYOK still allows the system path (no userId) to reach admin defaults', async () => {
      vi.stubEnv('REQUIRE_USER_BYOK', 'true');
      mockPrisma.adminSetting.findMany.mockResolvedValueOnce([
        { key: 'llm.defaultProvider', value: 'ollama' },
        { key: 'llm.defaultModel', value: 'llama3' },
        { key: 'llm.baseUrl', value: 'http://localhost:11434' },
      ]);

      const result = await gateway.resolve(undefined, undefined, undefined);
      expect(result.config.provider).toBe('ollama');
    });

    it('ignores mock provider in admin settings', async () => {
      mockPrisma.adminSetting.findMany.mockResolvedValueOnce([
        { key: 'llm.defaultProvider', value: 'mock' },
      ]);

      await expect(gateway.resolve('proj-1', 'BA', 'usr-1')).rejects.toThrow();
    });
  });
});
