import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { taskQueue } from '@/lib/ai/orchestration/task-queue';
import { buildOrchestrationGraph } from '@/lib/ai/orchestration/graph/build-graph';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/chat/stream
 * SSE streaming endpoint for AI chat with orchestration.
 * Body: { content: string, agentShortName?: string, userId?: string, background?: boolean }
 * Returns: text/event-stream with SSE events (interactive mode)
 *          or JSON { taskId, status } (background mode)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { session, error } = await requireAuthOrApiKey();
  if (error) return error;
  const body = await request.json();

  if (!body.content?.trim()) {
    return new Response(JSON.stringify({ error: 'Content is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const userId = (session.user as any).id;
  const isBackground = body.background === true;
  const targetAgent = body.agentShortName ?? 'BA'; // Default to BA

  const cardId = body.cardId ?? undefined;

  // Create tracking record
  const runId = await taskQueue.enqueue({
    projectId,
    userId,
    userMessage: body.content.trim(),
    targetAgent,
    autoRouted: !body.agentShortName,
    isBackground,
    cardId,
  });

  if (isBackground) {
    // Fire-and-forget to trigger background processing
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    fetch(`${baseUrl}/api/internal/process-tasks`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_TASK_SECRET ?? 'dev-task-secret',
      },
      body: JSON.stringify({ maxTasks: 5 }),
    }).catch(err => console.error('[triggerBackgroundProcessing]', err));

    return NextResponse.json({ taskId: runId, status: 'PENDING' });
  }

  // Interactive SSE mode - mark as RUNNING immediately
  await prisma.orchestrationRun.update({
    where: { id: runId },
    data: { status: 'RUNNING', startedAt: new Date() },
  });

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function sendEvent(type: string, data: Record<string, unknown>) {
        controller.enqueue(
          encoder.encode(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`)
        );
      }

      try {
        // ── LangGraph Orchestration ────────────────────────────────────
        // NOTE: User message is already saved by the chat page (POST /api/projects/[id]/chat)
        // Do NOT save again here — it causes duplicate messages.

        const graph = buildOrchestrationGraph();

        const initialState = {
          projectId,
          userId,
          userMessage: body.content.trim(),
          targetAgentShortName: body.agentShortName ?? undefined,
          inputGuardrailResult: null,
          routedAgent: '',
          routedIntent: '',
          systemMessage: '',
          recentHistory: [],
          llmMessages: [],
          tokenBudgetRemaining: null,
          rawContent: '',
          rawThinking: '',
          tokensUsed: null,
          parsedResponse: null,
          savedMessageId: '',
          outputGuardrailResult: null,
          shouldDelegate: false,
          delegationDepth: 0,
          toolCalls: [],
          toolResults: [],
          toolLoopCount: 0,
          completedToolSignals: [],
        };

        const graphStream = await graph.stream(initialState, {
          streamMode: 'custom',
        });

        for await (const event of graphStream) {
          const sseEvent = event as { type: string; data: Record<string, unknown> };
          if (sseEvent.type && sseEvent.data) {
            sendEvent(sseEvent.type, sseEvent.data);
          }
        }

        // Mark OrchestrationRun as completed
        await prisma.orchestrationRun.update({
          where: { id: runId },
          data: { status: 'COMPLETED', completedAt: new Date() },
        });
      } catch (streamError) {
        console.error('Stream error:', streamError);
        sendEvent('error', { message: 'An error occurred processing your request' });

        // Mark OrchestrationRun as failed
        await prisma.orchestrationRun.update({
          where: { id: runId },
          data: {
            status: 'FAILED',
            completedAt: new Date(),
            errorMessage: streamError instanceof Error ? streamError.message : String(streamError),
          },
        });
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
