import { prisma } from '@/lib/prisma';

/**
 * Recalculate project completion percentage based on card states and pipeline phase.
 * Formula: (DONE cards / total cards) * 100, rounded to nearest integer.
 * Also factors in pipeline phase for early stages when no dev cards exist yet.
 */
export async function recalculateProjectCompletion(projectId: string): Promise<number> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { pipelinePhase: true },
  });

  if (!project) return 0;

  const cards = await prisma.card.findMany({
    where: { projectId },
    select: { state: true },
  });

  const totalCards = cards.length;
  if (totalCards === 0) {
    // No cards yet — estimate from pipeline phase
    const phaseProgress: Record<string, number> = {
      PM_GREETING: 2,
      BA_WORKING: 10,
      BA_NEEDS_APPROVAL: 15,
      SA_WORKING: 20,
      SA_NEEDS_APPROVAL: 25,
      DO_WORKING: 35,
      DO_NEEDS_APPROVAL: 40,
      UX_WORKING: 45,
      UX_NEEDS_APPROVAL: 50,
      DEV_WORKING: 60,
      COMPLETE: 100,
    };
    return phaseProgress[project.pipelinePhase ?? ''] ?? 0;
  }

  const doneCards = cards.filter(c => c.state === 'DONE').length;
  const completion = Math.round((doneCards / totalCards) * 100);

  // Update project completion in database
  await prisma.project.update({
    where: { id: projectId },
    data: { completion },
  });

  return completion;
}
