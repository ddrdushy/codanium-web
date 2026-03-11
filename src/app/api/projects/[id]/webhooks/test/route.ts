import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { signWebhookPayload } from '@/lib/webhooks/verify';

export const dynamic = 'force-dynamic';

const DELIVERY_TIMEOUT_MS = 15_000; // 15 second timeout for test

/**
 * POST /api/projects/[id]/webhooks/test
 * Send a test webhook to a registered endpoint.
 *
 * Body: { endpointId }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id } = await context.params;

    // Verify owner/admin
    const userId = (session.user as any)?.id;
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });

    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Only project owners and admins can test webhooks' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { endpointId } = body;

    if (!endpointId || typeof endpointId !== 'string') {
      return NextResponse.json({ error: 'endpointId is required' }, { status: 400 });
    }

    // Load endpoint
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
    });

    if (!endpoint || endpoint.projectId !== id) {
      return NextResponse.json({ error: 'Webhook endpoint not found' }, { status: 404 });
    }

    // Load project name
    const project = await prisma.project.findUnique({
      where: { id },
      select: { name: true },
    });

    // Build test payload
    const payload = JSON.stringify({
      event: 'test',
      timestamp: new Date().toISOString(),
      actor: 'admin',
      projectId: id,
      data: {
        message: 'This is a test webhook from AI Team Studio',
        project: { id, name: project?.name ?? 'Unknown' },
      },
    });

    // Sign and deliver
    const signature = signWebhookPayload(payload, endpoint.secret);
    const startTime = Date.now();

    let statusCode: number | null = null;
    let responseBody: string | null = null;
    let success = false;
    let deliveryError: string | null = null;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
          'X-Webhook-Event': 'test',
          'User-Agent': 'AI-Team-Studio-Webhook/1.0',
        },
        body: payload,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      statusCode = response.status;

      try {
        const text = await response.text();
        responseBody = text.slice(0, 1024);
      } catch {
        responseBody = null;
      }

      success = statusCode >= 200 && statusCode < 300;

      if (!success) {
        deliveryError = `HTTP ${statusCode}`;
      }
    } catch (err) {
      deliveryError = err instanceof Error ? err.message : 'Delivery failed';
      if (deliveryError.includes('abort')) {
        deliveryError = `Timeout after ${DELIVERY_TIMEOUT_MS}ms`;
      }
    }

    const duration = Date.now() - startTime;

    // Record delivery
    await prisma.webhookDelivery.create({
      data: {
        endpointId,
        eventType: 'test',
        payload,
        statusCode,
        responseBody,
        duration,
        success,
        attempt: 1,
        error: deliveryError,
      },
    });

    return NextResponse.json({
      success,
      statusCode,
      duration,
      error: deliveryError,
    });
  } catch (err) {
    console.error('POST /api/projects/[id]/webhooks/test error:', err);
    return NextResponse.json({ error: 'Failed to send test webhook' }, { status: 500 });
  }
}
