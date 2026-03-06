import { taskQueue } from './task-queue';
import { eventBus } from './event-bus';

export class TaskProcessor {
  async processOne(): Promise<boolean> {
    const task = await taskQueue.claimNext();
    if (!task) return false;

    const startTime = Date.now();

    try {
      // Dynamic import to avoid circular dependency with engine
      const { orchestrationEngine } = await import('./engine');

      await orchestrationEngine.process({
        projectId: task.projectId,
        userMessage: task.userMessage,
        targetAgentShortName: task.routedTo,
        userId: task.userId,
      });

      await taskQueue.complete(task.id, {
        latencyMs: Date.now() - startTime,
      });

      await eventBus.emit({
        type: 'task.completed',
        actor: task.routedTo,
        projectId: task.projectId,
        payload: { runId: task.id },
      });

      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      await taskQueue.fail(task.id, errorMsg);

      await eventBus.emit({
        type: 'task.failed',
        actor: task.routedTo,
        projectId: task.projectId,
        payload: { runId: task.id, error: errorMsg },
      });

      return true;
    }
  }

  async processAll(maxTasks = 10): Promise<number> {
    let processed = 0;
    while (processed < maxTasks) {
      const didWork = await this.processOne();
      if (!didWork) break;
      processed++;
    }
    return processed;
  }
}

export const taskProcessor = new TaskProcessor();
