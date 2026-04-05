import { NextRequest, NextResponse } from 'next/server';
import { compileDocument, getResumePoint, getSectionDefinitions } from '@/lib/ai/orchestration/doc-compiler';

export const dynamic = 'force-dynamic';

/**
 * POST /api/projects/[id]/artifacts/compile
 * Validate and compile a document — checks section completeness.
 * Body: { type: "BRD" | "SDD" | "DESIGN_SYSTEM" }
 *
 * Returns completeness metrics, missing sections, and resume point.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: projectId } = await params;
    const body = await request.json();
    const docType = body.type;

    if (!docType) {
      return NextResponse.json(
        { error: 'Document type is required (e.g., BRD, SDD, DESIGN_SYSTEM)' },
        { status: 400 }
      );
    }

    const result = await compileDocument(projectId, docType);
    const resumePoint = getResumePoint(result.content, docType);
    const sectionDefs = getSectionDefinitions(docType);

    return NextResponse.json({
      ...result,
      content: undefined, // Don't leak full content in compile response
      resumePoint: resumePoint ? { id: resumePoint.id, title: resumePoint.title } : null,
      sectionDefinitions: sectionDefs.map(s => ({
        id: s.id,
        title: s.title,
        required: s.required,
      })),
    });
  } catch (error: any) {
    console.error('POST /api/projects/[id]/artifacts/compile error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to compile document' },
      { status: error.message?.includes('No ') ? 404 : 500 }
    );
  }
}
