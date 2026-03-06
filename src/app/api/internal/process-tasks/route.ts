import { NextRequest, NextResponse } from 'next/server';
import { taskProcessor } from '@/lib/ai/orchestration/task-processor';

export const dynamic = 'force-dynamic';

const INTERNAL_SECRET = process.env.INTERNAL_TASK_SECRET ?? 'dev-task-secret';

/**
 * POST /api/internal/process-tasks
 * Internal endpoint to process background tasks.
 * Protected by x-internal-secret header (no auth session required).
 * Body: { maxTasks?: number }
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-internal-secret');
    if (authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const processed = await taskProcessor.processAll(body.maxTasks ?? 5);

    return NextResponse.json({ processed });
  } catch (error) {
    console.error('POST /api/internal/process-tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to process tasks' },
      { status: 500 }
    );
  }
}
