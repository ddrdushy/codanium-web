// =============================================================================
// AI Team Studio — Queue Module Barrel Exports
// =============================================================================

export {
  getOrchestrationQueue,
  addOrchestrationJob,
  QUEUE_NAME,
} from './orchestration-queue';

export type { OrchestrationJobData } from './orchestration-queue';

export { createOrchestrationWorker } from './orchestration-worker';

export {
  getEmailQueue,
  addEmailJob,
  EMAIL_QUEUE_NAME,
} from './email-queue';

export type { EmailJobData } from './email-queue';

export { createEmailWorker } from './email-worker';

export {
  getGitSyncQueue,
  addGitSyncJob,
  GIT_SYNC_QUEUE_NAME,
  addRepeatableGitSync,
  removeRepeatableGitSync,
} from './git-sync-queue';

export type { GitSyncJobData } from './git-sync-queue';

export { createGitSyncWorker } from './git-sync-worker';

export {
  getGitPushQueue,
  addGitPushJob,
  GIT_PUSH_QUEUE_NAME,
} from './git-push-queue';

export type { GitPushJobData } from './git-push-queue';

export { createGitPushWorker } from './git-push-worker';

export {
  getWebhookQueue,
  addWebhookDeliveryJob,
  WEBHOOK_QUEUE_NAME,
} from './webhook-queue';

export type { WebhookDeliveryJobData } from './webhook-queue';

export { createWebhookWorker } from './webhook-worker';

export {
  getCodeExecutionQueue,
  addCodeExecutionJob,
  CODE_EXECUTION_QUEUE_NAME,
} from './code-execution-queue';

export type { CodeExecutionJobData } from './code-execution-queue';

export { createCodeExecutionWorker } from './code-execution-worker';

export { getQueueConnection } from './connection';
