// =============================================================================
// AI Team Studio — Worker Entrypoint
// =============================================================================
// Standalone Node.js process that runs BullMQ workers for background job
// processing. This is NOT a Next.js application — it is a plain Node script
// that the ats-worker Docker container runs via `node worker.js`.
//
// The worker:
//   1. Imports event handlers (auto-registers on module load)
//   2. Initializes Redis pub/sub on the EventBus
//   3. Creates the BullMQ orchestration worker
//   4. Handles SIGTERM/SIGINT for graceful shutdown
// =============================================================================

// Import event handlers so they auto-register (same as in the app container)
import '@/lib/ai/orchestration/event-handlers';

import { eventBus } from '@/lib/ai/orchestration/event-bus';
import { createOrchestrationWorker } from './orchestration-worker';
import { createEmailWorker } from './email-worker';
import { createGitSyncWorker } from './git-sync-worker';
import { createGitPushWorker } from './git-push-worker';
import { createWebhookWorker } from './webhook-worker';

async function main() {
  console.log('AI Team Studio — Worker starting...');

  // Initialize Redis pub/sub for cross-container event propagation
  await eventBus.initRedisSubscriber();

  // Start BullMQ workers
  const orchWorker = createOrchestrationWorker();
  const emailWorker = createEmailWorker();
  const gitSyncWorker = createGitSyncWorker();
  const gitPushWorker = createGitPushWorker();
  const webhookWorker = createWebhookWorker();

  console.log('[Worker] Orchestration worker started');
  console.log('[Worker] Email worker started');
  console.log('[Worker] Git Sync worker started');
  console.log('[Worker] Git Push worker started');
  console.log('[Worker] Webhook Delivery worker started');

  // ── Graceful Shutdown ───────────────────────────────────────────────────

  async function shutdown(signal: string) {
    console.log(`[Worker] Received ${signal}, shutting down gracefully...`);
    await Promise.all([
      orchWorker.close(),
      emailWorker.close(),
      gitSyncWorker.close(),
      gitPushWorker.close(),
      webhookWorker.close(),
    ]);
    console.log('[Worker] All workers closed. Exiting.');
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  console.log('AI Team Studio — Worker running, listening for jobs...');
}

main().catch((err) => {
  console.error('[Worker] Fatal error during startup:', err);
  process.exit(1);
});
