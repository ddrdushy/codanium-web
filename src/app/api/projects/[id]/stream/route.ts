import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { eventBus } from '@/lib/ai/orchestration/event-bus';
import { SystemEvent } from '@/lib/ai/orchestration/types';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/stream
 * Global SSE stream for real-time background agent updates.
 * Clients subscribe to this route to see background agents "thinking".
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { session, error } = await requireAuthOrApiKey();
  if (error) return error;

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function sendEvent(type: string, data: any) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch (err) {
          // stream may be closed
        }
      }

      const handler = async (event: SystemEvent) => {
        if (event.projectId === projectId && event.type === 'project.stream') {
          const payload = event.payload as unknown as { type: string; data: any };
          sendEvent(payload.type, payload.data);
        }
      };

      eventBus.on('project.stream', handler);

      // Cleanup when client disconnects
      request.signal.addEventListener('abort', () => {
        eventBus.off('project.stream', handler);
        try {
          controller.close();
        } catch {
          // ignore already closed
        }
      });
    },
    cancel() {
      // In case abort event didn't fire
    }
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
