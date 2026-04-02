// =============================================================================
// Codanium — Deploy Runner
// =============================================================================
// Orchestrates a deployment run end-to-end:
//   1. Find or create the pipeline for the given project + environment
//   2. Create a DeploymentRun record (PENDING)
//   3. Call the appropriate provider (Vercel / Railway / webhook)
//   4. Update the run to SUCCESS or FAILED with logs
// =============================================================================

import { prisma } from '@/lib/prisma';
import {
  triggerVercelDeployHook,
  triggerRailwayDeploy,
  triggerWebhookDeploy,
  type PipelineConfig,
  type DeployTriggerResult,
} from './providers';

export interface RunDeployOptions {
  projectId: string;
  environment: 'staging' | 'production';
  triggeredBy: string;         // agent shortName or userId
  commitHash?: string;
  branch?: string;
}

export interface RunDeployResult {
  success: boolean;
  runId: string;
  pipelineId: string;
  deployUrl?: string;
  externalDeployId?: string;
  logs: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

export async function runDeploy(options: RunDeployOptions): Promise<RunDeployResult> {
  const { projectId, environment, triggeredBy, commitHash = '', branch = '' } = options;
  const envEnum = environment.toUpperCase() as 'STAGING' | 'PRODUCTION';

  // ── 1. Find pipeline for this project + environment ─────────────────────
  let pipeline = await prisma.deploymentPipeline.findFirst({
    where: { projectId, environment: envEnum },
    orderBy: { createdAt: 'asc' },
  });

  // Auto-create a default pipeline if none exists
  if (!pipeline) {
    pipeline = await prisma.deploymentPipeline.create({
      data: {
        name: `${environment} deployment`,
        environment: envEnum,
        trigger: 'MANUAL',
        config: '{}',
        projectId,
      },
    });
  }

  // ── 2. Create run record ─────────────────────────────────────────────────
  const run = await prisma.deploymentRun.create({
    data: {
      pipelineId: pipeline.id,
      status: 'RUNNING',
      currentStage: 'BUILD',
      triggeredBy,
      commitHash,
      branch,
      projectId,
      startedAt: new Date(),
    },
  });

  // ── 3. Parse pipeline config ─────────────────────────────────────────────
  let config: PipelineConfig = {};
  try {
    config = JSON.parse(pipeline.config || '{}');
  } catch {
    config = {};
  }

  // ── 4. Dispatch to provider ──────────────────────────────────────────────
  let result: DeployTriggerResult;

  const provider = config.provider ?? inferProvider(config);

  switch (provider) {
    case 'vercel':
      if (config.vercelDeployHookUrl) {
        result = await triggerVercelDeployHook(config.vercelDeployHookUrl, environment);
      } else {
        result = { success: false, error: 'Vercel provider selected but no deploy hook URL configured. Add vercelDeployHookUrl to pipeline config.' };
      }
      break;

    case 'railway':
      if (config.railwayToken && config.railwayServiceId) {
        result = await triggerRailwayDeploy(config.railwayToken, config.railwayServiceId, config.railwayEnvironmentId);
      } else {
        result = { success: false, error: 'Railway provider selected but railwayToken or railwayServiceId missing in pipeline config.' };
      }
      break;

    case 'webhook':
      if (config.webhookUrl) {
        result = await triggerWebhookDeploy(config.webhookUrl, environment, config.webhookSecret);
      } else {
        result = { success: false, error: 'Webhook provider selected but no webhookUrl configured in pipeline config.' };
      }
      break;

    default:
      result = {
        success: false,
        error: 'No deploy provider configured for this pipeline. Set provider to "vercel", "railway", or "webhook" in pipeline config.',
      };
  }

  // ── 5. Update run with result ─────────────────────────────────────────────
  const logs = result.logs ?? (result.error ?? 'No output');

  await prisma.deploymentRun.update({
    where: { id: run.id },
    data: {
      status: result.success ? 'SUCCESS' : 'FAILED',
      currentStage: result.success ? 'DEPLOY' : 'BUILD',
      deployLogs: logs,
      errorMessage: result.error ?? null,
      completedAt: new Date(),
      durationMs: Date.now() - (run.startedAt?.getTime() ?? Date.now()),
    },
  });

  return {
    success: result.success,
    runId: run.id,
    pipelineId: pipeline.id,
    deployUrl: result.deployUrl,
    externalDeployId: result.externalDeployId,
    logs,
    error: result.error,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Infer the provider from config fields if provider is not explicitly set.
 */
function inferProvider(config: PipelineConfig): string {
  if (config.vercelDeployHookUrl || config.vercelToken) return 'vercel';
  if (config.railwayToken) return 'railway';
  if (config.webhookUrl) return 'webhook';
  return 'none';
}
