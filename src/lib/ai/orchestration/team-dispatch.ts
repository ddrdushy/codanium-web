// =============================================================================
// AI Team Studio — Parallel Team Dispatch
// =============================================================================
// Spawns multiple agent runs in parallel under a shared parent coordinator run.
// Each task is enqueued as a background OrchestrationRun with parentRunId set.
// The parent run acts as the "team coordinator" — its status reflects the
// aggregate state of all child runs.
//
// Usage:
//   const result = await dispatchTeam({
//     projectId, userId,
//     goal: 'Build authentication system',
//     tasks: [
//       { agentShortName: 'JD', instruction: 'Implement login/signup API routes' },
//       { agentShortName: 'UX', instruction: 'Build login and signup UI screens' },
//       { agentShortName: 'QA', instruction: 'Write integration tests for auth flow' },
//     ],
//   });
// =============================================================================

import { prisma } from '@/lib/prisma';
import { taskQueue } from './task-queue';
import { eventBus } from './event-bus';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TeamTask {
  agentShortName: string;
  instruction: string;
  priority?: number;
  cardId?: string;
}

export interface TeamDispatchResult {
  teamId: string;   // parent coordinator run ID
  runIds: string[]; // child run IDs (one per task)
  tasksCount: number;
}

export interface TeamStatus {
  teamId: string;
  goal: string;
  overallStatus: 'running' | 'completed' | 'failed' | 'partial';
  tasksCount: number;
  completedCount: number;
  failedCount: number;
  tasks: Array<{
    runId: string;
    agentShortName: string;
    instruction: string;
    status: string;
    startedAt: Date | null;
    completedAt: Date | null;
    latencyMs: number;
    errorMessage: string | null;
  }>;
  createdAt: Date;
  completedAt: Date | null;
}

// ---------------------------------------------------------------------------
// Dispatch a parallel team
// ---------------------------------------------------------------------------

export async function dispatchTeam(params: {
  projectId: string;
  userId: string;
  goal: string;
  tasks: TeamTask[];
}): Promise<TeamDispatchResult> {
  const { projectId, userId, goal, tasks } = params;

  if (tasks.length === 0) {
    throw new Error('Team dispatch requires at least one task');
  }
  if (tasks.length > 10) {
    throw new Error('Maximum 10 parallel tasks per team');
  }

  // 1. Create parent coordinator run (tracks team as a unit)
  const parent = await prisma.orchestrationRun.create({
    data: {
      status: 'RUNNING',
      userMessage: goal,
      routedTo: 'TEAM',
      autoRouted: false,
      isBackground: true,
      projectId,
      userId,
      startedAt: new Date(),
    },
  });

  // 2. Enqueue all child tasks in parallel
  const runIds = await Promise.all(
    tasks.map((task) =>
      taskQueue.enqueue({
        projectId,
        userId,
        userMessage: task.instruction,
        targetAgent: task.agentShortName,
        autoRouted: false,
        isBackground: true,
        priority: task.priority ?? 10, // 10 = background task (lowest priority)
        parentRunId: parent.id,
        cardId: task.cardId,
      }),
    ),
  );

  // 3. Emit team start event (picked up by event-handlers.ts for SSE + audit)
  await eventBus.emit({
    type: 'team.started',
    actor: 'system',
    projectId,
    payload: {
      teamId: parent.id,
      goal,
      tasksCount: tasks.length,
      agents: tasks.map((t) => t.agentShortName),
    },
  });

  return { teamId: parent.id, runIds, tasksCount: tasks.length };
}

// ---------------------------------------------------------------------------
// Resolve team status from DB
// ---------------------------------------------------------------------------

export async function getTeamStatus(
  teamId: string,
  projectId: string,
): Promise<TeamStatus | null> {
  const parent = await prisma.orchestrationRun.findFirst({
    where: { id: teamId, projectId, routedTo: 'TEAM' },
  });

  if (!parent) return null;

  const children = await prisma.orchestrationRun.findMany({
    where: { parentRunId: teamId, projectId },
    orderBy: { createdAt: 'asc' },
  });

  const completedCount = children.filter((c) => c.status === 'COMPLETED').length;
  const failedCount = children.filter((c) => ['FAILED', 'CANCELLED', 'TIMEOUT'].includes(c.status)).length;
  const runningCount = children.filter((c) => ['PENDING', 'RUNNING'].includes(c.status)).length;

  let overallStatus: TeamStatus['overallStatus'];
  if (runningCount > 0) {
    overallStatus = 'running';
  } else if (failedCount > 0 && completedCount > 0) {
    overallStatus = 'partial';
  } else if (failedCount === children.length) {
    overallStatus = 'failed';
  } else {
    overallStatus = 'completed';
  }

  return {
    teamId: parent.id,
    goal: parent.userMessage,
    overallStatus,
    tasksCount: children.length,
    completedCount,
    failedCount,
    tasks: children.map((c) => ({
      runId: c.id,
      agentShortName: c.routedTo,
      instruction: c.userMessage,
      status: c.status,
      startedAt: c.startedAt,
      completedAt: c.completedAt,
      latencyMs: c.latencyMs,
      errorMessage: c.errorMessage,
    })),
    createdAt: parent.createdAt,
    completedAt: parent.completedAt,
  };
}

// ---------------------------------------------------------------------------
// Mark parent run complete once all children have finished
// Called by the orchestration worker after each child completes.
// ---------------------------------------------------------------------------

export async function maybeCompleteTeam(
  parentRunId: string,
  projectId: string,
): Promise<void> {
  const parent = await prisma.orchestrationRun.findFirst({
    where: { id: parentRunId, routedTo: 'TEAM', status: 'RUNNING' },
  });
  if (!parent) return;

  const children = await prisma.orchestrationRun.findMany({
    where: { parentRunId, projectId },
    select: { status: true },
  });

  const allDone = children.every((c) =>
    ['COMPLETED', 'FAILED', 'CANCELLED', 'TIMEOUT'].includes(c.status),
  );
  if (!allDone) return;

  const anyFailed = children.some((c) =>
    ['FAILED', 'CANCELLED', 'TIMEOUT'].includes(c.status),
  );

  await prisma.orchestrationRun.update({
    where: { id: parentRunId },
    data: {
      status: anyFailed ? 'FAILED' : 'COMPLETED',
      completedAt: new Date(),
    },
  });

  await eventBus.emit({
    type: 'team.completed',
    actor: 'system',
    projectId,
    payload: {
      teamId: parentRunId,
      anyFailed,
      completedCount: children.filter((c) => c.status === 'COMPLETED').length,
      failedCount: children.filter((c) => c.status !== 'COMPLETED').length,
    },
  });
}
