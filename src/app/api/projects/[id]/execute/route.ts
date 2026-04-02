// =============================================================================
// Codanium — Code Execution API
// =============================================================================
// POST /api/projects/:id/execute — Submit code for sandboxed execution
// GET  /api/projects/:id/execute — List recent executions
// =============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { addCodeExecutionJob } from '@/lib/queue/code-execution-queue';
import { getSupportedLanguages } from '@/lib/sandbox/docker-runner';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/projects/:id/execute
 * Submit code for sandboxed execution.
 *
 * Body: { language, code, stdin?, artifactId?, cardId? }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const body = await request.json();
    const { language, code, stdin, artifactId, cardId } = body;

    // Validate required fields
    if (!language || !code) {
      return NextResponse.json(
        { error: 'Missing required fields: language, code' },
        { status: 400 },
      );
    }

    // Validate language
    const supported = getSupportedLanguages();
    if (!supported.includes(language.toLowerCase())) {
      return NextResponse.json(
        {
          error: `Unsupported language: "${language}". Supported: ${supported.join(', ')}`,
          supported,
        },
        { status: 400 },
      );
    }

    // Validate code length (max 100KB)
    if (code.length > 100_000) {
      return NextResponse.json(
        { error: 'Code exceeds maximum length (100KB)' },
        { status: 400 },
      );
    }

    // Verify project exists
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 },
      );
    }

    // If artifactId provided, verify it exists
    if (artifactId) {
      const artifact = await prisma.artifact.findFirst({
        where: { id: artifactId, projectId },
      });
      if (!artifact) {
        return NextResponse.json(
          { error: 'Artifact not found in this project' },
          { status: 404 },
        );
      }
    }

    // Create CodeExecution record
    const execution = await prisma.codeExecution.create({
      data: {
        language: language.toLowerCase(),
        code,
        stdin: stdin || '',
        artifactId: artifactId || null,
        cardId: cardId || null,
        triggeredBy: 'user',
        projectId,
      },
    });

    // Enqueue execution job
    await addCodeExecutionJob({
      executionId: execution.id,
      projectId,
    });

    console.log(
      `[Execute API] Created execution ${execution.id} for project ${projectId} — language: ${language}`,
    );

    return NextResponse.json(execution, { status: 201 });
  } catch (error) {
    console.error('POST /api/projects/[id]/execute error:', error);
    return NextResponse.json(
      { error: 'Failed to create execution' },
      { status: 500 },
    );
  }
}

/**
 * GET /api/projects/:id/execute
 * List recent code executions for a project.
 *
 * Query params: limit (default 20), offset (default 0)
 */
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { session, error } = await requireAuthOrApiKey();
    if (error) return error;

    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
    const offset = parseInt(url.searchParams.get('offset') || '0');

    const [executions, total] = await Promise.all([
      prisma.codeExecution.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          status: true,
          language: true,
          exitCode: true,
          durationMs: true,
          triggeredBy: true,
          artifactId: true,
          cardId: true,
          createdAt: true,
          completedAt: true,
        },
      }),
      prisma.codeExecution.count({ where: { projectId } }),
    ]);

    return NextResponse.json({ executions, total, limit, offset });
  } catch (error) {
    console.error('GET /api/projects/[id]/execute error:', error);
    return NextResponse.json(
      { error: 'Failed to list executions' },
      { status: 500 },
    );
  }
}
