import { NextRequest } from 'next/server';
import { orchestrationEngine } from '@/lib/ai';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/chat/stream
 * SSE streaming endpoint for AI chat with orchestration.
 * Body: { content: string, agentShortName?: string, userId?: string }
 * Returns: text/event-stream with SSE events
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const body = await request.json();

  if (!body.content?.trim()) {
    return new Response(JSON.stringify({ error: 'Content is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function sendEvent(type: string, data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        const generator = orchestrationEngine.processStream({
          projectId,
          userMessage: body.content.trim(),
          targetAgentShortName: body.agentShortName ?? undefined,
          userId: body.userId ?? 'demo-user',
        });

        for await (const event of generator) {
          sendEvent(event.type, event.data);
        }
      } catch (error) {
        console.error('Stream error:', error);
        sendEvent('error', { message: 'An error occurred processing your request' });
      } finally {
        controller.close();
      }
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
