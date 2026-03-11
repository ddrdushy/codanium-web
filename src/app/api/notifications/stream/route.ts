import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications/stream
 * SSE endpoint for real-time notification delivery.
 * Polls DB every 3s for new notifications and pushes them to the client.
 */
export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthOrApiKey();
  if (error) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = (session.user as any).id;

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastCheck = new Date();
      let alive = true;

      function send(event: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          alive = false;
        }
      }

      // Send initial connection event
      send('connected', { userId, timestamp: new Date().toISOString() });

      // Poll loop
      const pollInterval = setInterval(async () => {
        if (!alive) {
          clearInterval(pollInterval);
          return;
        }

        try {
          // Find notifications created since last check
          const newNotifications = await prisma.notification.findMany({
            where: {
              userId,
              createdAt: { gt: lastCheck },
            },
            include: {
              project: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: 'asc' },
            take: 20,
          });

          if (newNotifications.length > 0) {
            for (const n of newNotifications) {
              send('notification', {
                id: n.id,
                type: n.type,
                title: n.title,
                description: n.description,
                read: n.read,
                actionLabel: n.actionLabel,
                actionHref: n.actionHref,
                projectId: n.projectId,
                project: n.project,
                createdAt: n.createdAt.toISOString(),
              });
            }
            // Update lastCheck to the most recent notification time
            lastCheck = newNotifications[newNotifications.length - 1].createdAt;
          }
        } catch (err) {
          console.error('[NotificationStream] Poll error:', err);
        }
      }, 3000);

      // Heartbeat to keep connection alive
      const heartbeatInterval = setInterval(() => {
        if (!alive) {
          clearInterval(heartbeatInterval);
          return;
        }
        send('heartbeat', { timestamp: new Date().toISOString() });
      }, 15000);

      // Clean up when client disconnects
      request.signal.addEventListener('abort', () => {
        alive = false;
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
