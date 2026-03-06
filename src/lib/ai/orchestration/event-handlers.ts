import { prisma } from '@/lib/prisma';
import { eventBus } from './event-bus';
import { dispatchWebhook } from '@/lib/webhooks';

/**
 * Register all event handlers on the EventBus.
 * Called once when the module is imported.
 */
export function registerEventHandlers(): void {
  // ── Persist ALL events to the Event table for audit trail ──
  eventBus.on('*', async (event) => {
    try {
      if (!event.projectId) return; // Skip events without project context
      await prisma.event.create({
        data: {
          type: event.type,
          actor: event.actor ?? 'system',
          payload: JSON.stringify(event.payload ?? {}),
          projectId: event.projectId,
        },
      });
    } catch (err) {
      console.error('[EventHandler] Failed to persist event:', err);
    }
  });

  // ── Dispatch outbound webhooks for all project events ──
  eventBus.on('*', async (event) => {
    try {
      if (!event.projectId) return;
      await dispatchWebhook(event);
    } catch (err) {
      console.error('[EventHandler] Failed to dispatch outbound webhook:', err);
    }
  });

  // ── Orchestration completion → create user notification ──
  eventBus.on('orchestration.complete', async (event) => {
    try {
      const userId = event.payload?.userId as string | undefined;
      const projectId = event.projectId;
      if (!userId) return;

      const agentName = event.payload?.agentName ?? event.actor ?? 'Agent';
      const summary = event.payload?.summary ?? 'Task completed successfully';

      await prisma.notification.create({
        data: {
          type: 'COMPLETION',
          title: `${agentName} Completed Task`,
          description: typeof summary === 'string' ? summary.slice(0, 200) : 'Task completed successfully',
          userId,
          projectId: projectId ?? null,
        },
      });
    } catch (err) {
      console.error('[EventHandler] Failed to create completion notification:', err);
    }
  });

  // ── Orchestration error → create failure notification ──
  eventBus.on('orchestration.error', async (event) => {
    try {
      const userId = event.payload?.userId as string | undefined;
      const projectId = event.projectId;
      if (!userId) return;

      const agentName = event.payload?.agentName ?? event.actor ?? 'Agent';
      const errorMsg = event.payload?.error ?? 'An error occurred';

      await prisma.notification.create({
        data: {
          type: 'FAILURE',
          title: `${agentName} Failed`,
          description: typeof errorMsg === 'string' ? errorMsg.slice(0, 200) : 'An error occurred during processing',
          userId,
          projectId: projectId ?? null,
        },
      });
    } catch (err) {
      console.error('[EventHandler] Failed to create failure notification:', err);
    }
  });

  // ── Deployment success → create deploy notification ──
  eventBus.on('deployment.success', async (event) => {
    try {
      const userId = event.payload?.userId as string | undefined;
      const projectId = event.projectId;
      if (!userId) return;

      const environment = event.payload?.environment ?? 'unknown';
      const version = event.payload?.version ?? '';

      await prisma.notification.create({
        data: {
          type: 'DEPLOY',
          title: 'Deploy Successful',
          description: `${version ? `${version} ` : ''}deployed to ${environment}`,
          userId,
          projectId: projectId ?? null,
        },
      });
    } catch (err) {
      console.error('[EventHandler] Failed to create deploy success notification:', err);
    }
  });

  // ── Deployment failed → create deploy failure notification ──
  eventBus.on('deployment.failed', async (event) => {
    try {
      const userId = event.payload?.userId as string | undefined;
      const projectId = event.projectId;
      if (!userId) return;

      const environment = event.payload?.environment ?? 'unknown';
      const errorMsg = event.payload?.error ?? 'Deployment failed';

      await prisma.notification.create({
        data: {
          type: 'DEPLOY',
          title: 'Deploy Failed',
          description: `Deployment to ${environment} failed: ${typeof errorMsg === 'string' ? errorMsg.slice(0, 150) : 'Unknown error'}`,
          userId,
          projectId: projectId ?? null,
        },
      });
    } catch (err) {
      console.error('[EventHandler] Failed to create deploy failure notification:', err);
    }
  });

  // ── Agent blocked → create notification ──
  eventBus.on('agent.blocked', async (event) => {
    try {
      const userId = event.payload?.userId as string | undefined;
      const projectId = event.projectId;
      if (!userId) return;

      const agentName = event.payload?.agentName ?? event.actor ?? 'Agent';
      const reason = event.payload?.reason ?? 'Requires your attention';

      await prisma.notification.create({
        data: {
          type: 'AGENT',
          title: `${agentName} Blocked`,
          description: typeof reason === 'string' ? reason.slice(0, 200) : 'Agent needs your attention',
          userId,
          projectId: projectId ?? null,
        },
      });
    } catch (err) {
      console.error('[EventHandler] Failed to create agent blocked notification:', err);
    }
  });

  // ── PR created → create notification ──
  eventBus.on('pr.created', async (event) => {
    try {
      const userId = event.payload?.userId as string | undefined;
      const projectId = event.projectId;
      if (!userId) return;

      const prTitle = event.payload?.title ?? 'Pull Request';
      const prNumber = event.payload?.number ?? '';

      await prisma.notification.create({
        data: {
          type: 'PR',
          title: 'PR Created',
          description: `PR #${prNumber} — ${typeof prTitle === 'string' ? prTitle.slice(0, 150) : 'New pull request'}`,
          userId,
          projectId: projectId ?? null,
        },
      });
    } catch (err) {
      console.error('[EventHandler] Failed to create PR notification:', err);
    }
  });

  // ── Build completed → create notification ──
  eventBus.on('build.complete', async (event) => {
    try {
      const userId = event.payload?.userId as string | undefined;
      const projectId = event.projectId;
      if (!userId) return;

      const success = event.payload?.success;
      const duration = event.payload?.duration ?? '';

      await prisma.notification.create({
        data: {
          type: 'BUILD',
          title: success ? 'Build Passed' : 'Build Failed',
          description: success
            ? `CI pipeline passed${duration ? ` (${duration})` : ''}`
            : `CI pipeline failed${duration ? ` (${duration})` : ''}`,
          userId,
          projectId: projectId ?? null,
        },
      });
    } catch (err) {
      console.error('[EventHandler] Failed to create build notification:', err);
    }
  });
}

// Auto-register handlers when module is first imported
registerEventHandlers();

// Initialize Redis pub/sub for cross-container event propagation (non-blocking)
eventBus.initRedisSubscriber().catch((err) => {
  console.warn('[EventHandlers] Redis subscriber init failed, events will be local-only:', err);
});
