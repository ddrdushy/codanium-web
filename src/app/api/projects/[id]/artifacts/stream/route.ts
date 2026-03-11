import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';

export const dynamic = 'force-dynamic';

/**
 * GET /api/projects/[id]/artifacts/stream
 *
 * SSE endpoint for real-time artifact delivery.
 * Used by the VS Code extension to receive generated code files
 * as agents produce them.
 *
 * Events:
 * - `connected` — initial connection with project info
 * - `artifact_created` — new artifact (code, doc, config, etc.)
 * - `artifact_updated` — existing artifact modified
 * - `heartbeat` — keep-alive every 15s
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params;
  const { session, error } = await requireAuthOrApiKey();
  if (error) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Verify project exists and user has access
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

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastCheck = new Date();
      let alive = true;

      // Track known artifact versions to detect updates vs creates
      const knownArtifacts = new Map<string, { version: number; updatedAt: Date }>();

      function send(event: string, data: unknown) {
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
          );
        } catch {
          alive = false;
        }
      }

      // Send initial connection event
      send('connected', {
        projectId,
        projectName: project.name,
        timestamp: new Date().toISOString(),
      });

      // Load existing artifacts to populate known map
      try {
        const existing = await prisma.artifact.findMany({
          where: { projectId },
          select: { id: true, version: true, updatedAt: true },
        });
        for (const a of existing) {
          knownArtifacts.set(a.id, { version: a.version, updatedAt: a.updatedAt });
        }
      } catch {
        // Non-fatal — will discover artifacts on first poll
      }

      // Poll for new/updated artifacts every 2s (faster than activity stream
      // since code delivery should feel real-time)
      const pollInterval = setInterval(async () => {
        if (!alive) {
          clearInterval(pollInterval);
          return;
        }

        try {
          // Find artifacts created or updated since last check
          const changedArtifacts = await prisma.artifact.findMany({
            where: {
              projectId,
              OR: [
                { createdAt: { gt: lastCheck } },
                { updatedAt: { gt: lastCheck } },
              ],
            },
            select: {
              id: true,
              name: true,
              type: true,
              content: true,
              ownerAgent: true,
              version: true,
              module: true,
              cardId: true,
              createdAt: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: 'asc' },
            take: 50,
          });

          if (changedArtifacts.length > 0) {
            for (const artifact of changedArtifacts) {
              const known = knownArtifacts.get(artifact.id);
              const isNew = !known;
              const isUpdated = known && (
                artifact.version > known.version ||
                artifact.updatedAt > known.updatedAt
              );

              if (isNew || isUpdated) {
                // Determine file path from artifact name and module
                const filePath = deriveFilePath(artifact.name, artifact.module);

                send(isNew ? 'artifact_created' : 'artifact_updated', {
                  id: artifact.id,
                  name: artifact.name,
                  type: artifact.type,
                  content: artifact.content,
                  filePath,
                  language: detectLanguage(artifact.name),
                  agentName: artifact.ownerAgent,
                  version: artifact.version,
                  module: artifact.module,
                  cardId: artifact.cardId,
                  timestamp: artifact.updatedAt.toISOString(),
                });

                knownArtifacts.set(artifact.id, {
                  version: artifact.version,
                  updatedAt: artifact.updatedAt,
                });
              }
            }

            lastCheck = changedArtifacts[changedArtifacts.length - 1].updatedAt;
          }
        } catch (err) {
          console.error('[ArtifactStream] Poll error:', err);
        }
      }, 2000);

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
        clearInterval(pollInterval);
        clearInterval(heartbeatInterval);
        try {
          controller.close();
        } catch {
          // Already closed
        }
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

/**
 * Derive a file path from artifact name and module.
 * Examples:
 *   "Login.tsx" (module: "auth") → "src/auth/Login.tsx"
 *   "schema.prisma" → "prisma/schema.prisma"
 *   "gateway-refactor.md" → "docs/gateway-refactor.md"
 */
function deriveFilePath(name: string, module?: string | null): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';

  // Known non-src files
  if (name === 'schema.prisma') return 'prisma/schema.prisma';
  if (name === 'package.json') return 'package.json';
  if (name === 'tsconfig.json') return 'tsconfig.json';
  if (name === '.env') return '.env';
  if (name === '.env.local') return '.env.local';

  // Documents go to docs/
  if (['md', 'txt', 'pdf'].includes(ext)) {
    return `docs/${name}`;
  }

  // Config files
  if (['json', 'yaml', 'yml', 'toml'].includes(ext) && !name.startsWith('src/')) {
    return `config/${name}`;
  }

  // Source code files
  if (module) {
    return `src/${module}/${name}`;
  }

  // If name already looks like a path
  if (name.includes('/')) {
    return name;
  }

  return `src/${name}`;
}

/**
 * Detect programming language from file extension for syntax highlighting.
 */
function detectLanguage(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    css: 'css',
    scss: 'scss',
    html: 'html',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    prisma: 'prisma',
    dockerfile: 'dockerfile',
    sh: 'shellscript',
    bash: 'shellscript',
  };
  return langMap[ext] || 'plaintext';
}
