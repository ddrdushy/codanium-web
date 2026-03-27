import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import {
  getStripeClient,
  getStripeConfig,
  syncSubscription,
  planFromPriceId,
} from '@/lib/stripe';
import { addEmailJob } from '@/lib/queue/email-queue';
import { isRedisAvailable } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * POST /api/webhooks/stripe
 * Stripe webhook handler — NO auth required, verifies via Stripe signature.
 *
 * Handles:
 *   - checkout.session.completed
 *   - customer.subscription.updated
 *   - customer.subscription.deleted
 *   - invoice.payment_succeeded
 *   - invoice.payment_failed
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('stripe-signature') ?? '';

    const config = await getStripeConfig();
    if (!config.webhookSecret) {
      console.error('[StripeWebhook] Webhook secret not configured');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    // Verify webhook signature
    const stripe = await getStripeClient();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, config.webhookSecret);
    } catch (err) {
      console.error('[StripeWebhook] Signature verification failed:', err);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    console.log(`[StripeWebhook] Received event: ${event.type} (${event.id})`);

    switch (event.type) {
      // ── Checkout completed ────────────────────────────────────────────
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        // ── One-time credit purchase ──
        if (session.mode === 'payment' && session.metadata?.type === 'credit_purchase') {
          const userId = session.metadata.userId;
          const credits = parseFloat(session.metadata.credits ?? '0');
          const packId = session.metadata.packId ?? 'unknown';

          if (userId && credits > 0) {
            try {
              const wallet = await prisma.creditWallet.findUnique({ where: { userId } });
              if (wallet) {
                const piId = typeof session.payment_intent === 'string'
                  ? session.payment_intent
                  : session.payment_intent?.id ?? null;

                await prisma.$transaction([
                  prisma.creditWallet.update({
                    where: { userId },
                    data: {
                      balance: { increment: credits },
                      lifetimeAdded: { increment: credits },
                    },
                  }),
                  prisma.creditTransaction.create({
                    data: {
                      walletId: wallet.id,
                      amount: credits,
                      type: 'PURCHASE',
                      description: `Credit pack: ${packId} (+$${credits})`,
                      stripeSessionId: session.id,
                      stripePaymentIntentId: piId ?? undefined,
                    },
                  }),
                ]);
                console.log(`[StripeWebhook] Added $${credits} credits to user ${userId}`);
              }
            } catch (err) {
              console.error('[StripeWebhook] Failed to credit wallet:', err);
            }
          }
          break;
        }

        // ── Subscription checkout ──
        if (session.mode === 'subscription' && session.subscription) {
          const subId =
            typeof session.subscription === 'string'
              ? session.subscription
              : session.subscription.id;

          const subscription = await stripe.subscriptions.retrieve(subId);
          await syncSubscription(subscription);

          // Send subscription email
          const customerId =
            typeof session.customer === 'string'
              ? session.customer
              : session.customer?.id;

          if (customerId) {
            const user = await prisma.user.findUnique({
              where: { stripeCustomerId: customerId },
              select: { id: true, name: true, email: true },
            });

            if (user && (await isRedisAvailable())) {
              const priceId = subscription.items.data[0]?.price?.id ?? '';
              const plan = planFromPriceId(priceId);

              await addEmailJob({
                to: user.email,
                subject: 'Your subscription is active!',
                template: 'subscription',
                props: {
                  name: user.name,
                  plan,
                  action: 'activated',
                },
              });

              // Create transaction record
              const amount =
                (subscription.items.data[0]?.price?.unit_amount ?? 0) / 100;

              await prisma.transaction.create({
                data: {
                  userName: user.name,
                  userEmail: user.email,
                  amount,
                  plan,
                  status: 'COMPLETED',
                  userId: user.id,
                  stripeInvoiceId:
                    typeof session.invoice === 'string'
                      ? session.invoice
                      : session.invoice?.id ?? null,
                },
              });
            }
          }
        }
        break;
      }

      // ── Subscription updated ──────────────────────────────────────────
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await syncSubscription(subscription);

        // Send email about plan change
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

        const user = await prisma.user.findUnique({
          where: { stripeCustomerId: customerId },
          select: { id: true, name: true, email: true },
        });

        if (user && (await isRedisAvailable())) {
          const priceId = subscription.items.data[0]?.price?.id ?? '';
          const plan = planFromPriceId(priceId);

          await addEmailJob({
            to: user.email,
            subject: 'Your subscription has been updated',
            template: 'subscription',
            props: {
              name: user.name,
              plan,
              action: 'updated',
            },
          });
        }
        break;
      }

      // ── Subscription deleted ──────────────────────────────────────────
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId =
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer.id;

        const user = await prisma.user.findUnique({
          where: { stripeCustomerId: customerId },
          select: { id: true, name: true, email: true },
        });

        if (user) {
          await prisma.user.update({
            where: { id: user.id },
            data: {
              plan: 'STARTER',
              subscriptionStatus: 'CANCELED',
              stripeSubscriptionId: null,
              stripePriceId: null,
              currentPeriodEnd: null,
            },
          });

          if (await isRedisAvailable()) {
            await addEmailJob({
              to: user.email,
              subject: 'Your subscription has been canceled',
              template: 'subscription',
              props: {
                name: user.name,
                plan: 'STARTER',
                action: 'canceled',
              },
            });
          }
        }
        break;
      }

      // ── Invoice payment succeeded ─────────────────────────────────────
      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;

        if (customerId) {
          const user = await prisma.user.findUnique({
            where: { stripeCustomerId: customerId },
            select: { id: true, name: true, email: true, plan: true },
          });

          if (user) {
            // Extract payment intent ID (may be string, object, or absent depending on Stripe API version)
            const piRaw = (invoice as any).payment_intent;
            const paymentIntentId: string | null =
              typeof piRaw === 'string' ? piRaw : piRaw?.id ?? null;

            await prisma.transaction.create({
              data: {
                userName: user.name,
                userEmail: user.email,
                amount: (invoice.amount_paid ?? 0) / 100,
                plan: user.plan,
                status: 'COMPLETED',
                userId: user.id,
                stripePaymentIntentId: paymentIntentId,
                stripeInvoiceId: invoice.id,
              },
            });
          }
        }
        break;
      }

      // ── Invoice payment failed ────────────────────────────────────────
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId =
          typeof invoice.customer === 'string'
            ? invoice.customer
            : invoice.customer?.id;

        if (customerId) {
          const user = await prisma.user.findUnique({
            where: { stripeCustomerId: customerId },
            select: { id: true, name: true, email: true, plan: true },
          });

          if (user) {
            // Update subscription status
            await prisma.user.update({
              where: { id: user.id },
              data: { subscriptionStatus: 'PAST_DUE' },
            });

            // Send payment failed email
            if (await isRedisAvailable()) {
              const appUrl = process.env.APP_URL ?? 'http://localhost:3000';

              await addEmailJob({
                to: user.email,
                subject: 'Your payment failed',
                template: 'payment-failed',
                props: {
                  name: user.name,
                  amount: String((invoice.amount_due ?? 0) / 100),
                  updateUrl: `${appUrl}/billing`,
                },
              });
            }

            // Record failed transaction
            await prisma.transaction.create({
              data: {
                userName: user.name,
                userEmail: user.email,
                amount: (invoice.amount_due ?? 0) / 100,
                plan: user.plan ?? 'STARTER',
                status: 'FAILED',
                userId: user.id,
                stripeInvoiceId: invoice.id,
              },
            });
          }
        }
        break;
      }

      default:
        console.log(`[StripeWebhook] Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('POST /api/webhooks/stripe error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
