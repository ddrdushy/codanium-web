import { NextRequest, NextResponse } from 'next/server';
import { requireAuthOrApiKey } from '@/lib/auth-guard';
import { analyzeProjectArtifacts } from '@/lib/ai/analysis/cross-artifact-analyzer';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/projects/:id/analyze
 * Run cross-artifact consistency analysis on the project.
 * Returns an array of AnalysisResult findings sorted by severity.
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { id: projectId } = await context.params;
    const { error } = await requireAuthOrApiKey();
    if (error) return error;

    const results = await analyzeProjectArtifacts(projectId);

    return NextResponse.json({
      projectId,
      findings: results,
      summary: {
        total: results.length,
        critical: results.filter(r => r.severity === 'CRITICAL').length,
        high: results.filter(r => r.severity === 'HIGH').length,
        medium: results.filter(r => r.severity === 'MEDIUM').length,
        low: results.filter(r => r.severity === 'LOW').length,
      },
    });
  } catch (error) {
    console.error('GET /api/projects/[id]/analyze error:', error);
    return NextResponse.json(
      { error: 'Failed to run project analysis' },
      { status: 500 },
    );
  }
}
