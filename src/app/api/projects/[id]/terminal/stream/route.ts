import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

// ─── GET: SSE stream for real-time terminal output ───────────────────────────
// Usage: EventSource(`/api/projects/${id}/terminal/stream?command=ls%20-la`)
// Events: terminal_stdout, terminal_stderr, terminal_exit, terminal_error, heartbeat
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAuthOrApiKey();
  if (error) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const command = searchParams.get('command');
  const cwd = searchParams.get('cwd') || '';
  const timeoutMs = Math.min(parseInt(searchParams.get('timeout') || '60000'), 120_000);

  if (!command) {
    return new Response(JSON.stringify({ error: 'Missing command parameter' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify project access
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { ownerId: (session.user as any).id },
        { members: { some: { userId: (session.user as any).id } } },
      ],
    },
    select: { id: true, name: true },
  });

  if (!project) {
    return new Response(JSON.stringify({ error: 'Project not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Resolve working directory
  const workspaceBase = path.join('/app/workspaces', projectId);
  const workingDir = cwd ? path.resolve(workspaceBase, cwd) : workspaceBase;

  if (!workingDir.startsWith('/app/workspaces')) {
    return new Response(JSON.stringify({ error: 'Invalid working directory' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Ensure workspace exists
  try {
    if (!fs.existsSync(workspaceBase)) {
      fs.mkdirSync(workspaceBase, { recursive: true });
    }
  } catch { /* non-fatal */ }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let alive = true;
      let stdoutBuf = '';
      let stderrBuf = '';
      const startTime = Date.now();

      function send(event: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          alive = false;
        }
      }

      // Create DB record
      let sessionId = '';
      try {
        const rec = await prisma.terminalSession.create({
          data: {
            command,
            cwd: workingDir,
            status: 'RUNNING',
            triggeredBy: 'user',
            projectId,
            startedAt: new Date(),
          },
        });
        sessionId = rec.id;
      } catch {
        // DB write failed — continue anyway
      }

      send('connected', {
        sessionId,
        projectId,
        command,
        cwd: workingDir,
        timestamp: new Date().toISOString(),
      });

      // Spawn the process
      const child = spawn('/bin/sh', ['-c', command], {
        cwd: workingDir,
        env: {
          ...process.env,
          HOME: workspaceBase,
          TERM: 'xterm-256color',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // Stream stdout line-by-line
      child.stdout?.on('data', (chunk: Buffer) => {
        if (!alive) return;
        const text = chunk.toString();
        stdoutBuf += text;
        send('terminal_stdout', { text, timestamp: new Date().toISOString() });
      });

      // Stream stderr line-by-line
      child.stderr?.on('data', (chunk: Buffer) => {
        if (!alive) return;
        const text = chunk.toString();
        stderrBuf += text;
        send('terminal_stderr', { text, timestamp: new Date().toISOString() });
      });

      // Process exit
      child.on('close', async (code) => {
        const durationMs = Date.now() - startTime;
        const status = code === 0 ? 'SUCCESS' : 'FAILED';

        send('terminal_exit', {
          exitCode: code,
          durationMs,
          status,
          timestamp: new Date().toISOString(),
        });

        // Update DB
        if (sessionId) {
          try {
            await prisma.terminalSession.update({
              where: { id: sessionId },
              data: {
                status,
                stdout: stdoutBuf.slice(0, 500_000),
                stderr: stderrBuf.slice(0, 500_000),
                exitCode: code,
                durationMs,
                completedAt: new Date(),
              },
            });
          } catch { /* non-fatal */ }
        }

        try { controller.close(); } catch { /* already closed */ }
      });

      // Process error
      child.on('error', async (err) => {
        const durationMs = Date.now() - startTime;
        send('terminal_error', {
          error: err.message,
          durationMs,
          timestamp: new Date().toISOString(),
        });

        if (sessionId) {
          try {
            await prisma.terminalSession.update({
              where: { id: sessionId },
              data: {
                status: 'FAILED',
                errorMessage: err.message,
                durationMs,
                completedAt: new Date(),
              },
            });
          } catch { /* non-fatal */ }
        }

        try { controller.close(); } catch { /* already closed */ }
      });

      // Timeout handler
      const timeoutId = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
          setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 5000);
        }
        send('terminal_exit', {
          exitCode: null,
          durationMs: Date.now() - startTime,
          status: 'TIMEOUT',
          error: `Command timed out after ${timeoutMs}ms`,
          timestamp: new Date().toISOString(),
        });
      }, timeoutMs);

      // Heartbeat every 15s
      const heartbeatInterval = setInterval(() => {
        if (!alive) {
          clearInterval(heartbeatInterval);
          return;
        }
        send('heartbeat', { timestamp: new Date().toISOString() });
      }, 15000);

      // Cleanup on client disconnect
      request.signal.addEventListener('abort', () => {
        alive = false;
        if (!child.killed) child.kill('SIGTERM');
        clearTimeout(timeoutId);
        clearInterval(heartbeatInterval);
        try { controller.close(); } catch { /* already closed */ }
      });

      // Cleanup on child exit
      child.on('close', () => {
        clearTimeout(timeoutId);
        clearInterval(heartbeatInterval);
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
