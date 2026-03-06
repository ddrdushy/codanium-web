import { prisma } from '@/lib/prisma';
import { eventBus } from './event-bus';

/**
 * Handles Build→Test→Deploy stage progression for DeploymentRuns.
 * Initially simulated — later wired to real Docker/CI processes.
 */
export class DeployProcessor {
  async processRun(runId: string): Promise<void> {
    const run = await prisma.deploymentRun.findUnique({
      where: { id: runId },
      include: { pipeline: true },
    });
    if (!run || run.status !== 'PENDING') return;

    const startTime = Date.now();
    await prisma.deploymentRun.update({
      where: { id: runId },
      data: { status: 'RUNNING', startedAt: new Date(), currentStage: 'BUILD' },
    });

    try {
      // BUILD stage
      await this.appendLog(runId, 'buildLogs', `[${this.timestamp()}] BUILD: Starting build process...`);
      await this.appendLog(runId, 'buildLogs', `[${this.timestamp()}] BUILD: Installing dependencies...`);
      await this.appendLog(runId, 'buildLogs', `[${this.timestamp()}] BUILD: Compiling application...`);
      await this.appendLog(runId, 'buildLogs', `[${this.timestamp()}] BUILD: Build completed successfully.`);

      // TEST stage
      await prisma.deploymentRun.update({ where: { id: runId }, data: { currentStage: 'TEST' } });
      await this.appendLog(runId, 'testLogs', `[${this.timestamp()}] TEST: Running unit tests...`);
      await this.appendLog(runId, 'testLogs', `[${this.timestamp()}] TEST: Running integration tests...`);
      await this.appendLog(runId, 'testLogs', `[${this.timestamp()}] TEST: All tests passed (42 passed, 0 failed).`);

      // DEPLOY stage
      await prisma.deploymentRun.update({ where: { id: runId }, data: { currentStage: 'DEPLOY' } });
      await this.appendLog(runId, 'deployLogs', `[${this.timestamp()}] DEPLOY: Pushing to container registry...`);
      await this.appendLog(runId, 'deployLogs', `[${this.timestamp()}] DEPLOY: Updating service configuration...`);
      await this.appendLog(runId, 'deployLogs', `[${this.timestamp()}] DEPLOY: Rolling out to ${run.pipeline.environment.toLowerCase()}...`);
      await this.appendLog(runId, 'deployLogs', `[${this.timestamp()}] DEPLOY: Health checks passing. Deployment successful.`);

      // SUCCESS
      const durationMs = Date.now() - startTime;
      await prisma.deploymentRun.update({
        where: { id: runId },
        data: {
          status: 'SUCCESS',
          currentStage: 'COMPLETE',
          completedAt: new Date(),
          durationMs,
        },
      });

      await eventBus.emit({
        type: 'deployment.success',
        actor: 'DO',
        projectId: run.projectId,
        payload: { runId, pipelineId: run.pipelineId, environment: run.pipeline.environment, durationMs },
      });
    } catch (err) {
      const durationMs = Date.now() - startTime;
      const errorMsg = err instanceof Error ? err.message : String(err);

      await prisma.deploymentRun.update({
        where: { id: runId },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          durationMs,
          errorMessage: errorMsg,
        },
      });

      await eventBus.emit({
        type: 'deployment.failed',
        actor: 'DO',
        projectId: run.projectId,
        payload: { runId, error: errorMsg },
      });
    }
  }

  private async appendLog(runId: string, field: 'buildLogs' | 'testLogs' | 'deployLogs', message: string): Promise<void> {
    const current = await prisma.deploymentRun.findUnique({
      where: { id: runId },
      select: { [field]: true },
    });
    const currentValue = (current as any)?.[field] ?? '';
    await prisma.deploymentRun.update({
      where: { id: runId },
      data: { [field]: currentValue + message + '\n' },
    });
  }

  private timestamp(): string {
    return new Date().toISOString();
  }
}

export const deployProcessor = new DeployProcessor();
