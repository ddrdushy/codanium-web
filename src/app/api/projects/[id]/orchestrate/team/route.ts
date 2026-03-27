import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';
import { dispatchTeam, getTeamStatus } from '@/lib/ai/orchestration/team-dispatch';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// POST /api/projects/:id/orchestrate/team
// ---------------------------------------------------------------------------
// Kick off a parallel multi-agent team run.
//
// Body:
//   { goal: string, tasks: [{ agentShortName: string, instruction: string, cardId?: string }] }
//
// Returns:
//   { teamId, runIds, tasksCount }
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const userId = (session.user as any)?.id;

    const membership = await prisma.projectMember.findFirst({
      where: { projectId, userId },
    });
    if (!membership) {
      return NextResponse.json({ error: 'Not a member of this project' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { goal, tasks } = body as {
      goal?: string;
      tasks?: Array<{ agentShortName?: string; instruction?: string; cardId?: string }>;
    };

    if (!goal || typeof goal !== 'string' || goal.trim().length === 0) {
      return NextResponse.json({ error: 'goal is required' }, { status: 400 });
    }
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'tasks array is required and must not be empty' }, { status: 400 });
    }
    if (tasks.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 parallel tasks per team' }, { status: 400 });
    }

    const validated = tasks.map((t, i) => {
      if (!t.agentShortName || !t.instruction) {
        throw new Error(`tasks[${i}] must have agentShortName and instruction`);
      }
      return {
        agentShortName: t.agentShortName,
        instruction: t.instruction,
        cardId: t.cardId,
      };
    });

    const result = await dispatchTeam({
      projectId,
      userId,
      goal: goal.trim(),
      tasks: validated,
    });

    return NextResponse.json(result, { status: 202 });
  } catch (err: any) {
    console.error('POST /orchestrate/team error:', err);
    return NextResponse.json({ error: err.message ?? 'Failed to dispatch team' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// GET /api/projects/:id/orchestrate/team?teamId=xxx
// ---------------------------------------------------------------------------
// Poll team execution status.
//
// Returns:
//   { teamId, goal, overallStatus, tasksCount, completedCount, failedCount, tasks[], ... }
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { error } = await requireAuthOrApiKey();
    if (error) return error;

    const { id: projectId } = await params;
    const teamId = request.nextUrl.searchParams.get('teamId');

    if (!teamId) {
      return NextResponse.json({ error: 'teamId query param is required' }, { status: 400 });
    }

    const status = await getTeamStatus(teamId, projectId);
    if (!status) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 });
    }

    return NextResponse.json(status);
  } catch (err: any) {
    console.error('GET /orchestrate/team error:', err);
    return NextResponse.json({ error: 'Failed to fetch team status' }, { status: 500 });
  }
}
