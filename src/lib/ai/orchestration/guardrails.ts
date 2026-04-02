// =============================================================================
// Codanium — Guardrail Functions
// =============================================================================
// Input and output safety validation with admin-configurable settings.
// Config is loaded from the AdminSetting table (key: 'guardrails.config')
// with a 60-second in-memory cache. Falls back to hardcoded defaults when
// no DB config exists.
//
// Input guardrails (blocking):
//   - Prompt injection detection (toggleable patterns)
//   - PII detection and redaction (toggleable patterns)
//   - Message length guard (configurable limit)
//   - Rate limiting (configurable window + max requests)
//
// Output guardrails (logging, configurable blocking):
//   - Unsafe code pattern detection (toggleable patterns)
//   - Action validation (toggleable)
//   - Response length guard (configurable limit)
// =============================================================================

import type { InputGuardrailResult, OutputGuardrailResult } from './types';
import type { ParsedResponse } from '@/lib/ai/agents/response-parser';
import { prisma } from '@/lib/prisma';
import { redis, isRedisAvailable } from '@/lib/redis';

// ---------------------------------------------------------------------------
// Guardrail Config Interface
// ---------------------------------------------------------------------------

export interface GuardrailConfig {
  input: {
    enabled: boolean;
    maxLength: number;
    injectionDetection: boolean;
    piiDetection: boolean;
    rateLimiting: boolean;
  };
  output: {
    enabled: boolean;
    maxLength: number;
    unsafeCodeDetection: boolean;
    actionValidation: boolean;
    blockOnCritical: boolean;
  };
  rateLimit: {
    maxRequests: number;
    windowSeconds: number;
  };
  injectionPatterns: Array<{
    label: string;
    pattern: string;
    enabled: boolean;
  }>;
  piiPatterns: Array<{
    label: string;
    pattern: string;
    replacement: string;
    enabled: boolean;
  }>;
  unsafeCodePatterns: Array<{
    label: string;
    pattern: string;
    enabled: boolean;
  }>;
}

// ---------------------------------------------------------------------------
// Default Hardcoded Patterns (used as fallback + seeded into DB)
// ---------------------------------------------------------------------------

const DEFAULT_INJECTION_PATTERNS: GuardrailConfig['injectionPatterns'] = [
  { label: 'Ignore Previous Instructions', pattern: 'ignore\\s+(all\\s+)?previous\\s+(instructions|prompts|rules)', enabled: true },
  { label: 'Role Override Attempt', pattern: 'you\\s+are\\s+now\\s+(a|an|the)\\s+', enabled: true },
  { label: 'Jailbreak Keyword', pattern: '\\bjailbreak\\b', enabled: true },
  { label: 'DAN Mode Attempt', pattern: '\\bDAN\\b.*\\bmode\\b|\\bmode\\b.*\\bDAN\\b', enabled: true },
  { label: 'System Tag Injection', pattern: '<\\s*system\\s*>', enabled: true },
  { label: 'Memory Wipe Attempt', pattern: 'forget\\s+(everything|all|your)\\s+(you|instructions|rules|training)', enabled: true },
  { label: 'Identity Override', pattern: 'pretend\\s+(you\\s+)?(are|to\\s+be)\\s+(a|an|the)\\s+', enabled: true },
  { label: 'Safety Bypass Attempt', pattern: 'bypass\\s+(your\\s+)?(safety|content|ethical|guardrail|filter|restriction)', enabled: true },
  { label: 'Restriction Removal', pattern: '\\bact\\s+as\\s+(if|though)\\s+(you\\s+)?(have\\s+)?no\\s+(restrictions|limits|rules)', enabled: true },
  { label: 'Base64 Encoded Instructions', pattern: 'base64[:\\s]+(decode|eval|execute)', enabled: true },
  { label: 'Hidden Instruction Marker', pattern: '\\[INST\\]|\\[/INST\\]|<<SYS>>|<</SYS>>', enabled: true },
  { label: 'Prompt Leak Attempt', pattern: '(show|reveal|print|output|display)\\s+(your|the|system)\\s+(prompt|instructions|rules)', enabled: true },
];

const DEFAULT_PII_PATTERNS: GuardrailConfig['piiPatterns'] = [
  { label: 'US Social Security Number', pattern: '\\b\\d{3}[-\\s]?\\d{2}[-\\s]?\\d{4}\\b', replacement: '[REDACTED-SSN]', enabled: true },
  { label: 'Credit Card Number', pattern: '\\b(?:\\d{4}[-\\s]?){3,4}\\d{1,4}\\b', replacement: '[REDACTED-CC]', enabled: true },
  { label: 'US Passport Number', pattern: '\\b[A-Z]?\\d{8,9}\\b', replacement: '[REDACTED-PASSPORT]', enabled: true },
  { label: 'Email Address', pattern: '\\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}\\b', replacement: '[REDACTED-EMAIL]', enabled: false },
  { label: 'Phone Number', pattern: '\\b(?:\\+?1[-.]?)?\\(?\\d{3}\\)?[-.]?\\d{3}[-.]?\\d{4}\\b', replacement: '[REDACTED-PHONE]', enabled: false },
  { label: 'API Key Pattern', pattern: '\\b(sk-|api[_-]?key|token|secret)[\\w-]{20,}\\b', replacement: '[REDACTED-APIKEY]', enabled: true },
];

const DEFAULT_UNSAFE_CODE_PATTERNS: GuardrailConfig['unsafeCodePatterns'] = [
  { label: 'Destructive rm -rf', pattern: 'rm\\s+-rf\\s+\\/', enabled: true },
  { label: 'SQL DROP Statement', pattern: 'DROP\\s+(TABLE|DATABASE|SCHEMA)\\s+', enabled: true },
  { label: 'eval() Usage', pattern: '\\beval\\s*\\(', enabled: true },
  { label: 'exec() Usage', pattern: '\\bexec\\s*\\(', enabled: true },
  { label: 'Environment Variable Mutation', pattern: 'process\\.env\\.\\w+\\s*=\\s*', enabled: true },
  { label: 'Shell Execution', pattern: 'child_process|spawn\\s*\\(|execSync\\s*\\(', enabled: true },
  { label: 'File System Delete', pattern: 'fs\\.(?:unlink|rmdir|rm)Sync?\\s*\\(', enabled: true },
  { label: 'Crypto Mining', pattern: 'crypto(?:night|miner)|coinhive|minergate', enabled: true },
  { label: 'Reverse Shell', pattern: 'nc\\s+-[el]|bash\\s+-i\\s+>&|/dev/tcp/', enabled: true },
  { label: 'SQL Injection Pattern', pattern: '(?:UNION\\s+SELECT|OR\\s+1\\s*=\\s*1|--\\s*$|;\\s*DROP)', enabled: true },
];

// ---------------------------------------------------------------------------
// Default Config (exported for admin page)
// ---------------------------------------------------------------------------

export const DEFAULT_GUARDRAIL_CONFIG: GuardrailConfig = {
  input: {
    enabled: true,
    maxLength: 50_000,
    injectionDetection: true,
    piiDetection: true,
    rateLimiting: true,
  },
  output: {
    enabled: true,
    maxLength: 100_000,
    unsafeCodeDetection: true,
    actionValidation: true,
    blockOnCritical: true,
  },
  rateLimit: {
    maxRequests: 20,
    windowSeconds: 60,
  },
  injectionPatterns: DEFAULT_INJECTION_PATTERNS,
  piiPatterns: DEFAULT_PII_PATTERNS,
  unsafeCodePatterns: DEFAULT_UNSAFE_CODE_PATTERNS,
};

// ---------------------------------------------------------------------------
// Config Cache (Redis-backed with in-memory fallback)
// ---------------------------------------------------------------------------

let cachedConfig: GuardrailConfig | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 60 seconds
const REDIS_CACHE_KEY = 'cache:guardrails.config';
const REDIS_CACHE_TTL_SECONDS = 60;

/**
 * Load guardrail config with tiered caching:
 *   1. Redis cache (shared across instances)
 *   2. In-memory cache (per-instance fallback)
 *   3. PostgreSQL AdminSetting table
 *   4. Hardcoded DEFAULT_GUARDRAIL_CONFIG
 */
export async function getGuardrailConfig(): Promise<GuardrailConfig> {
  // Try Redis cache first (shared across all app instances)
  try {
    const redisUp = await isRedisAvailable();
    if (redisUp) {
      const cached = await redis.get(REDIS_CACHE_KEY);
      if (cached) {
        return JSON.parse(cached) as GuardrailConfig;
      }
    }
  } catch {
    // Fall through to in-memory cache
  }

  // Check in-memory cache (fallback when Redis is down)
  const now = Date.now();
  if (cachedConfig && now - cacheTimestamp < CACHE_TTL) {
    return cachedConfig;
  }

  // Load from database
  let config: GuardrailConfig;
  try {
    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'guardrails.config' },
    });

    if (setting) {
      const parsed = JSON.parse(setting.value) as Partial<GuardrailConfig>;
      // Deep merge with defaults so new fields/patterns are preserved
      config = {
        input: { ...DEFAULT_GUARDRAIL_CONFIG.input, ...parsed.input },
        output: { ...DEFAULT_GUARDRAIL_CONFIG.output, ...parsed.output },
        rateLimit: { ...DEFAULT_GUARDRAIL_CONFIG.rateLimit, ...parsed.rateLimit },
        injectionPatterns: parsed.injectionPatterns ?? DEFAULT_GUARDRAIL_CONFIG.injectionPatterns,
        piiPatterns: parsed.piiPatterns ?? DEFAULT_GUARDRAIL_CONFIG.piiPatterns,
        unsafeCodePatterns: parsed.unsafeCodePatterns ?? DEFAULT_GUARDRAIL_CONFIG.unsafeCodePatterns,
      };
    } else {
      config = DEFAULT_GUARDRAIL_CONFIG;
    }
  } catch (err) {
    console.error('[Guardrails] Failed to load config from DB, using defaults:', err);
    config = DEFAULT_GUARDRAIL_CONFIG;
  }

  // Write to Redis cache (best-effort, non-blocking)
  try {
    const redisUp = await isRedisAvailable();
    if (redisUp) {
      await redis.set(REDIS_CACHE_KEY, JSON.stringify(config), 'EX', REDIS_CACHE_TTL_SECONDS);
    }
  } catch {
    // Non-fatal — Redis write failure doesn't block the request
  }

  // Also update in-memory cache
  cachedConfig = config;
  cacheTimestamp = now;

  return config;
}

/**
 * Force cache invalidation (e.g., after admin saves new config).
 * Clears both Redis and in-memory caches.
 */
export async function invalidateGuardrailConfigCache(): Promise<void> {
  // Clear in-memory cache
  cachedConfig = null;
  cacheTimestamp = 0;

  // Clear Redis cache (best-effort)
  try {
    const redisUp = await isRedisAvailable();
    if (redisUp) {
      await redis.del(REDIS_CACHE_KEY);
    }
  } catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// Safe RegExp Builder
// ---------------------------------------------------------------------------

/**
 * Build a RegExp from a pattern string, returning null if invalid.
 */
function safeRegExp(pattern: string, flags?: string): RegExp | null {
  try {
    return new RegExp(pattern, flags);
  } catch {
    console.warn(`[Guardrails] Invalid regex pattern: "${pattern}", skipping.`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Rate Limiter (Redis Sorted Sets with In-Memory Fallback)
// ---------------------------------------------------------------------------

/** Fallback in-memory sliding window (used when Redis is unavailable). */
const rateLimitWindows = new Map<string, number[]>();

function checkRateLimitInMemory(
  userId: string,
  maxRequests: number,
  windowMs: number,
): boolean {
  const now = Date.now();
  const cutoff = now - windowMs;
  let timestamps = rateLimitWindows.get(userId);
  if (!timestamps) {
    timestamps = [];
    rateLimitWindows.set(userId, timestamps);
  }
  const active = timestamps.filter((t) => t > cutoff);
  rateLimitWindows.set(userId, active);
  if (active.length >= maxRequests) return true;
  active.push(now);
  return false;
}

/**
 * Distributed rate limiter using Redis sorted sets.
 * Falls back to in-memory sliding window if Redis is unavailable.
 *
 * Redis approach: ZADD user-key score=timestamp member=unique-id
 * Then ZREMRANGEBYSCORE to prune expired, ZCARD to count active.
 *
 * @returns true if rate-limited (blocked), false if allowed.
 */
export async function checkRateLimit(
  userId: string,
  maxRequests: number = 20,
  windowMs: number = 60_000,
): Promise<boolean> {
  try {
    const redisUp = await isRedisAvailable();
    if (!redisUp) {
      return checkRateLimitInMemory(userId, maxRequests, windowMs);
    }

    const key = `ratelimit:${userId}`;
    const now = Date.now();
    const cutoff = now - windowMs;

    // Use a pipeline for atomicity
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, cutoff);                    // Remove expired
    pipeline.zadd(key, now, `${now}-${Math.random().toString(36)}`); // Add current
    pipeline.zcard(key);                                           // Count active
    pipeline.expire(key, Math.ceil(windowMs / 1000));              // Auto-expire key

    const results = await pipeline.exec();
    if (!results) {
      return checkRateLimitInMemory(userId, maxRequests, windowMs);
    }

    const count = results[2]?.[1] as number;
    return count > maxRequests; // > because we already added current request
  } catch (err) {
    console.warn('[RateLimit] Redis error, falling back to in-memory:', err);
    return checkRateLimitInMemory(userId, maxRequests, windowMs);
  }
}

// ---------------------------------------------------------------------------
// Input Guardrails
// ---------------------------------------------------------------------------

/**
 * Run all input guardrails on a user message.
 * Loads config from DB (cached) and respects admin-configured toggles.
 * Returns a result object indicating whether the message was blocked,
 * any flags raised, and the sanitized message (with PII redacted).
 */
export async function runInputGuardrails(
  message: string,
  userId: string,
): Promise<InputGuardrailResult> {
  const config = await getGuardrailConfig();
  const flags: string[] = [];
  let sanitizedMessage = message;

  // If input guardrails are globally disabled, pass through
  if (!config.input.enabled) {
    return { blocked: false, sanitizedMessage: message, flags: [] };
  }

  // ── 1. Message length check ──────────────────────────────────────────
  if (message.length > config.input.maxLength) {
    return {
      blocked: true,
      reason: `Message too long (${message.length} chars). Maximum allowed: ${config.input.maxLength}`,
      sanitizedMessage: message.slice(0, config.input.maxLength),
      flags: ['message-too-long'],
    };
  }

  // ── 2. Prompt injection detection ────────────────────────────────────
  if (config.input.injectionDetection) {
    const enabledPatterns = config.injectionPatterns.filter((p) => p.enabled);
    for (const { pattern: src, label } of enabledPatterns) {
      const regex = safeRegExp(src, 'i');
      if (regex && regex.test(message)) {
        return {
          blocked: true,
          reason: `Message blocked: potential prompt injection detected (${label})`,
          sanitizedMessage: message,
          flags: [`injection:${label}`],
        };
      }
    }
  }

  // ── 3. PII detection and redaction ───────────────────────────────────
  if (config.input.piiDetection) {
    const enabledPatterns = config.piiPatterns.filter((p) => p.enabled);
    for (const { pattern: src, replacement, label } of enabledPatterns) {
      const regex = safeRegExp(src, 'gi');
      if (regex) {
        if (regex.test(message)) {
          flags.push(`pii:${label}`);
          // Reset lastIndex after test() and run replace
          const replaceRegex = safeRegExp(src, 'gi');
          if (replaceRegex) {
            sanitizedMessage = sanitizedMessage.replace(replaceRegex, replacement);
          }
        }
      }
    }
  }

  // ── 4. Rate limiting ─────────────────────────────────────────────────
  if (config.input.rateLimiting) {
    const windowMs = config.rateLimit.windowSeconds * 1000;
    if (await checkRateLimit(userId, config.rateLimit.maxRequests, windowMs)) {
      return {
        blocked: true,
        reason: 'Rate limit exceeded. Please wait a moment before sending another message.',
        sanitizedMessage,
        flags: [...flags, 'rate-limited'],
      };
    }
  }

  return {
    blocked: false,
    sanitizedMessage,
    flags,
  };
}

// ---------------------------------------------------------------------------
// Output Guardrails
// ---------------------------------------------------------------------------

/**
 * Run all output guardrails on the parsed LLM response.
 * Loads config from DB (cached) and respects admin-configured toggles.
 * Returns flags and whether critical issues were found.
 * Output guardrails are typically non-blocking (logged for monitoring).
 */
export async function runOutputGuardrails(
  parsed: ParsedResponse,
  rawContent: string,
): Promise<OutputGuardrailResult> {
  const config = await getGuardrailConfig();
  const flags: string[] = [];
  let hasCriticalIssues = false;

  // If output guardrails are globally disabled, pass through
  if (!config.output.enabled) {
    return { flags: [], hasCriticalIssues: false };
  }

  // ── 1. Response length check ─────────────────────────────────────────
  if (rawContent.length > config.output.maxLength) {
    flags.push(`response-too-long:${rawContent.length}`);
  }

  // ── 2. Unsafe code pattern detection ─────────────────────────────────
  if (config.output.unsafeCodeDetection) {
    const enabledPatterns = config.unsafeCodePatterns.filter((p) => p.enabled);

    // Check artifacts
    for (const artifact of parsed.artifacts) {
      for (const { pattern: src, label } of enabledPatterns) {
        const regex = safeRegExp(src);
        if (regex && regex.test(artifact.content)) {
          flags.push(`unsafe-code:${label}:${artifact.name}`);
          hasCriticalIssues = true;
        }
      }
    }

    // Check main response text
    for (const { pattern: src, label } of enabledPatterns) {
      const regex = safeRegExp(src);
      if (regex && regex.test(rawContent)) {
        flags.push(`unsafe-code:${label}:response`);
      }
    }
  }

  // ── 3. Action validation ─────────────────────────────────────────────
  if (config.output.actionValidation) {
    for (const action of parsed.actions) {
      switch (action.type) {
        case 'create_card':
          if (!action.data.title?.trim()) {
            flags.push('invalid-action:create_card:missing-title');
          }
          break;
        case 'update_card':
          if (!action.cardId?.trim()) {
            flags.push('invalid-action:update_card:missing-cardId');
          }
          break;
        case 'create_decision':
          if (!action.data.trigger?.trim()) {
            flags.push('invalid-action:create_decision:missing-trigger');
          }
          break;
        case 'create_document':
          if (!action.data.title?.trim()) {
            flags.push('invalid-action:create_document:missing-title');
          }
          break;
        case 'advance_sdlc':
          if (!action.stageName?.trim()) {
            flags.push('invalid-action:advance_sdlc:missing-stageName');
          }
          break;
        case 'create_branch':
          if (!(action.data as { name?: string }).name?.trim()) {
            flags.push('invalid-action:create_branch:missing-name');
          }
          break;
        case 'create_pr':
          if (!(action.data as { title?: string }).title?.trim()) {
            flags.push('invalid-action:create_pr:missing-title');
          }
          break;
        case 'create_release':
          if (!(action.data as { version?: string }).version?.trim()) {
            flags.push('invalid-action:create_release:missing-version');
          }
          break;
        // delegate, update_agent_status, trigger_deploy, create_pipeline are more lenient
      }
    }
  }

  // If configured to block on critical issues, reflect that
  if (config.output.blockOnCritical && hasCriticalIssues) {
    // hasCriticalIssues is already true, caller can check this flag
  }

  return { flags, hasCriticalIssues };
}
