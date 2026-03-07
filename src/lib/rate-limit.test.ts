import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RATE_LIMITS } from './rate-limit';

// Mock the checkRateLimit dependency
vi.mock('@/lib/ai/orchestration/graph/guardrails', () => ({
  checkRateLimit: vi.fn(),
}));

// Import after mock is set up
import { rateLimit } from './rate-limit';
import { checkRateLimit } from '@/lib/ai/orchestration/graph/guardrails';

const mockedCheckRateLimit = vi.mocked(checkRateLimit);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('RATE_LIMITS config', () => {
  it('defines read limit as 60/min', () => {
    expect(RATE_LIMITS.read.maxRequests).toBe(60);
    expect(RATE_LIMITS.read.windowMs).toBe(60_000);
  });

  it('defines mutation limit as 30/min', () => {
    expect(RATE_LIMITS.mutation.maxRequests).toBe(30);
    expect(RATE_LIMITS.mutation.windowMs).toBe(60_000);
  });

  it('defines auth limit as 10/min', () => {
    expect(RATE_LIMITS.auth.maxRequests).toBe(10);
    expect(RATE_LIMITS.auth.windowMs).toBe(60_000);
  });

  it('defines webhook limit as 120/min', () => {
    expect(RATE_LIMITS.webhook.maxRequests).toBe(120);
    expect(RATE_LIMITS.webhook.windowMs).toBe(60_000);
  });
});

describe('rateLimit', () => {
  it('returns null when not blocked', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    const result = await rateLimit('user-1', 'read');
    expect(result).toBeNull();
    expect(mockedCheckRateLimit).toHaveBeenCalledWith(
      'api:read:user-1',
      60,
      60_000,
    );
  });

  it('returns 429 response when blocked', async () => {
    mockedCheckRateLimit.mockResolvedValue(true);

    const result = await rateLimit('user-1', 'mutation');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(429);

    const body = await result!.json();
    expect(body.error).toContain('Too many requests');
    expect(body.retryAfter).toBe(60);
  });

  it('includes Retry-After header', async () => {
    mockedCheckRateLimit.mockResolvedValue(true);

    const result = await rateLimit('user-1', 'auth');
    expect(result!.headers.get('Retry-After')).toBe('60');
  });

  it('uses correct key format without endpoint', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    await rateLimit('user-123', 'read');
    expect(mockedCheckRateLimit).toHaveBeenCalledWith(
      'api:read:user-123',
      60,
      60_000,
    );
  });

  it('uses correct key format with endpoint', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    await rateLimit('user-123', 'mutation', '/api/projects');
    expect(mockedCheckRateLimit).toHaveBeenCalledWith(
      'api:mutation:/api/projects:user-123',
      30,
      60_000,
    );
  });

  it('uses correct limits for each category', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    await rateLimit('u1', 'read');
    expect(mockedCheckRateLimit).toHaveBeenLastCalledWith('api:read:u1', 60, 60_000);

    await rateLimit('u1', 'mutation');
    expect(mockedCheckRateLimit).toHaveBeenLastCalledWith('api:mutation:u1', 30, 60_000);

    await rateLimit('u1', 'auth');
    expect(mockedCheckRateLimit).toHaveBeenLastCalledWith('api:auth:u1', 10, 60_000);

    await rateLimit('u1', 'webhook');
    expect(mockedCheckRateLimit).toHaveBeenLastCalledWith('api:webhook:u1', 120, 60_000);
  });

  it('defaults category to read', async () => {
    mockedCheckRateLimit.mockResolvedValue(false);

    await rateLimit('user-1');
    expect(mockedCheckRateLimit).toHaveBeenCalledWith('api:read:user-1', 60, 60_000);
  });
});
