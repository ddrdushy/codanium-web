import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { taskQueue } from '@/lib/ai/orchestration/task-queue';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/:id/tasks
 * List active (PENDING/RUNNING) and recent completed tasks.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuth();
    if (error) return error;

    const [active, recent] = await Promise.all([
      taskQueue.getActiveTasks(projectId),
      taskQueue.getRecentTasks(projectId, 20),
    ]);

    return NextResponse.json({ active, recent });
  } catch (error) {
    console.error('GET /api/projects/[id]/tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}
