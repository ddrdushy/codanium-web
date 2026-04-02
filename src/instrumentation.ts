/**
 * Next.js Instrumentation — runs once on server startup.
 * Used to clean up stale state from previous container restarts.
 */
export async function register() {
  // Only run on the Node.js runtime (not edge)
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    try {
      const { prisma } = await import('@/lib/prisma');

      // Reset all agents to IDLE on startup — prevents "stuck working" state
      // after container restart mid-processing.
      const result = await prisma.agent.updateMany({
        where: { status: { not: 'IDLE' } },
        data: { status: 'IDLE', currentTask: null },
      });
      if (result.count > 0) {
        console.log(`[Startup] Reset ${result.count} agents from stale working state to IDLE`);
      }

      // Mark any RUNNING orchestration runs as FAILED
      const staleRuns = await prisma.orchestrationRun.updateMany({
        where: { status: 'RUNNING' },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          errorMessage: 'Server restarted while processing',
        },
      });
      if (staleRuns.count > 0) {
        console.log(`[Startup] Marked ${staleRuns.count} stale orchestration runs as FAILED`);
      }

      // Clear stale user presence records
      await prisma.userPresence.deleteMany({});
      console.log('[Startup] Cleared user presence records');
    } catch (err) {
      console.warn('[Startup] Cleanup failed (non-fatal):', err);
    }
  }
}
