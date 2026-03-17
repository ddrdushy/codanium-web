import { prisma } from '@/lib/prisma';
import { getAllAgentDefinitions } from '@/lib/ai/agents/registry';
import { taskQueue } from '@/lib/ai/orchestration/task-queue';
import { initializeRepo } from '@/lib/git/repo-manager';

// ── Constants ────────────────────────────────────────────────────────────────

const SDLC_STAGES = [
  'Business Analysis',
  'Architecture',
  'UI/UX Design',
  'Planning',
  'Development',
  'Code Review',
  'Testing',
  'Release',
  'Monitoring',
  'Iteration',
] as const;

const AGENT_AVATARS: Record<string, string> = {
  ORC: '\u{1F3AF}', STC: '\u26A1',     DEC: '\u2696\uFE0F', AUD: '\u{1F6E1}\uFE0F', SEC: '\u{1F512}',
  BA:  '\u{1F4CB}', SA:  '\u{1F3D7}\uFE0F', UX:  '\u{1F3A8}',  PM:  '\u{1F4CA}',  TL:  '\u{1F451}',
  JD:  '\u{1F4BB}', SD:  '\u{1F50D}', QA:  '\u{1F9EA}',  AT:  '\u{1F916}',  PF:  '\u26A1',
  PE:  '\u{1F527}', DO:  '\u{1F680}', IE:  '\u{1F50C}',  SM:  '\u{1F511}',  SR:  '\u{1F4E1}',
  LLM: '\u{1F9E0}', PRE: '\u270D\uFE0F',  CA:  '\u{1F4B0}',
};

// ── Seed Function ────────────────────────────────────────────────────────────

export interface SeedProjectResult {
  agentCount: number;
  stageCount: number;
}

export async function seedProject(projectId: string): Promise<SeedProjectResult> {
  const definitions = getAllAgentDefinitions();

  // Map agent definitions to DB records
  const agentData = definitions.map((def) => ({
    name: def.name,
    shortName: def.shortName,
    group: def.group as 'GOVERNANCE' | 'SDLC' | 'ENGINEERING' | 'PLATFORM' | 'AI_COST',
    status: 'IDLE' as const,
    avatar: AGENT_AVATARS[def.shortName] ?? '\u{1F916}',
    projectId,
  }));

  // Map SDLC stages to DB records
  const stageData = SDLC_STAGES.map((name, index) => ({
    name,
    order: index + 1,
    status: (index === 0 ? 'ACTIVE' : 'PENDING') as 'ACTIVE' | 'PENDING',
    gatePassed: false,
    projectId,
  }));

  // Atomic batch insert
  const [agentResult, stageResult] = await prisma.$transaction([
    prisma.agent.createMany({ data: agentData, skipDuplicates: true }),
    prisma.sDLCStage.createMany({ data: stageData, skipDuplicates: true }),
  ]);

  // Initialize the project's "main" branch (DB-backed Git)
  try {
    await initializeRepo(projectId);
  } catch (err) {
    console.error(`[seedProject] Failed to initialize repo for ${projectId}:`, err);
  }

  return {
    agentCount: agentResult.count,
    stageCount: stageResult.count,
  };
}

// ── Auto-Kickoff BA Agent ────────────────────────────────────────────────────

export async function autoKickoffBA(
  projectId: string,
  projectDescription: string,
  userId: string,
): Promise<string> {
  // 1. Fetch structured project memories to build a rich brief
  const projectMemories = await prisma.projectMemory.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  let briefParts: string[] = [];
  for (const mem of projectMemories) {
    briefParts.push(`- ${mem.content}`);
  }
  const structuredBrief = briefParts.length > 0
    ? `Here is what the stakeholder provided during project setup:\n${briefParts.join('\n')}`
    : `Project description: ${projectDescription}`;

  // Create system message as the initial trigger
  await prisma.chatMessage.create({
    data: {
      role: 'SYSTEM',
      content: `New project created.\n\n${structuredBrief}\n\nIMPORTANT: The stakeholder already provided the above information. Do NOT re-ask questions they already answered. Start your discovery from where they left off — acknowledge what you know and ask the NEXT relevant question.`,
      projectId,
    },
  });

  // 2. Enqueue background orchestration job targeting BA agent
  const runId = await taskQueue.enqueue({
    projectId,
    userId,
    userMessage: projectDescription,
    targetAgent: 'BA',
    autoRouted: false,
    isBackground: true,
    priority: 10,
  });

  // 3. Trigger background processing as fallback (only if BullMQ is unavailable)
  //    BullMQ worker handles this automatically. The fetch is a safety net for
  //    environments without Redis. Using setTimeout to give BullMQ time to claim first.
  setTimeout(async () => {
    try {
      const { isRedisAvailable } = await import('@/lib/redis');
      const redisUp = await isRedisAvailable();
      if (redisUp) return; // BullMQ worker will handle it

      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      fetch(`${baseUrl}/api/internal/process-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_TASK_SECRET ?? 'dev-task-secret',
        },
        body: JSON.stringify({ maxTasks: 5 }),
      }).catch((err) => console.error('[autoKickoffBA] trigger error:', err));
    } catch {
      // Fallback: try process-tasks anyway
      const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
      fetch(`${baseUrl}/api/internal/process-tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-secret': process.env.INTERNAL_TASK_SECRET ?? 'dev-task-secret',
        },
        body: JSON.stringify({ maxTasks: 5 }),
      }).catch(() => {});
    }
  }, 2000);

  return runId;
}
