// =============================================================================
// AI Team Studio — Email Service (Mailjet)
// =============================================================================
// Singleton email service that reads config from admin settings (Redis-cached)
// with env var fallback. If no API key is configured, emails are logged to
// console for development.
//
// Config hierarchy: Admin Settings (DB/Redis) → Environment Variables → Console
// =============================================================================

import Mailjet from 'node-mailjet';
import crypto from 'crypto';
import { redis, isRedisAvailable } from '@/lib/redis';
import { prisma } from '@/lib/prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailConfig {
  enabled: boolean;
  mailjetApiKey: string;
  mailjetSecretKey: string;
  fromAddress: string;
  fromName: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  customId?: string; // Echoed back in Mailjet webhook events for correlation
}

// ---------------------------------------------------------------------------
// Config Cache (same layered pattern as guardrails.ts)
// ---------------------------------------------------------------------------

const CACHE_KEY = 'cache:email.config';
const CACHE_TTL = 60; // seconds

let cachedConfig: EmailConfig | null = null;
let cacheTimestamp = 0;
const IN_MEMORY_TTL = 60_000; // 60 seconds

/**
 * Get email configuration with layered caching:
 * Redis cache → In-memory cache → DB → Env vars → Defaults
 */
export async function getEmailConfig(): Promise<EmailConfig> {
  // 1. Try Redis cache
  try {
    if (await isRedisAvailable()) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        const config = JSON.parse(cached) as EmailConfig;
        cachedConfig = config;
        cacheTimestamp = Date.now();
        return config;
      }
    }
  } catch {
    // Redis unavailable, continue to in-memory / DB
  }

  // 2. Try in-memory cache
  if (cachedConfig && Date.now() - cacheTimestamp < IN_MEMORY_TTL) {
    return cachedConfig;
  }

  // 3. Load from DB (AdminSetting table)
  try {
    const settings = await prisma.adminSetting.findMany({
      where: {
        key: {
          in: [
            'email.enabled',
            'email.mailjetApiKey',
            'email.mailjetSecretKey',
            'email.fromAddress',
            'email.fromName',
          ],
        },
      },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const config: EmailConfig = {
      enabled: settingsMap['email.enabled'] ? JSON.parse(settingsMap['email.enabled']) : false,
      mailjetApiKey: settingsMap['email.mailjetApiKey'] ?? process.env.MAILJET_API_KEY ?? '',
      mailjetSecretKey: settingsMap['email.mailjetSecretKey'] ?? process.env.MAILJET_SECRET_KEY ?? '',
      fromAddress: settingsMap['email.fromAddress'] ?? 'noreply@yourdomain.com',
      fromName: settingsMap['email.fromName'] ?? 'AI Team Studio',
    };

    // Cache in Redis
    try {
      if (await isRedisAvailable()) {
        await redis.set(CACHE_KEY, JSON.stringify(config), 'EX', CACHE_TTL);
      }
    } catch {
      // Non-fatal
    }

    // Cache in memory
    cachedConfig = config;
    cacheTimestamp = Date.now();

    return config;
  } catch {
    // DB unavailable — fall back to env vars
    return {
      enabled: !!(process.env.MAILJET_API_KEY && process.env.MAILJET_SECRET_KEY),
      mailjetApiKey: process.env.MAILJET_API_KEY ?? '',
      mailjetSecretKey: process.env.MAILJET_SECRET_KEY ?? '',
      fromAddress: 'noreply@yourdomain.com',
      fromName: 'AI Team Studio',
    };
  }
}

/**
 * Invalidate email config cache (called when admin saves email settings).
 */
export async function invalidateEmailConfigCache(): Promise<void> {
  cachedConfig = null;
  cacheTimestamp = 0;
  try {
    if (await isRedisAvailable()) {
      await redis.del(CACHE_KEY);
    }
  } catch {
    // Non-fatal
  }
}

// ---------------------------------------------------------------------------
// Send Email
// ---------------------------------------------------------------------------

/**
 * Send an email via Mailjet (or log to console in dev mode).
 * Returns true if sent successfully, false otherwise.
 */
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  const config = await getEmailConfig();

  // Dev mode: log to console if email is not configured
  if (!config.mailjetApiKey || !config.mailjetSecretKey || !config.enabled) {
    console.log('─────────────────────────────────────────────');
    console.log('[Email] Dev Mode — Email would have been sent:');
    console.log(`  To:      ${options.to}`);
    console.log(`  From:    ${config.fromName} <${config.fromAddress}>`);
    console.log(`  Subject: ${options.subject}`);
    console.log(`  HTML:    ${options.html.substring(0, 200)}...`);
    console.log('─────────────────────────────────────────────');
    return true;
  }

  try {
    const mailjet = new Mailjet({
      apiKey: config.mailjetApiKey,
      apiSecret: config.mailjetSecretKey,
    });

    const message: Record<string, unknown> = {
      From: {
        Email: config.fromAddress,
        Name: config.fromName,
      },
      To: [{ Email: options.to }],
      Subject: options.subject,
      HTMLPart: options.html,
    };

    if (options.customId) {
      message.CustomID = options.customId;
    }

    await mailjet.post('send', { version: 'v3.1' }).request({
      Messages: [message],
    });

    console.log(`[Email] Sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error) {
    console.error('[Email] Failed to send:', error);
    return false;
  }
}

// ---------------------------------------------------------------------------
// Token Helpers
// ---------------------------------------------------------------------------

/**
 * Generate a secure token pair:
 * - `raw`: The unhashed token to include in the email URL
 * - `hashed`: SHA-256 hash to store in the database
 */
export function generateToken(): { raw: string; hashed: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hashed = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hashed };
}

/**
 * Hash a raw token (for verification against stored hash).
 */
export function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Get the application URL for building email links.
 */
export function getAppUrl(): string {
  return process.env.APP_URL ?? 'http://localhost:3000';
}
