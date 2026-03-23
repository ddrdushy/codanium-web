import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { recordVSCodeHeartbeat } from '@/lib/vscode-bridge';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/vscode-ping
 *
 * Called every 15s by the VS Code extension to signal it is connected
 * and has the given project open. Stores a 30s Redis heartbeat so the
 * agent-loop can verify VS Code is live before running dev agents.
 *
 * Body: { extensionVersion?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const { error } = await requireAuthOrApiKey();
  if (error) return error;

  let extensionVersion = '0.0.0';
  try {
    const body = await request.json();
    extensionVersion = body.extensionVersion ?? '0.0.0';
  } catch { /* body is optional */ }

  await recordVSCodeHeartbeat(projectId, extensionVersion);

  return NextResponse.json({ ok: true, projectId, ts: Date.now() });
}

/**
 * DELETE /api/projects/[id]/vscode-ping
 *
 * Called when the VS Code extension closes or deactivates, to immediately
 * clear the heartbeat rather than waiting for TTL expiry.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params;
  const { error } = await requireAuthOrApiKey();
  if (error) return error;

  const { clearVSCodeHeartbeat } = await import('@/lib/vscode-bridge');
  await clearVSCodeHeartbeat(projectId);

  return NextResponse.json({ ok: true });
}
