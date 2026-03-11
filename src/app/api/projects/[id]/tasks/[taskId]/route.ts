import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { taskQueue } from '@/lib/ai/orchestration/task-queue';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string; taskId: string }>;
}

/**
 * GET /api/projects/:id/tasks/:taskId
 * Get task status.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, taskId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const task = await taskQueue.getStatus(taskId);

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(task);
  } catch (error) {
    console.error('GET /api/projects/[id]/tasks/[taskId] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task status' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/projects/:id/tasks/:taskId
 * Cancel a task.
 * Body: { action: 'cancel' }
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId, taskId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();

    if (body.action !== 'cancel') {
      return NextResponse.json(
        { error: 'Invalid action. Only "cancel" is supported.' },
        { status: 400 }
      );
    }

    // Verify task exists before cancelling
    const task = await taskQueue.getStatus(taskId);

    if (!task) {
      return NextResponse.json(
        { error: 'Task not found' },
        { status: 404 }
      );
    }

    if (task.status !== 'PENDING' && task.status !== 'RUNNING') {
      return NextResponse.json(
        { error: 'Task cannot be cancelled in its current state' },
        { status: 400 }
      );
    }

    await taskQueue.cancel(taskId);

    return NextResponse.json({ success: true, id: taskId, status: 'CANCELLED' });
  } catch (error) {
    console.error('PATCH /api/projects/[id]/tasks/[taskId] error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel task' },
      { status: 500 }
    );
  }
}
