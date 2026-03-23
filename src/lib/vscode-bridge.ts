// =============================================================================
// VS Code Bridge — Redis heartbeat helper
// =============================================================================
// The VS Code extension periodically pings a dedicated endpoint to signal it
// is connected and which project is open. This module provides helpers to
// read / write that heartbeat so the agent-loop can gate development agents.
//
// Key schema:
//   Redis key: `vscode:connected:{projectId}`   value: JSON { version, ts }
//   TTL: 30 seconds  (extension pings every 15s)
// =============================================================================

import { redis, isRedisAvailable } from '@/lib/redis';

const HEARTBEAT_TTL_SECONDS = 30;

function heartbeatKey(projectId: string): string {
  return `vscode:connected:${projectId}`;
}

/**
 * Called by the VS Code extension ping endpoint.
 * Records a heartbeat for the given project with a 30s TTL.
 */
export async function recordVSCodeHeartbeat(
  projectId: string,
  extensionVersion: string,
): Promise<void> {
  if (!isRedisAvailable()) return;
  const payload = JSON.stringify({ version: extensionVersion, ts: Date.now() });
  await redis.set(heartbeatKey(projectId), payload, 'EX', HEARTBEAT_TTL_SECONDS);
}

/**
 * Returns true if the VS Code extension is currently connected for the given project.
 * The heartbeat expires after 30s, so this is effectively real-time.
 */
export async function isVSCodeConnected(projectId: string): Promise<boolean> {
  try {
    if (!isRedisAvailable()) {
      // If Redis is unavailable, fail open so orchestration is not blocked.
      console.warn('[VSCodeBridge] Redis unavailable — treating VS Code as connected (fail-open).');
      return true;
    }
    const val = await redis.get(heartbeatKey(projectId));
    return val !== null;
  } catch {
    console.warn('[VSCodeBridge] Redis check failed — treating VS Code as connected (fail-open).');
    return true;
  }
}

/**
 * Clears the VS Code heartbeat for a project (e.g. when the extension disconnects).
 */
export async function clearVSCodeHeartbeat(projectId: string): Promise<void> {
  try {
    if (!isRedisAvailable()) return;
    await redis.del(heartbeatKey(projectId));
  } catch { /* ignore */ }
}
