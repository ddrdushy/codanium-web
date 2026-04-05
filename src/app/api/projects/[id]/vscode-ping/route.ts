import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { recordVSCodeHeartbeat } from '@/lib/vscode-bridge';
import { prisma } from '@/lib/prisma';
import { addOrchestrationJob } from '@/lib/queue';
import { isRedisAvailable } from '@/lib/redis';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/vscode-ping
 *
 * Called every 15s by the Codanium Desktop / VS Code extension to signal it
 * is connected and has the given project open. Stores a 30s Redis heartbeat
 * so the agent-loop can verify the IDE is live before running dev agents.
 *
 * Auto-resume: On each ping, checks for WAITING_FOR_VSCODE tasks and
 * re-enqueues them so they retry immediately now that the IDE is connected.
 *
 * Body: { extensionVersion?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const { error } = await requireAuthOrApiKey();
  if (error) return error;

  let extensionVersion = '0.0.0';
  try {
    const body = await request.json();
    extensionVersion = body.extensionVersion ?? '0.0.0';
  } catch { /* body is optional */ }

  await recordVSCodeHeartbeat(projectId, extensionVersion);

  // ── Auto-resume: re-enqueue any tasks waiting for VS Code ──────────────
  let resumed = 0;
  try {
    // Find PENDING tasks that failed with WAITING_FOR_VSCODE and are scheduled in the future
    const waitingTasks = await prisma.orchestrationRun.findMany({
      where: {
        projectId,
        status: 'PENDING',
        isBackground: true,
        errorMessage: 'WAITING_FOR_VSCODE',
      },
      select: { id: true, userId: true },
      take: 5,
    });

    if (waitingTasks.length > 0) {
      const redisUp = await isRedisAvailable();

      for (const task of waitingTasks) {
        // Reset scheduledAt to NOW so it gets picked up immediately
        await prisma.orchestrationRun.update({
          where: { id: task.id },
          data: { scheduledAt: new Date(), errorMessage: null },
        });

        // Dispatch to BullMQ if available
        if (redisUp) {
          try {
            await addOrchestrationJob(
              { runId: task.id, projectId, userId: task.userId },
              { priority: 10 },
            );
          } catch { /* Falls back to Postgres polling */ }
        }

        resumed++;
      }

      if (resumed > 0) {
        console.log(`[VSCodePing] ▶ Resumed ${resumed} WAITING_FOR_VSCODE task(s) for project ${projectId}`);
      }
    }
  } catch (err) {
    console.error('[VSCodePing] Auto-resume check failed:', err);
  }

  return NextResponse.json({ ok: true, projectId, ts: Date.now(), resumed });
}

/**
 * DELETE /api/projects/[id]/vscode-ping
 *
 * Called when the VS Code extension closes or deactivates, to immediately
 * clear the heartbeat rather than waiting for TTL expiry.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const { error } = await requireAuthOrApiKey();
  if (error) return error;

  const { clearVSCodeHeartbeat } = await import('@/lib/vscode-bridge');
  await clearVSCodeHeartbeat(projectId);

  return NextResponse.json({ ok: true });
}
