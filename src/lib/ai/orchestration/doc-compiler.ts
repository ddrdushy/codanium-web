// =============================================================================
// Codanium — Document Compiler (CMP Controller)
// =============================================================================
// Enterprise Spec §5.7 — Combines document sections, validates completeness,
// and prepares final artifacts for approval.
//
// Responsibilities:
//   1. Validate that all required sections exist for a document type
//   2. Compile sections into a final coherent document
//   3. Report missing/incomplete sections
//   4. Support resume (identify last completed section)
// =============================================================================

import { prisma } from '@/lib/prisma';
import type { DocumentType } from '@/generated/prisma/enums';

// ---------------------------------------------------------------------------
// Section Definitions per Document Type
// ---------------------------------------------------------------------------

export interface SectionDef {
  id: string;
  title: string;
  required: boolean;
  /** Regex patterns to detect this section in markdown content */
  patterns: RegExp[];
}

const BRD_SECTIONS: SectionDef[] = [
  { id: '01_overview', title: 'Overview', required: true, patterns: [/^#{1,3}\s.*overview/im, /^#{1,3}\s.*introduction/im] },
  { id: '02_objectives', title: 'Business Objectives', required: true, patterns: [/^#{1,3}\s.*objectives?/im, /^#{1,3}\s.*goals?/im] },
  { id: '03_stakeholders', title: 'Stakeholders', required: true, patterns: [/^#{1,3}\s.*stakeholders?/im, /^#{1,3}\s.*personas?/im, /^#{1,3}\s.*users?/im] },
  { id: '04_functional_requirements', title: 'Functional Requirements', required: true, patterns: [/^#{1,3}\s.*functional\s+req/im, /FR-\d{3}/m] },
  { id: '05_non_functional_requirements', title: 'Non-Functional Requirements', required: true, patterns: [/^#{1,3}\s.*non.?functional/im, /NFR-\d{3}/m] },
  { id: '06_constraints', title: 'Constraints', required: false, patterns: [/^#{1,3}\s.*constraints?/im] },
  { id: '07_assumptions', title: 'Assumptions', required: false, patterns: [/^#{1,3}\s.*assumptions?/im] },
  { id: '08_success_criteria', title: 'Success Criteria', required: true, patterns: [/^#{1,3}\s.*success\s+criteria/im, /^#{1,3}\s.*acceptance\s+criteria/im] },
];

const SDD_SECTIONS: SectionDef[] = [
  { id: '01_system_overview', title: 'System Overview', required: true, patterns: [/^#{1,3}\s.*system\s+overview/im, /^#{1,3}\s.*overview/im] },
  { id: '02_architecture', title: 'Architecture', required: true, patterns: [/^#{1,3}\s.*architecture/im, /^#{1,3}\s.*high.?level\s+design/im] },
  { id: '03_components', title: 'Components', required: true, patterns: [/^#{1,3}\s.*components?/im, /^#{1,3}\s.*modules?/im] },
  { id: '04_data_flow', title: 'Data Flow', required: true, patterns: [/^#{1,3}\s.*data\s+flow/im, /^#{1,3}\s.*data\s+model/im] },
  { id: '05_apis', title: 'APIs & Integrations', required: true, patterns: [/^#{1,3}\s.*api/im, /^#{1,3}\s.*integrations?/im, /^#{1,3}\s.*endpoints?/im] },
  { id: '06_tech_stack', title: 'Tech Stack', required: true, patterns: [/^#{1,3}\s.*tech\s+stack/im, /^#{1,3}\s.*technology/im] },
  { id: '07_security', title: 'Security', required: true, patterns: [/^#{1,3}\s.*security/im, /^#{1,3}\s.*authentication/im] },
  { id: '08_scalability', title: 'Scalability', required: false, patterns: [/^#{1,3}\s.*scalability/im, /^#{1,3}\s.*performance/im] },
  { id: '09_error_handling', title: 'Error Handling', required: false, patterns: [/^#{1,3}\s.*error\s+handling/im, /^#{1,3}\s.*fault\s+tolerance/im] },
  { id: '10_assumptions', title: 'Assumptions', required: false, patterns: [/^#{1,3}\s.*assumptions?/im] },
];

const DESIGN_SYSTEM_SECTIONS: SectionDef[] = [
  { id: '01_branding', title: 'Branding', required: true, patterns: [/^#{1,3}\s.*branding/im, /^#{1,3}\s.*brand\s+guide/im] },
  { id: '02_colors', title: 'Color Palette', required: true, patterns: [/^#{1,3}\s.*colou?r/im, /^#{1,3}\s.*palette/im] },
  { id: '03_typography', title: 'Typography', required: true, patterns: [/^#{1,3}\s.*typography/im, /^#{1,3}\s.*fonts?/im] },
  { id: '04_spacing', title: 'Spacing', required: false, patterns: [/^#{1,3}\s.*spacing/im, /^#{1,3}\s.*layout/im] },
  { id: '05_components', title: 'Components', required: true, patterns: [/^#{1,3}\s.*components?/im, /^#{1,3}\s.*ui\s+kit/im] },
  { id: '06_tokens', title: 'Design Tokens', required: false, patterns: [/^#{1,3}\s.*tokens?/im, /^#{1,3}\s.*variables?/im] },
];

const SECTION_REGISTRY: Record<string, SectionDef[]> = {
  BRD: BRD_SECTIONS,
  SDD: SDD_SECTIONS,
  DESIGN_SYSTEM: DESIGN_SYSTEM_SECTIONS,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SectionStatus {
  id: string;
  title: string;
  required: boolean;
  found: boolean;
}

export interface CompileResult {
  documentId: string;
  type: string;
  totalSections: number;
  foundSections: number;
  requiredSections: number;
  requiredFound: number;
  missingRequired: SectionStatus[];
  missingOptional: SectionStatus[];
  completeness: number; // 0-100%
  isComplete: boolean;
  content: string;
  wordCount: number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Validate a document's section completeness against its type definition.
 * Returns detailed status of each section (found/missing).
 */
export function validateSections(content: string, docType: string): SectionStatus[] {
  const sections = SECTION_REGISTRY[docType.toUpperCase()];
  if (!sections) return []; // Unknown type — no validation

  return sections.map((sec) => ({
    id: sec.id,
    title: sec.title,
    required: sec.required,
    found: sec.patterns.some((p) => p.test(content)),
  }));
}

/**
 * Compile and validate a document. Returns completeness metrics and
 * identifies missing sections. Does NOT modify the document.
 */
export async function compileDocument(
  projectId: string,
  docType: string,
): Promise<CompileResult> {
  const doc = await prisma.document.findFirst({
    where: { projectId, type: docType.toUpperCase() as DocumentType },
    orderBy: { createdAt: 'desc' },
  });

  if (!doc) {
    throw new Error(`No ${docType} document found for project ${projectId}`);
  }

  const content = doc.content || '';
  const sectionStatuses = validateSections(content, docType);

  const totalSections = sectionStatuses.length;
  const foundSections = sectionStatuses.filter((s) => s.found).length;
  const requiredSections = sectionStatuses.filter((s) => s.required).length;
  const requiredFound = sectionStatuses.filter((s) => s.required && s.found).length;

  const missingRequired = sectionStatuses.filter((s) => s.required && !s.found);
  const missingOptional = sectionStatuses.filter((s) => !s.required && !s.found);

  // Completeness is based on required sections only
  const completeness = requiredSections > 0
    ? Math.round((requiredFound / requiredSections) * 100)
    : 100;

  return {
    documentId: doc.id,
    type: docType,
    totalSections,
    foundSections,
    requiredSections,
    requiredFound,
    missingRequired,
    missingOptional,
    completeness,
    isComplete: missingRequired.length === 0,
    content,
    wordCount: content.split(/\s+/).length,
  };
}

/**
 * Get the resume point for section-based generation.
 * Returns the ID and title of the first missing section (required first, then optional).
 */
export function getResumePoint(content: string, docType: string): SectionStatus | null {
  const statuses = validateSections(content, docType);

  // Find first missing required section
  const missingRequired = statuses.find((s) => s.required && !s.found);
  if (missingRequired) return missingRequired;

  // If all required are done, find first missing optional
  const missingOptional = statuses.find((s) => !s.required && !s.found);
  return missingOptional || null;
}

/**
 * Get section definitions for a document type.
 * Used by DGE to plan section-based generation.
 */
export function getSectionDefinitions(docType: string): SectionDef[] {
  return SECTION_REGISTRY[docType.toUpperCase()] || [];
}
