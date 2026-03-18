import { taskQueue } from './task-queue';
import { eventBus } from './event-bus';

export class TaskProcessor {
  async processOne(): Promise<boolean> {
    const task = await taskQueue.claimNext();
    if (!task) return false;

    const startTime = Date.now();

    try {
      // Dynamic import to avoid circular dependency
      const { buildOrchestrationGraph } = await import('./graph/build-graph');

      const { graph, collector } = buildOrchestrationGraph();

      const initialState = {
        projectId: task.projectId,
        userId: task.userId,
        userMessage: task.userMessage,
        targetAgentShortName: task.routedTo,
        inputGuardrailResult: null,
        routedAgent: '',
        routedIntent: '',
        systemMessage: '',
        recentHistory: [],
        llmMessages: [],
        tokenBudgetRemaining: null,
        rawContent: '',
        rawThinking: '',
        tokensUsed: null,
        parsedResponse: null,
        savedMessageId: '',
        outputGuardrailResult: null,
        shouldDelegate: false,
        delegationDepth: 0,
        toolCalls: [],
        toolResults: [],
        toolLoopCount: 0,
        toolErrorCount: 0,
        completedToolSignals: [],
        recentToolCalls: [],
        recentResponses: [],
      };

      // Run the graph without streaming (background mode)
      // Consume all events silently — no SSE writer in background mode
      const graphStream = await graph.stream(initialState, {
        streamMode: 'custom',
      });

      // Drain the stream to ensure all processing completes
      for await (const _event of graphStream) {
        // Events are discarded in background mode
      }

      // Finalize telemetry (non-blocking)
      collector.finalize().catch(() => {});

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
