import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/activity/stream
 * SSE endpoint for real-time project activity events.
 * Polls the Event table for project-level events every 3s.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
      send('connected', { projectId, timestamp: new Date().toISOString() });

      // Poll loop — check for new events every 3s
      const pollInterval = setInterval(async () => {
        if (!alive) {
          clearInterval(pollInterval);
          return;
        }

        try {
          const newEvents = await prisma.event.findMany({
            where: {
              projectId,
              createdAt: { gt: lastCheck },
            },
            orderBy: { createdAt: 'asc' },
            take: 20,
          });

          if (newEvents.length > 0) {
            for (const evt of newEvents) {
              // Determine activity category from event type
              const category = categorizeEvent(evt.type);

              send('activity', {
                id: evt.id,
                type: evt.type,
                category,
                actor: evt.actor,
                payload: safeParseJSON(evt.payload),
                timestamp: evt.createdAt.toISOString(),
              });
            }
            lastCheck = newEvents[newEvents.length - 1].createdAt;
          }
        } catch (err) {
          console.error('[ActivityStream] Poll error:', err);
        }
      }, 3000);

      // Heartbeat every 15s
      const heartbeatInterval = setInterval(() => {
        if (!alive) {
          clearInterval(heartbeatInterval);
          return;
        }
        send('heartbeat', { timestamp: new Date().toISOString() });
      }, 15000);

      // Cleanup on client disconnect
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

/**
 * Categorize an event type into a UI-friendly category.
 */
function categorizeEvent(type: string): string {
  if (type.startsWith('agent.') || type.includes('orchestration')) return 'agent_status';
  if (type.startsWith('task.') || type.includes('card')) return 'task_update';
  if (type.startsWith('deployment.') || type.includes('deploy')) return 'deployment_update';
  if (type.startsWith('pr.') || type.includes('git')) return 'code_update';
  if (type.startsWith('build.')) return 'build_update';
  return 'member_activity';
}

/**
 * Safely parse JSON payload, returning empty object on failure.
 */
function safeParseJSON(str: string): Record<string, unknown> {
  try {
    return JSON.parse(str);
  } catch {
    return {};
  }
}
