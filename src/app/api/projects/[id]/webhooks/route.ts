import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { randomBytes } from 'crypto';
import { validateBody } from '@/lib/validations/validate';
import { createWebhookSchema } from '@/lib/validations/schemas';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/webhooks
 * List all outbound webhook endpoints for a project (with last 5 deliveries each).
 */
export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id } = await context.params;

    // Verify membership
    const userId = (session.user as any)?.id;
    const membership = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: id, userId } },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    const endpoints = await prisma.webhookEndpoint.findMany({
      where: { projectId: id },
      include: {
        deliveries: {
          orderBy: { deliveredAt: 'desc' },
          take: 5,
          select: {
            id: true,
            eventType: true,
            statusCode: true,
            success: true,
            duration: true,
            deliveredAt: true,
            error: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Redact secrets in response
    const result = endpoints.map((ep) => ({
      ...ep,
      secret: '***',
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error('GET /api/projects/[id]/webhooks error:', err);
    return NextResponse.json({ error: 'Failed to load webhooks' }, { status: 500 });
  }
}

/**
 * POST /api/projects/[id]/webhooks
 * Create a new outbound webhook endpoint.
 *
 * Body: { url, events?, description? }
 * Returns the endpoint with the secret (shown only once).
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
        { error: 'Only project owners and admins can manage webhooks' },
        { status: 403 },
      );
    }

    const body = await request.json();
    const { data, error: validationError } = validateBody(createWebhookSchema, body);
    if (validationError) return validationError;

    // Generate shared secret
    const secret = randomBytes(32).toString('hex');

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        url: data.url,
        secret,
        events: data.events ?? [],
        description: data.description ?? '',
        projectId: id,
      },
    });

    // Return with secret visible (only shown once)
    return NextResponse.json(endpoint, { status: 201 });
  } catch (err) {
    console.error('POST /api/projects/[id]/webhooks error:', err);
    return NextResponse.json({ error: 'Failed to create webhook' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[id]/webhooks?id=<endpointId>
 * Delete an outbound webhook endpoint (cascade deletes deliveries).
 */
export async function DELETE(
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
        { error: 'Only project owners and admins can manage webhooks' },
        { status: 403 },
      );
    }

    const endpointId = request.nextUrl.searchParams.get('id');
    if (!endpointId) {
      return NextResponse.json({ error: 'Webhook endpoint ID is required' }, { status: 400 });
    }

    // Verify the endpoint belongs to this project
    const endpoint = await prisma.webhookEndpoint.findUnique({
      where: { id: endpointId },
    });

    if (!endpoint || endpoint.projectId !== id) {
      return NextResponse.json({ error: 'Webhook endpoint not found' }, { status: 404 });
    }

    await prisma.webhookEndpoint.delete({ where: { id: endpointId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('DELETE /api/projects/[id]/webhooks error:', err);
    return NextResponse.json({ error: 'Failed to delete webhook' }, { status: 500 });
  }
}
