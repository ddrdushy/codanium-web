import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const INTERNAL_SECRET = process.env.INTERNAL_TASK_SECRET ?? 'dev-task-secret';

/**
 * POST /api/internal/fix-json-artifacts
 * One-time fix: reformat minified JSON artifacts (package.json, tsconfig.json, etc.)
 * Protected by x-internal-secret header.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-internal-secret');
    if (authHeader !== INTERNAL_SECRET) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Find all JSON-type artifacts
    const jsonArtifacts = await prisma.artifact.findMany({
      where: {
        name: { endsWith: '.json' },
      },
      select: { id: true, name: true, content: true },
    });

    let fixed = 0;
    const results: { name: string; status: string }[] = [];

    for (const artifact of jsonArtifacts) {
      try {
        const parsed = JSON.parse(artifact.content);
        const formatted = JSON.stringify(parsed, null, 2);

        // Only update if actually different (was minified)
        if (formatted !== artifact.content) {
          await prisma.artifact.update({
            where: { id: artifact.id },
            data: { content: formatted },
          });
          fixed++;
          results.push({ name: artifact.name, status: 'formatted' });
        } else {
          results.push({ name: artifact.name, status: 'already formatted' });
        }
      } catch {
        results.push({ name: artifact.name, status: 'invalid JSON - skipped' });
      }
    }

    return NextResponse.json({ fixed, total: jsonArtifacts.length, results });
  } catch (error) {
    console.error('POST /api/internal/fix-json-artifacts error:', error);
    return NextResponse.json(
      { error: 'Failed to fix JSON artifacts' },
      { status: 500 },
    );
  }
}
