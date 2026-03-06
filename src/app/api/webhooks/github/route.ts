import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyGitHubSignature } from '@/lib/webhooks/verify';
import { addGitSyncJob } from '@/lib/queue/git-sync-queue';
import { eventBus } from '@/lib/ai/orchestration/event-bus';
import { isRedisAvailable } from '@/lib/redis';

export const dynamic = 'force-dynamic';

// Events that trigger a git sync
const SYNC_EVENTS = new Set(['push', 'pull_request', 'release', 'create', 'delete']);

/**
 * POST /api/webhooks/github
 * Inbound GitHub webhook receiver.
 *
 * 1. Read raw body + signature header
 * 2. Find project by matching webhook secret
 * 3. Verify HMAC-SHA256 signature
 * 4. Queue git sync for relevant events
 * 5. Emit EventBus event
 */
export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('x-hub-signature-256') ?? '';
    const eventType = request.headers.get('x-github-event') ?? 'unknown';
    const deliveryId = request.headers.get('x-github-delivery') ?? '';

    // Handle GitHub ping event (sent when webhook is first configured)
    if (eventType === 'ping') {
      return NextResponse.json({ message: 'pong' });
    }

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // Find all projects with a configured webhook secret
    const projects = await prisma.project.findMany({
      where: {
        gitWebhookSecret: { not: null },
      },
      select: {
        id: true,
        gitWebhookSecret: true,
        gitRepoOwner: true,
        gitRepoName: true,
      },
    });

    // Try to match the signature against each project's secret
    let matchedProject: typeof projects[0] | null = null;

    for (const project of projects) {
      if (project.gitWebhookSecret && verifyGitHubSignature(rawBody, signature, project.gitWebhookSecret)) {
        matchedProject = project;
        break;
      }
    }

    if (!matchedProject) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    console.log(
      `[GitHubWebhook] Received ${eventType} for project ${matchedProject.id} (delivery: ${deliveryId})`,
    );

    // Queue git sync for relevant events
    if (SYNC_EVENTS.has(eventType) && (await isRedisAvailable())) {
      await addGitSyncJob({
        projectId: matchedProject.id,
        triggeredBy: 'webhook',
      });
    }

    // Emit EventBus event for the webhook
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = {};
    }

    await eventBus.emit({
      type: `github.${eventType}`,
      actor: 'github',
      projectId: matchedProject.id,
      payload: {
        event: eventType,
        deliveryId,
        // Include key fields without the full payload
        action: (payload as any).action ?? undefined,
        sender: (payload as any).sender?.login ?? undefined,
        repository: `${matchedProject.gitRepoOwner}/${matchedProject.gitRepoName}`,
      },
    });

    return NextResponse.json({ received: true, event: eventType });
  } catch (err) {
    console.error('POST /api/webhooks/github error:', err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
