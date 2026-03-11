import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { invalidateEmailConfigCache } from '@/lib/email';
import crypto from 'crypto';
import Mailjet from 'node-mailjet';

export const dynamic = 'force-dynamic';

const EVENT_TYPES = ['sent', 'open', 'click', 'bounce', 'spam', 'blocked', 'unsub'];

/**
 * POST /api/admin/email/register-webhooks
 * Register Mailjet Event API callback URLs for all event types.
 * Generates a webhook token if one doesn't exist.
 */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireAdmin();
    if (error) return error;

    // Load Mailjet credentials from AdminSettings
    const settings = await prisma.adminSetting.findMany({
      where: {
        key: {
          in: ['email.mailjetApiKey', 'email.mailjetSecretKey', 'email.mailjetWebhookToken'],
        },
      },
    });
    const map: Record<string, string> = {};
    for (const s of settings) map[s.key] = s.value;

    const apiKey = map['email.mailjetApiKey'];
    const secretKey = map['email.mailjetSecretKey'];

    if (!apiKey || !secretKey) {
      return NextResponse.json(
        { error: 'Mailjet API Key and Secret Key must be configured and saved first' },
        { status: 400 },
      );
    }

    // Generate or reuse webhook token
    const userId = (session!.user as any)?.id ?? '';
    let webhookToken = map['email.mailjetWebhookToken'];
    if (!webhookToken) {
      webhookToken = crypto.randomBytes(32).toString('hex');
      await prisma.adminSetting.upsert({
        where: { key: 'email.mailjetWebhookToken' },
        create: { key: 'email.mailjetWebhookToken', value: webhookToken, updatedBy: userId },
        update: { value: webhookToken, updatedBy: userId },
      });
    }

    const appUrl = process.env.APP_URL ?? 'http://localhost:3000';
    const callbackUrl = `${appUrl}/api/webhooks/mailjet?token=${webhookToken}`;

    const mailjet = new Mailjet({ apiKey, apiSecret: secretKey });

    // Register each event type
    const results: Array<{ eventType: string; status: string; error?: string }> = [];

    for (const eventType of EVENT_TYPES) {
      try {
        await mailjet.post('eventcallbackurl', { version: 'v3' }).request({
          EventType: eventType,
          Url: callbackUrl,
          Version: 2, // Grouped events for efficiency
        });
        results.push({ eventType, status: 'registered' });
      } catch (err: any) {
        // If already exists (409), try to update
        try {
          // List existing callbacks to find the ID
          const listRes = await mailjet
            .get('eventcallbackurl', { version: 'v3' })
            .request({ EventType: eventType });

          const existing = (listRes.body as any)?.Data?.[0];
          if (existing?.ID) {
            await mailjet
              .put('eventcallbackurl', { version: 'v3' })
              .id(existing.ID)
              .request({
                Url: callbackUrl,
                Version: 2,
              });
            results.push({ eventType, status: 'updated' });
          } else {
            results.push({ eventType, status: 'failed', error: err.message ?? 'Unknown error' });
          }
        } catch (updateErr: any) {
          results.push({
            eventType,
            status: 'failed',
            error: updateErr.message ?? 'Unknown error',
          });
        }
      }
    }

    await invalidateEmailConfigCache();

    const successCount = results.filter((r) => r.status !== 'failed').length;

    return NextResponse.json({
      success: successCount > 0,
      message: `${successCount}/${EVENT_TYPES.length} webhooks registered`,
      results,
      callbackUrl,
    });
  } catch (err) {
    console.error('POST /api/admin/email/register-webhooks error:', err);
    return NextResponse.json({ error: 'Failed to register webhooks' }, { status: 500 });
  }
}
