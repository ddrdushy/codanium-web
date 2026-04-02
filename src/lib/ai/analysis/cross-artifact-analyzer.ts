// =============================================================================
// Codanium — Cross-Artifact Consistency Analyzer
// =============================================================================
// Validates consistency across BRD, SDD, constitution, task cards, and SDLC
// stages BEFORE implementation begins. Inspired by spec-kit /speckit.analyze.
//
// Runs 6 checks:
//   1. Coverage Gaps     — BRD sections without corresponding task cards
//   2. Missing Documents — Cards exist but key documents are absent
//   3. Stage Progression — Development started before architecture approved
//   4. Empty Cards       — Cards with insufficient descriptions
//   5. Stale Cards       — IN_PROGRESS cards with no recent updates
//   6. Constitution      — SDD tech stack vs. constitution-approved technologies
//   7. Requirement Trace — FR-XXX IDs from BRD matched against card descriptions
// =============================================================================

import { prisma } from '@/lib/prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AnalysisResult {
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  check: string;
  finding: string;
  recommendation: string;
}

// ─── Main Entry Point ─────────────────────────────────────────────────────────

/**
 * Run all 7 cross-artifact consistency checks for a project.
 * Returns an array of findings sorted by severity (CRITICAL first).
 */
export async function analyzeProjectArtifacts(
  projectId: string,
): Promise<AnalysisResult[]> {
  const results: AnalysisResult[] = [];

  // Fetch shared data once to avoid redundant queries
  const [documents, cards, stages] = await Promise.all([
    prisma.document.findMany({
      where: { projectId },
      select: { id: true, type: true, title: true, content: true, status: true },
    }),
    prisma.card.findMany({
      where: { projectId },
      select: {
        id: true,
        title: true,
        description: true,
        state: true,
        type: true,
        updatedAt: true,
      },
    }),
    prisma.sDLCStage.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
      select: { name: true, order: true, status: true, gatePassed: true },
    }),
  ]);

  const brd = documents.find(d => d.type === 'BRD');
  const sdd = documents.find(d => d.type === 'SDD');
  const constitution = documents.find(
    d => d.title.toLowerCase().includes('constitution') || d.type === 'ADR',
  );

  // Run all checks
  results.push(...checkCoverageGaps(brd, cards));
  results.push(...checkMissingDocuments(documents, cards));
  results.push(...checkStageProgression(stages));
  results.push(...checkEmptyCards(cards));
  results.push(...checkStaleCards(cards));
  results.push(...checkConstitutionViolations(constitution, sdd));
  results.push(...checkRequirementTraceability(brd, cards));

  // Sort by severity: CRITICAL > HIGH > MEDIUM > LOW
  const severityOrder: Record<string, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
  };
  results.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return results;
}

// ─── Check 1: Coverage Gaps ──────────────────────────────────────────────────

function checkCoverageGaps(
  brd: { content: string } | undefined,
  cards: { title: string }[],
): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  if (!brd?.content) return results;

  // Extract BRD requirement sections: "### Header" or numbered items "1. Item"
  const sectionHeaders = brd.content.match(/^###\s+(.+)$/gm) || [];
  const numberedItems = brd.content.match(/^\d+\.\s+(.+)$/gm) || [];

  const sections = [
    ...sectionHeaders.map(h => h.replace(/^###\s+/, '').trim()),
    ...numberedItems.map(n => n.replace(/^\d+\.\s+/, '').trim()),
  ];

  if (sections.length === 0) return results;

  const cardTitlesLower = cards.map(c => c.title.toLowerCase());

  for (const section of sections) {
    const sectionLower = section.toLowerCase();
    // Check if any card title contains meaningful words from the section
    const sectionWords = sectionLower
      .split(/\s+/)
      .filter(w => w.length > 3); // skip short words like "the", "and"

    const hasCorrespondingCard = cardTitlesLower.some(cardTitle =>
      sectionWords.some(word => cardTitle.includes(word)),
    );

    if (!hasCorrespondingCard) {
      results.push({
        severity: 'HIGH',
        check: 'Coverage Gaps',
        finding: `Requirement '${section}' has no task card`,
        recommendation: `Create a task card covering this BRD requirement, or verify it is addressed by an existing card under a different name.`,
      });
    }
  }

  return results;
}

// ─── Check 2: Missing Documents ──────────────────────────────────────────────

function checkMissingDocuments(
  documents: { type: string }[],
  cards: { id: string }[],
): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  if (cards.length === 0) return results;

  const docTypes = new Set(documents.map(d => d.type));

  if (!docTypes.has('BRD')) {
    results.push({
      severity: 'CRITICAL',
      check: 'Missing Documents',
      finding: 'Task cards exist without a BRD',
      recommendation:
        'A Business Requirements Document should be created and approved before task cards are created. Ask the BA agent to generate a BRD.',
    });
  }

  if (!docTypes.has('SDD')) {
    results.push({
      severity: 'HIGH',
      check: 'Missing Documents',
      finding: 'No architecture document (SDD) exists',
      recommendation:
        'A System Design Document should be created before implementation begins. Ask the SA agent to produce an SDD.',
    });
  }

  return results;
}

// ─── Check 3: Stage Progression ──────────────────────────────────────────────

function checkStageProgression(
  stages: { name: string; order: number; status: string; gatePassed: boolean }[],
): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  if (stages.length === 0) return results;

  // Normalize stage names for lookup
  const stageByName = new Map(stages.map(s => [s.name.toLowerCase(), s]));

  const development =
    stageByName.get('development') ||
    stageByName.get('implementation');
  const architecture =
    stageByName.get('architecture') ||
    stageByName.get('design');

  if (
    development &&
    architecture &&
    development.status === 'ACTIVE' &&
    architecture.status !== 'COMPLETED'
  ) {
    results.push({
      severity: 'HIGH',
      check: 'Stage Progression',
      finding: 'Development started before architecture was approved',
      recommendation:
        'Complete and approve the Architecture stage gate before advancing to Development. Ask the AUD agent to run a gate audit.',
    });
  }

  return results;
}

// ─── Check 4: Empty Cards ────────────────────────────────────────────────────

function checkEmptyCards(
  cards: { title: string; description: string }[],
): AnalysisResult[] {
  const results: AnalysisResult[] = [];

  for (const card of cards) {
    if (!card.description || card.description.trim().length < 20) {
      results.push({
        severity: 'MEDIUM',
        check: 'Empty Cards',
        finding: `Card '${card.title}' has insufficient description`,
        recommendation:
          'Add a detailed description with acceptance criteria so that developers know exactly what to build.',
      });
    }
  }

  return results;
}

// ─── Check 5: Stale Cards ────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

function checkStaleCards(
  cards: { title: string; state: string; updatedAt: Date }[],
): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  const now = Date.now();

  for (const card of cards) {
    if (card.state !== 'IN_PROGRESS') continue;

    const elapsed = now - new Date(card.updatedAt).getTime();
    if (elapsed > STALE_THRESHOLD_MS) {
      results.push({
        severity: 'LOW',
        check: 'Stale Cards',
        finding: `Card '${card.title}' has been in progress with no updates`,
        recommendation:
          'Check if this card is blocked or if the assigned agent needs help. Consider moving it to BLOCKED if there is a dependency.',
      });
    }
  }

  return results;
}

// ─── Check 6: Constitution Violations ────────────────────────────────────────

function checkConstitutionViolations(
  constitution: { content: string } | undefined,
  sdd: { content: string } | undefined,
): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  if (!constitution?.content || !sdd?.content) return results;

  // Extract approved technologies from constitution
  // Look for tech-related sections and extract listed items
  const constitutionLower = constitution.content.toLowerCase();
  const sddLower = sdd.content.toLowerCase();

  // Common technology keywords to check for in the SDD
  const techPatterns = [
    // Frontend frameworks
    'react', 'vue', 'angular', 'svelte', 'next.js', 'nextjs', 'nuxt',
    // Backend frameworks
    'express', 'fastify', 'nest.js', 'nestjs', 'django', 'flask', 'rails', 'spring',
    // Databases
    'postgresql', 'postgres', 'mysql', 'mongodb', 'redis', 'dynamodb', 'sqlite',
    'supabase', 'firebase', 'cockroachdb', 'cassandra',
    // Languages
    'typescript', 'javascript', 'python', 'java', 'go', 'rust', 'ruby', 'php',
    'kotlin', 'swift', 'c#', 'csharp',
    // Cloud & infra
    'aws', 'azure', 'gcp', 'vercel', 'netlify', 'heroku', 'docker', 'kubernetes',
    // ORMs & tools
    'prisma', 'drizzle', 'sequelize', 'typeorm', 'mongoose',
    // Auth
    'auth0', 'clerk', 'nextauth', 'firebase auth', 'cognito',
  ];

  for (const tech of techPatterns) {
    // Tech is in the SDD but NOT mentioned in the constitution
    if (sddLower.includes(tech) && !constitutionLower.includes(tech)) {
      results.push({
        severity: 'HIGH',
        check: 'Constitution Violations',
        finding: `SDD references '${tech}' which is not in the constitution's approved technologies`,
        recommendation: `Either add '${tech}' to the constitution's approved technology list, or update the SDD to use an approved alternative.`,
      });
    }
  }

  return results;
}

// ─── Check 7: Requirement Traceability ────────────────────────────────────────

/**
 * Parse FR-XXX IDs from BRD content and check that every requirement
 * has at least one card whose description contains "Implements: FR-XXX".
 * Reports uncovered requirements as coverage gaps.
 */
function checkRequirementTraceability(
  brd: { content: string } | undefined,
  cards: { title: string; description: string }[],
): AnalysisResult[] {
  const results: AnalysisResult[] = [];
  if (!brd?.content) return results;

  // Extract all FR-XXX IDs from the BRD (e.g., FR-001, FR-012, FR-100)
  const frIdPattern = /\bFR-\d{3,}\b/g;
  const brdRequirementIds = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = frIdPattern.exec(brd.content)) !== null) {
    brdRequirementIds.add(match[0]);
  }

  if (brdRequirementIds.size === 0) return results;

  // Collect all FR-XXX IDs referenced in card descriptions (via "Implements: FR-XXX, FR-YYY")
  const coveredIds = new Set<string>();
  for (const card of cards) {
    if (!card.description) continue;
    const cardMatches = card.description.match(frIdPattern);
    if (cardMatches) {
      for (const id of cardMatches) {
        coveredIds.add(id);
      }
    }
  }

  // Find uncovered requirements
  for (const reqId of brdRequirementIds) {
    if (!coveredIds.has(reqId)) {
      results.push({
        severity: 'HIGH',
        check: 'Requirement Traceability',
        finding: `BRD requirement ${reqId} has no task card implementing it`,
        recommendation: `Create a task card for ${reqId} or add "${reqId}" to an existing card's "Implements:" line and requirementIds parameter.`,
      });
    }
  }

  // Also report cards with no requirement trace (TASK cards only)
  const taskCards = cards.filter(c =>
    c.title.toLowerCase().startsWith('task:') ||
    c.title.toLowerCase().startsWith('task '),
  );
  for (const card of taskCards) {
    if (!card.description || !frIdPattern.test(card.description)) {
      // Reset regex lastIndex since it's global
      frIdPattern.lastIndex = 0;
      results.push({
        severity: 'LOW',
        check: 'Requirement Traceability',
        finding: `Task card '${card.title}' has no BRD requirement IDs linked`,
        recommendation: `Add "Implements: FR-XXX" to the card description to trace it back to a BRD requirement.`,
      });
    }
    frIdPattern.lastIndex = 0;
  }

  return results;
}

// ─── Formatter (for tool output) ──────────────────────────────────────────────

/**
 * Format analysis results as human-readable text for agent tool output.
 */
export function formatAnalysisResults(results: AnalysisResult[]): string {
  if (results.length === 0) {
    return '✅ Cross-artifact analysis complete — no issues found. All artifacts are consistent.';
  }

  const counts = {
    CRITICAL: results.filter(r => r.severity === 'CRITICAL').length,
    HIGH: results.filter(r => r.severity === 'HIGH').length,
    MEDIUM: results.filter(r => r.severity === 'MEDIUM').length,
    LOW: results.filter(r => r.severity === 'LOW').length,
  };

  const lines: string[] = [
    `🔍 Cross-Artifact Consistency Analysis`,
    `══════════════════════════════════════`,
    `Found ${results.length} issue(s): ${counts.CRITICAL} Critical, ${counts.HIGH} High, ${counts.MEDIUM} Medium, ${counts.LOW} Low`,
    '',
  ];

  for (const result of results) {
    const icon =
      result.severity === 'CRITICAL' ? '🔴' :
      result.severity === 'HIGH' ? '🟠' :
      result.severity === 'MEDIUM' ? '🟡' : '🔵';

    lines.push(`${icon} [${result.severity}] ${result.check}`);
    lines.push(`   Finding: ${result.finding}`);
    lines.push(`   Recommendation: ${result.recommendation}`);
    lines.push('');
  }

  return lines.join('\n');
}
