import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Mailjet event type → Prisma enum mapping
const EVENT_MAP: Record<string, string> = {
  sent: 'SENT',
  open: 'OPEN',
  click: 'CLICK',
  bounce: 'BOUNCE',
  spam: 'SPAM',
  blocked: 'BLOCKED',
  unsub: 'UNSUB',
};

/**
 * POST /api/webhooks/mailjet
 * Inbound Mailjet Event API handler.
 * Mailjet sends events as a JSON array (Version 2 grouping) or single object.
 * Auth via ?token= query parameter matched against AdminSettings.
 */
export async function POST(request: NextRequest) {
  try {
    // Verify webhook token
    const token = request.nextUrl.searchParams.get('token');
    if (!token) {
      return NextResponse.json({ error: 'Missing token' }, { status: 401 });
    }

    const setting = await prisma.adminSetting.findUnique({
      where: { key: 'email.mailjetWebhookToken' },
    });

    if (!setting || setting.value !== token) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Parse body — Mailjet may send an array or a single object
    const rawBody = await request.json();
    const events = Array.isArray(rawBody) ? rawBody : [rawBody];

    console.log(`[MailjetWebhook] Received ${events.length} event(s)`);

    // Process each event
    const createOps = events
      .filter((evt: any) => EVENT_MAP[evt.event])
      .map((evt: any) =>
        prisma.emailEvent.create({
          data: {
            event: EVENT_MAP[evt.event] as any,
            messageId: String(evt.MessageID ?? evt.mj_message_id ?? ''),
            messageGuid: evt.Message_GUID ?? null,
            email: evt.email ?? '',
            customId: evt.CustomID ?? null,
            timestamp: evt.time ? new Date(evt.time * 1000) : new Date(),
            payload: JSON.stringify(evt),
            smtpReply: evt.smtp_reply ?? null,
            url: evt.url ?? null,
            ip: evt.ip ?? null,
            bounceError: evt.error
              ? `${evt.error_related_to ?? ''}: ${evt.error}${evt.comment ? ' — ' + evt.comment : ''}`
              : null,
            isHardBounce: typeof evt.hard_bounce === 'boolean' ? evt.hard_bounce : null,
            spamSource: evt.source ?? null,
          },
        }),
      );

    if (createOps.length > 0) {
      await prisma.$transaction(createOps);
    }

    // Mailjet requires 200 OK; other codes trigger retries for up to 24h
    return NextResponse.json({ received: true, count: createOps.length });
  } catch (err) {
    console.error('POST /api/webhooks/mailjet error:', err);
    // Still return 200 to prevent Mailjet from retrying on parse errors
    return NextResponse.json({ received: true, error: 'Processing error' });
  }
}
