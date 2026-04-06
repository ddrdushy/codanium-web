import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

// ─── Safety ──────────────────────────────────────────────────────────────────
// Commands that are NEVER allowed — protect the host from destructive ops
const BLOCKED_PATTERNS = [
  /rm\s+(-rf?|--recursive)\s+\//i,    // rm -rf /
  /mkfs/i,                              // format disk
  /dd\s+if=/i,                          // raw disk write
  /:(){ :\|:& };:/,                     // fork bomb
  /shutdown|reboot|halt|poweroff/i,     // system shutdown
  /chmod\s+777\s+\//i,                  // chmod 777 /
  /curl.*\|\s*(bash|sh|zsh)/i,          // pipe to shell
  /wget.*\|\s*(bash|sh|zsh)/i,
  />\s*\/dev\/sd/i,                     // write to disk device
  /\/etc\/passwd|\/etc\/shadow/i,       // access system auth
  /docker\s+(rm|rmi|stop|kill)\s/i,     // container destruction
  /systemctl|service\s/i,              // service management
];

function isCommandSafe(command: string): { safe: boolean; reason?: string } {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(command)) {
      return { safe: false, reason: `Command matches blocked pattern: ${pattern.source}` };
    }
  }
  return { safe: true };
}

// ─── POST: Execute terminal command ──────────────────────────────────────────
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAuthOrApiKey();
  if (error) return error;

  const { id: projectId } = await params;
  const body = await request.json().catch(() => null);

  if (!body || !body.command) {
    return NextResponse.json(
      { error: 'Missing required field: command' },
      { status: 400 },
    );
  }

  const { command, cwd, timeout = 30000, env } = body as {
    command: string;
    cwd?: string;
    timeout?: number;
    env?: Record<string, string>;
  };

  // Validate command length
  if (command.length > 10_000) {
    return NextResponse.json(
      { error: 'Command exceeds maximum length (10KB)' },
      { status: 400 },
    );
  }

  // Safety check
  const safety = isCommandSafe(command);
  if (!safety.safe) {
    return NextResponse.json(
      { error: `Command blocked for safety: ${safety.reason}` },
      { status: 403 },
    );
  }

  // Cap timeout at 2 minutes
  const effectiveTimeout = Math.min(timeout, 120_000);

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
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Resolve working directory within workspace
  const workspaceBase = path.join('/app/workspaces', projectId);
  const workingDir = cwd
    ? path.resolve(workspaceBase, cwd)
    : workspaceBase;

  // Ensure working directory is within workspace (path traversal guard)
  if (!workingDir.startsWith('/app/workspaces')) {
    return NextResponse.json(
      { error: 'Working directory must be within project workspace' },
      { status: 403 },
    );
  }

  // Create workspace directory if it doesn't exist
  try {
    if (!fs.existsSync(workspaceBase)) {
      fs.mkdirSync(workspaceBase, { recursive: true });
    }
  } catch {
    // Non-fatal — command may still work
  }

  // Create terminal session record
  const session_record = await prisma.terminalSession.create({
    data: {
      command,
      cwd: workingDir,
      status: 'RUNNING',
      triggeredBy: 'user',
      projectId,
      startedAt: new Date(),
    },
  });

  // Execute the command
  const startTime = Date.now();
  try {
    const { stdout, stderr } = await execAsync(command, {
      cwd: workingDir,
      timeout: effectiveTimeout,
      maxBuffer: 5 * 1024 * 1024, // 5MB output buffer
      env: {
        ...process.env,
        HOME: workspaceBase,
        TERM: 'xterm-256color',
        ...(env || {}),
      },
      shell: '/bin/sh',
    });

    const durationMs = Date.now() - startTime;

    // Update record with results
    const updated = await prisma.terminalSession.update({
      where: { id: session_record.id },
      data: {
        status: 'SUCCESS',
        stdout: stdout.slice(0, 500_000), // Cap at 500KB
        stderr: stderr.slice(0, 500_000),
        exitCode: 0,
        durationMs,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      id: updated.id,
      command,
      cwd: workingDir,
      status: 'SUCCESS',
      stdout,
      stderr,
      exitCode: 0,
      durationMs,
    });

  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const exitCode = err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' ? null
      : err.killed ? null
      : (err.code ?? 1);
    const status = err.killed ? 'TIMEOUT' : 'FAILED';

    // Update record with error
    await prisma.terminalSession.update({
      where: { id: session_record.id },
      data: {
        status,
        stdout: (err.stdout || '').slice(0, 500_000),
        stderr: (err.stderr || err.message || '').slice(0, 500_000),
        exitCode: typeof exitCode === 'number' ? exitCode : null,
        durationMs,
        errorMessage: err.killed ? 'Command timed out' : err.message,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      id: session_record.id,
      command,
      cwd: workingDir,
      status,
      stdout: err.stdout || '',
      stderr: err.stderr || err.message || '',
      exitCode: typeof exitCode === 'number' ? exitCode : null,
      durationMs,
      error: err.killed ? 'Command timed out' : err.message,
    });
  }
}

// ─── GET: List terminal sessions ─────────────────────────────────────────────
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireAuthOrApiKey();
  if (error) return error;

  const { id: projectId } = await params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
  const offset = parseInt(searchParams.get('offset') || '0');

  // Verify project access
  const project = await prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { ownerId: (session.user as any).id },
        { members: { some: { userId: (session.user as any).id } } },
      ],
    },
    select: { id: true },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const [sessions, total] = await Promise.all([
    prisma.terminalSession.findMany({
      where: { projectId },
      select: {
        id: true,
        command: true,
        cwd: true,
        status: true,
        exitCode: true,
        durationMs: true,
        triggeredBy: true,
        createdAt: true,
        completedAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.terminalSession.count({ where: { projectId } }),
  ]);

  return NextResponse.json({ sessions, total, limit, offset });
}
