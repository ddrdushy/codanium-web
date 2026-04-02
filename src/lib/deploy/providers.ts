// =============================================================================
// Codanium — Deploy Providers
// =============================================================================
// Provider-specific deploy trigger implementations.
// Each provider receives the pipeline config JSON and triggers a deployment,
// returning a DeployTriggerResult with status + optional external URL.
// =============================================================================

export type DeployProvider = 'vercel' | 'railway' | 'webhook';

export interface DeployTriggerResult {
  success: boolean;
  externalDeployId?: string;   // e.g. Vercel job ID, Railway deployment ID
  deployUrl?: string;           // live URL once deployed
  logs?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Pipeline config shape (stored as JSON in DeploymentPipeline.config)
// ---------------------------------------------------------------------------

export interface PipelineConfig {
  provider?: DeployProvider;

  // Vercel — Deploy Hook URL (easiest, no token needed)
  // Create at: Vercel Dashboard → Project → Settings → Git → Deploy Hooks
  vercelDeployHookUrl?: string;

  // Vercel — API Token + project/team (for status polling)
  vercelToken?: string;           // plain text, encrypted at rest by AES-256-GCM TODO
  vercelProjectId?: string;
  vercelTeamId?: string;          // optional (for orgs)

  // Railway — API Token + service ID
  // Get token at: railway.app/account/tokens
  railwayToken?: string;
  railwayServiceId?: string;
  railwayEnvironmentId?: string;  // optional, defaults to production

  // Generic webhook — POST to this URL
  webhookUrl?: string;
  webhookSecret?: string;         // added as X-Deploy-Secret header
}

// ---------------------------------------------------------------------------
// Vercel Deploy Hook
// ---------------------------------------------------------------------------

/**
 * Trigger a Vercel deployment via a Deploy Hook URL.
 * Vercel will rebuild and redeploy the connected branch.
 */
export async function triggerVercelDeployHook(
  hookUrl: string,
  environment: string,
): Promise<DeployTriggerResult> {
  try {
    const res = await fetch(hookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ environment }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, error: `Vercel hook returned ${res.status}: ${text}` };
    }

    const data = await res.json().catch(() => ({}));
    return {
      success: true,
      externalDeployId: data?.job?.id ?? data?.id ?? undefined,
      logs: `Vercel deploy triggered via hook. Job: ${data?.job?.id ?? 'queued'}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Failed to trigger Vercel deploy hook' };
  }
}

// ---------------------------------------------------------------------------
// Railway
// ---------------------------------------------------------------------------

/**
 * Trigger a Railway deployment via the Railway REST API.
 * https://docs.railway.app/reference/public-api
 */
export async function triggerRailwayDeploy(
  token: string,
  serviceId: string,
  environmentId?: string,
): Promise<DeployTriggerResult> {
  try {
    const mutation = `
      mutation TriggerDeploy($serviceId: String!, $environmentId: String) {
        serviceInstanceDeploy(
          serviceId: $serviceId
          environmentId: $environmentId
        )
      }
    `;

    const res = await fetch('https://backboard.railway.app/graphql/v2', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: mutation,
        variables: { serviceId, environmentId: environmentId ?? null },
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, error: `Railway API returned ${res.status}: ${text}` };
    }

    const data = await res.json();

    if (data.errors?.length) {
      return { success: false, error: data.errors.map((e: any) => e.message).join(', ') };
    }

    return {
      success: true,
      logs: `Railway deployment triggered for service ${serviceId}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Failed to trigger Railway deploy' };
  }
}

// ---------------------------------------------------------------------------
// Generic Webhook
// ---------------------------------------------------------------------------

/**
 * POST a deploy payload to an arbitrary webhook URL.
 * Works with any CI/CD system that accepts incoming webhooks.
 */
export async function triggerWebhookDeploy(
  webhookUrl: string,
  environment: string,
  secret?: string,
): Promise<DeployTriggerResult> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (secret) {
      headers['X-Deploy-Secret'] = secret;
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        event: 'deploy',
        environment,
        triggeredBy: 'codanium',
        timestamp: new Date().toISOString(),
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { success: false, error: `Webhook returned ${res.status}: ${text}` };
    }

    return {
      success: true,
      logs: `Webhook deploy triggered. Response: ${res.status}`,
    };
  } catch (err: any) {
    return { success: false, error: err.message ?? 'Failed to trigger webhook deploy' };
  }
}
