import { taskQueue } from './task-queue';
import { eventBus } from './event-bus';
import { agentLoop } from './agent-loop';
import { isVSCodeConnected } from '@/lib/vscode-bridge';

// Development agents that must run from VS Code (code writers only)
// TL (coordinator) and SEC (reviewer) are NOT gated — they don't write files
const DEV_AGENTS = new Set(['JD', 'SD', 'QA', 'DO', 'PE', 'IE']);

export class TaskProcessor {
  async processOne(): Promise<boolean> {
    const task = await taskQueue.claimNext();
    if (!task) return false;

    // ── VS Code Gate for background dev tasks ────────────────────────────
    // If this task targets a development agent, verify VS Code is connected.
    // If not, re-queue the task and emit a notification so the web UI shows
    // the "Open VS Code" banner.
    if (task.routedTo && DEV_AGENTS.has(task.routedTo)) {
      const vsConnected = await isVSCodeConnected(task.projectId);
      if (!vsConnected) {
        console.log(`[TaskProcessor] ⏸ VS Code not connected — re-queuing ${task.routedTo} task ${task.id}`);
        // Mark as pending again so it can be picked up when VS Code connects
        await taskQueue.fail(task.id, 'WAITING_FOR_VSCODE');
        await eventBus.emit({
          type: 'project.stream',
          actor: task.routedTo,
          projectId: task.projectId,
          payload: {
            type: 'vscode_required',
            data: {
              agent: task.routedTo,
              message: `Development agent ${task.routedTo} is waiting for VS Code. Open VS Code with the Codanium extension to continue.`,
              deepLink: `vscode://codanium/resume?projectId=${task.projectId}`,
            },
          },
        });
        return false; // Signal: nothing was processed, keep queue alive
      }
    }

    const startTime = Date.now();

    try {
      const events = agentLoop({
        projectId: task.projectId,
        userId: task.userId,
        userMessage: task.userMessage,
        targetAgentShortName: task.routedTo,
        isPipeline: true,
      });

      // Broadcast the generator events over EventBus so connected clients can watch the stream.
      // Track if the agent was gated by VS Code so we can re-queue instead of completing.
      let vsCodeGated = false;

      for await (const _event of events) {
        const evt = _event as unknown as Record<string, unknown>;
        if (evt.type === 'vscode_required') {
          vsCodeGated = true;
        }
        await eventBus.emit({
          type: 'project.stream',
          actor: task.routedTo,
          projectId: task.projectId,
          payload: evt,
        });
      }

      // If the agent-loop halted due to VS Code gate, re-queue as WAITING_FOR_VSCODE
      // so it auto-resumes when the IDE heartbeat arrives.
      if (vsCodeGated) {
        console.log(`[TaskProcessor] Agent-loop gated by VS Code — re-queuing ${task.routedTo} task ${task.id}`);
        await taskQueue.fail(task.id, 'WAITING_FOR_VSCODE');
        return false;
      }

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
