// =============================================================================
// AI Team Studio — Stripe Billing Service
// =============================================================================
// Singleton Stripe client + helper functions for subscriptions, checkout,
// and customer portal. Config reads from AdminSetting (DB → env fallback),
// same layered pattern as email config.
// =============================================================================

import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { redis, isRedisAvailable } from '@/lib/redis';
import type { UserPlan, SubscriptionStatus } from '@/generated/prisma/enums';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StripeConfig {
  enabled: boolean;
  secretKey: string;
  webhookSecret: string;
}

// ---------------------------------------------------------------------------
// Plan Mapping
// ---------------------------------------------------------------------------

function getPlanMap(): Record<string, UserPlan> {
  const map: Record<string, UserPlan> = {};
  if (process.env.STRIPE_PRICE_STARTER) map[process.env.STRIPE_PRICE_STARTER] = 'STARTER';
  if (process.env.STRIPE_PRICE_PRO) map[process.env.STRIPE_PRICE_PRO] = 'PRO';
  if (process.env.STRIPE_PRICE_ENTERPRISE) map[process.env.STRIPE_PRICE_ENTERPRISE] = 'ENTERPRISE';
  return map;
}

export function planFromPriceId(priceId: string): UserPlan {
  return getPlanMap()[priceId] ?? 'STARTER';
}

export function getPriceIds(): { starter: string; pro: string; enterprise: string } {
  return {
    starter: process.env.STRIPE_PRICE_STARTER ?? '',
    pro: process.env.STRIPE_PRICE_PRO ?? '',
    enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? '',
  };
}

// ---------------------------------------------------------------------------
// Config Cache (same layered pattern as email config)
// ---------------------------------------------------------------------------

const CACHE_KEY = 'cache:stripe.config';
const CACHE_TTL = 60; // seconds

let cachedConfig: StripeConfig | null = null;
let cacheTimestamp = 0;
const IN_MEMORY_TTL = 60_000; // 60 seconds

export async function getStripeConfig(): Promise<StripeConfig> {
  // 1. Try Redis cache
  try {
    if (await isRedisAvailable()) {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        const config = JSON.parse(cached) as StripeConfig;
        cachedConfig = config;
        cacheTimestamp = Date.now();
        return config;
      }
    }
  } catch {
    // Redis unavailable
  }

  // 2. Try in-memory cache
  if (cachedConfig && Date.now() - cacheTimestamp < IN_MEMORY_TTL) {
    return cachedConfig;
  }

  // 3. Load from DB (AdminSetting table)
  try {
    const settings = await prisma.adminSetting.findMany({
      where: {
        key: { in: ['stripe.enabled', 'stripe.secretKey', 'stripe.webhookSecret'] },
      },
    });

    const settingsMap: Record<string, string> = {};
    for (const s of settings) {
      settingsMap[s.key] = s.value;
    }

    const config: StripeConfig = {
      enabled: settingsMap['stripe.enabled'] ? JSON.parse(settingsMap['stripe.enabled']) : false,
      secretKey: settingsMap['stripe.secretKey'] ?? process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: settingsMap['stripe.webhookSecret'] ?? process.env.STRIPE_WEBHOOK_SECRET ?? '',
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
      enabled: !!process.env.STRIPE_SECRET_KEY,
      secretKey: process.env.STRIPE_SECRET_KEY ?? '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
    };
  }
}

export async function invalidateStripeConfigCache(): Promise<void> {
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
// Stripe Client Singleton
// ---------------------------------------------------------------------------

let _stripe: Stripe | null = null;

export async function getStripeClient(): Promise<Stripe> {
  const config = await getStripeConfig();
  if (!config.secretKey) {
    throw new Error('Stripe secret key is not configured');
  }

  if (!_stripe) {
    _stripe = new Stripe(config.secretKey, {
      apiVersion: '2025-01-27.acacia' as Stripe.LatestApiVersion,
      typescript: true,
    });
  }
  return _stripe;
}

// ---------------------------------------------------------------------------
// Customer Management
// ---------------------------------------------------------------------------

/**
 * Get or create a Stripe customer for a user.
 * Saves stripeCustomerId to User if newly created.
 */
export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name: string,
): Promise<string> {
  // Check if user already has a Stripe customer ID
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { stripeCustomerId: true },
  });

  if (user?.stripeCustomerId) {
    return user.stripeCustomerId;
  }

  // Create new Stripe customer
  const stripe = await getStripeClient();
  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { userId },
  });

  // Save customer ID to user
  await prisma.user.update({
    where: { id: userId },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

// ---------------------------------------------------------------------------
// Checkout & Portal
// ---------------------------------------------------------------------------

/**
 * Create a Stripe Checkout Session for a subscription.
 */
export async function createCheckoutSession(
  customerId: string,
  priceId: string,
  successUrl: string,
  cancelUrl: string,
): Promise<string> {
  const stripe = await getStripeClient();

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: true,
  });

  return session.url ?? '';
}

/**
 * Create a Stripe Customer Portal session.
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<string> {
  const stripe = await getStripeClient();

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

// ---------------------------------------------------------------------------
// Subscription Sync
// ---------------------------------------------------------------------------

/**
 * Sync Stripe subscription data to the User model.
 */
export async function syncSubscription(
  subscription: Stripe.Subscription,
): Promise<void> {
  const customerId = typeof subscription.customer === 'string'
    ? subscription.customer
    : subscription.customer.id;

  // Find user by Stripe customer ID
  const user = await prisma.user.findUnique({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    console.error(`[Stripe] No user found for customer ${customerId}`);
    return;
  }

  // Map Stripe status to our enum
  const statusMap: Record<string, SubscriptionStatus> = {
    trialing: 'TRIALING',
    active: 'ACTIVE',
    past_due: 'PAST_DUE',
    canceled: 'CANCELED',
    unpaid: 'UNPAID',
  };

  const priceId = subscription.items.data[0]?.price?.id ?? '';
  const plan = planFromPriceId(priceId);
  const status = statusMap[subscription.status] ?? 'NONE';

  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: status,
      plan,
      currentPeriodEnd: (subscription as any).current_period_end
        ? new Date((subscription as any).current_period_end * 1000)
        : null,
      trialEndsAt: (subscription as any).trial_end
        ? new Date((subscription as any).trial_end * 1000)
        : null,
    },
  });

  console.log(`[Stripe] Synced subscription for user ${user.id}: plan=${plan}, status=${status}`);
}
