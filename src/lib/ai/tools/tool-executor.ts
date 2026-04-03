// =============================================================================
// Codanium — Tool Executor
// =============================================================================
// Central execution engine for all tool calls. Takes a ToolCall, validates
// the agent's authority, executes the tool, and returns a structured result.
// Bridges between LLM tool calls and actual side effects (DB, filesystem, git).
// =============================================================================

import { type ToolCall, type ToolResult } from './tool-definitions';
import { isToolAuthorized } from './tool-filter';
import { runAgentSilent } from '../orchestration/agent-loop';
import {
  analyzeProjectArtifacts,
  formatAnalysisResults,
} from '@/lib/ai/analysis/cross-artifact-analyzer';
import {
  readFileInWorkspace,
  writeFileInWorkspace,
  editFileInWorkspace,
  listDirectoryInWorkspace,
  globInWorkspace,
  grepInWorkspace,
  runCommandInWorkspace,
  gitCommitInWorkspace,
  gitBranchInWorkspace,
  gitDiffInWorkspace,
  getWorkspacePath,
} from './workspace';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import {
  validateCardTransition,
  CardState as LifecycleCardState,
  CardType as LifecycleCardType,
} from '../orchestration/card-lifecycle';
import { pushProjectToGitHub } from '@/lib/git/push';
import { runDeploy } from '@/lib/deploy/runner';

interface ExecuteOptions {
  projectId: string;
  agentShortName: string;
  agentId?: string;
  userId?: string;
}

/**
 * Execute a single tool call.
 * Returns a ToolResult with success/failure and result data.
 */
export async function executeTool(
  toolCall: ToolCall,
  options: ExecuteOptions,
): Promise<ToolResult> {
  const { projectId, agentShortName, agentId } = options;
  const { name, arguments: args } = toolCall;

  // ── Authority check ──
  if (!isToolAuthorized(agentShortName, name)) {
    console.warn(`[ToolExecutor] ⛔ ${agentShortName} not authorized for tool: ${name}`);
    return {
      toolCallId: toolCall.id,
      name,
      success: false,
      result: null,
      error: `Agent ${agentShortName} is not authorized to use tool "${name}"`,
    };
  }

  try {
    const result = await executeToolInternal(name, args, projectId, agentId, agentShortName);
    console.log(`[ToolExecutor] ✅ ${agentShortName} → ${name}(${JSON.stringify(args).slice(0, 100)})`);
    return {
      toolCallId: toolCall.id,
      name,
      success: true,
      result,
    };
  } catch (err: any) {
    console.error(`[ToolExecutor] ❌ ${agentShortName} → ${name}: ${err.message}`);
    return {
      toolCallId: toolCall.id,
      name,
      success: false,
      result: null,
      error: err.message,
    };
  }
}

/**
 * Execute multiple tool calls in sequence.
 */
export async function executeToolCalls(
  toolCalls: ToolCall[],
  options: ExecuteOptions,
): Promise<ToolResult[]> {
  const results: ToolResult[] = [];
  for (const call of toolCalls) {
    const result = await executeTool(call, options);
    results.push(result);
  }
  return results;
}

// ─── Internal dispatch ────────────────────────────────────────────────────────

async function executeToolInternal(
  name: string,
  args: Record<string, any>,
  projectId: string,
  agentId?: string,
  agentShortName?: string,
): Promise<any> {
  switch (name) {
    // ── Project Management ──────────────────────────────────
    case 'create_card':
      return handleCreateCard(args, projectId, agentId);
    case 'update_card':
      return handleUpdateCard(args, projectId);
    case 'create_document':
      return handleCreateDocument(args, projectId, agentId);
    case 'update_document':
      return handleUpdateDocument(args, projectId);
    case 'approve_document':
      return handleApproveDocument(args, projectId);
    case 'create_decision':
      return handleCreateDecision(args, projectId, agentId);
    case 'remember':
      return handleRemember(args, projectId);
    case 'task_progress':
      return { status: args.status, percent: args.percent };

    // ── Filesystem ──────────────────────────────────────────
    case 'read_file': {
      const readPath = args.path;
      if (!readPath || typeof readPath !== 'string' || !readPath.trim()) {
        throw new Error('read_file requires a valid file path. Provide the relative path to the file you want to read.');
      }
      return readFileInWorkspace(projectId, readPath.trim());
    }
    case 'write_file': {
      // Sanitize filename: strip invalid filesystem characters
      if (args.path && typeof args.path === 'string') {
        args.path = args.path.replace(/[?*<>|"\x00-\x1f]/g, '_');
      }

      // Reject mixed routing: Next.js pages/ directory should not be used
      if (args.path && typeof args.path === 'string') {
        const normalizedPath = args.path.replace(/\\/g, '/');
        if (normalizedPath.startsWith('src/pages/api/') || normalizedPath.startsWith('pages/api/')) {
          throw new Error(
            'Invalid path: Do NOT use src/pages/api/ or pages/api/. ' +
            'This project uses the Next.js App Router. All API routes MUST be in src/app/api/ instead. ' +
            'Example: src/app/api/users/route.ts'
          );
        }
      }

      // Dedup check for wireframe files
      if (args.path && typeof args.path === 'string' && args.path.endsWith('.pen')) {
        try {
          const workspace = await getWorkspacePath(projectId);
          const fullPath = path.resolve(workspace, args.path);
          const dir = path.dirname(fullPath);
          const baseName = path.basename(args.path, '.pen')
            .replace(/-page$/, '')    // normalize: "login-page" -> "login"
            .replace(/^wireframe-/, ''); // normalize: "wireframe-login" -> "login"

          const existingFiles = await fs.readdir(dir).catch(() => [] as string[]);
          const penFiles = existingFiles.filter(f => f.endsWith('.pen'));
          for (const existing of penFiles) {
            const existingBase = existing.replace('.pen', '')
              .replace(/-page$/, '')
              .replace(/^wireframe-/, '');
            if (existingBase === baseName && existing !== path.basename(args.path)) {
              console.log(`[ToolExecutor] Skipping duplicate wireframe: ${args.path} (similar to ${existing})`);
              return { success: true, path: args.path, note: `Skipped: similar wireframe "${existing}" already exists` };
            }
          }
        } catch {
          // Non-fatal — proceed with write if dedup check fails
        }
      }
      const writeResult = await writeFileInWorkspace(projectId, args.path, args.content);
      // Persist artifact record so the Generated Code page can display it
      try {
        const filePath = args.path as string;
        const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
        const artifactType = ['json', 'yaml', 'yml', 'toml', 'env', 'gitignore', 'dockerignore']
          .includes(ext) ? 'CONFIG'
          : ['test', 'spec'].some(t => filePath.includes(`.${t}.`)) ? 'TEST'
          : 'CODE';
        const existing = await prisma.artifact.findFirst({
          where: { projectId, name: filePath },
        });
        if (existing) {
          await prisma.artifact.update({
            where: { id: existing.id },
            data: {
              content: args.content,
              ownerAgent: agentShortName ?? 'unknown',
              version: existing.version + 1,
            },
          });
        } else {
          await prisma.artifact.create({
            data: {
              name: filePath,
              type: artifactType as any,
              content: args.content,
              ownerAgent: agentShortName ?? 'unknown',
              projectId,
            },
          });
        }
      } catch (e) {
        console.warn('[write_file] Failed to persist artifact record:', e);
      }
      return writeResult;
    }
    case 'edit_file': {
      const editResult = await editFileInWorkspace(projectId, args.path, args.old_string, args.new_string);
      // Update artifact content after edit
      try {
        const updated = await readFileInWorkspace(projectId, args.path);
        const existing = await prisma.artifact.findFirst({
          where: { projectId, name: args.path },
        });
        if (existing) {
          await prisma.artifact.update({
            where: { id: existing.id },
            data: { content: updated.content, version: existing.version + 1 },
          });
        }
      } catch (e) {
        // Non-fatal
      }
      return editResult;
    }
    case 'list_directory':
      return listDirectoryInWorkspace(projectId, args.path || '.', args.recursive || false);
    case 'glob':
      return globInWorkspace(projectId, args.pattern);
    case 'grep':
      return grepInWorkspace(projectId, args.pattern, args.path, args.filePattern);

    // ── Shell ───────────────────────────────────────────────
    case 'run_command':
      return runCommandInWorkspace(projectId, args.command, args.timeout);
    case 'run_tests':
      return runCommandInWorkspace(projectId, args.testFile ? `npm test -- ${args.testFile}` : 'npm test', 120);
    case 'run_build':
      return runCommandInWorkspace(projectId, 'npm run build', 120);

    // ── Git ─────────────────────────────────────────────────
    case 'git_commit':
      return gitCommitInWorkspace(projectId, args.message, args.files);
    case 'git_branch':
      return gitBranchInWorkspace(projectId, args.name, args.action);
    case 'git_diff':
      return gitDiffInWorkspace(projectId, args.file, args.staged);
    case 'create_pr': {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { gitTokenEncrypted: true, gitRepoOwner: true, gitRepoName: true },
      });
      if (!project?.gitTokenEncrypted || !project?.gitRepoOwner || !project?.gitRepoName) {
        return { error: 'Git integration is not configured for this project. Ask the user to connect a GitHub repository in Project Settings.' };
      }
      const branchName = `codanium/agent-${Date.now()}`;
      const result = await pushProjectToGitHub({
        projectId,
        branchName,
        commitMessage: args.title,
        createPR: true,
        prTitle: args.title,
        triggeredBy: agentShortName ?? 'agent',
      });
      if (!result.success) return { error: result.error ?? 'Failed to create PR' };
      return {
        success: true,
        prNumber: result.pr?.number,
        prUrl: result.pr?.htmlUrl,
        branch: result.branchName,
        filesCount: result.filesCount,
      };
    }

    // ── Web ─────────────────────────────────────────────────
    case 'web_search':
      return { message: 'Web search not yet implemented', query: args.query };
    case 'web_fetch':
      return handleWebFetch(args.url);

    // ── Deploy ──────────────────────────────────────────────
    case 'trigger_deploy': {
      const deployEnv: 'staging' | 'production' = args.environment === 'production' ? 'production' : 'staging';
      const deployResult = await runDeploy({
        projectId,
        environment: deployEnv,
        triggeredBy: agentShortName ?? 'agent',
      });
      if (!deployResult.success) {
        return { error: deployResult.error ?? 'Deployment failed' };
      }
      return {
        success: true,
        environment: deployEnv,
        runId: deployResult.runId,
        deployUrl: deployResult.deployUrl ?? null,
        logs: deployResult.logs,
      };
    }

    // ── Analysis ────────────────────────────────────────────
    case 'run_analysis':
      return handleRunAnalysis(projectId);

    // ── Communication ──────────────────────────────────────
    case 'consult_agent':
      return handleConsultAgent(args, projectId, agentShortName);
    case 'ask_user':
      // Return a special marker that the agent loop will detect to pause the pipeline
      // and show the question to the user via SSE
      return {
        __askUser: true,
        question: args.question,
        context: args.context,
        options: args.options,
        agentShortName: agentShortName ?? 'unknown',
      };

    // ── Guardrails ──────────────────────────────────────────
    case 'validate_code':
      return handleValidateCode(args, projectId);
    case 'review_changes':
      return handleReviewChanges(args, projectId);
    case 'check_dependencies':
      return handleCheckDependencies(args, projectId);
    case 'validate_architecture':
      return handleValidateArchitecture(args, projectId);

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// ─── Project Management Handlers ──────────────────────────────────────────────

// Normalize free-form card type strings to valid CardType enum values
const CARD_TYPE_MAP: Record<string, string> = {
  epic: 'EPIC', feature: 'FEATURE', task: 'TASK', qa: 'QA',
  bug: 'TASK', story: 'FEATURE', subtask: 'TASK',
  decision_blocker: 'DECISION_BLOCKER', blocker: 'DECISION_BLOCKER',
};

function normalizeCardType(raw?: string): string {
  if (!raw) return 'TASK';
  const upper = raw.toUpperCase();
  if (['EPIC', 'FEATURE', 'TASK', 'QA', 'DECISION_BLOCKER'].includes(upper)) return upper;
  return CARD_TYPE_MAP[raw.toLowerCase()] ?? 'TASK';
}

async function handleCreateCard(
  args: Record<string, any>,
  projectId: string,
  agentId?: string,
) {
  if (!args.title || typeof args.title !== 'string' || !args.title.trim()) {
    return { success: false, error: 'Card title is required. Provide a clear, descriptive title.' };
  }

  // Append requirement IDs to description for traceability
  let description = args.description || '';
  const requirementIds: string[] = args.requirementIds || [];
  if (requirementIds.length > 0) {
    const implLine = `\n\nImplements: ${requirementIds.join(', ')}`;
    // Only append if not already present in description
    if (!description.includes('Implements:')) {
      description += implLine;
    }
  }

  // Normalize type to valid enum and clear empty parentId to avoid FK violation
  const cardType = normalizeCardType(args.type);
  const parentId = args.parentId && args.parentId.trim() ? args.parentId : undefined;

  // Map priority to valid enum
  const priorityMap: Record<string, string> = {
    'low': 'LOW', 'medium': 'MEDIUM', 'high': 'HIGH', 'critical': 'CRITICAL',
    'LOW': 'LOW', 'MEDIUM': 'MEDIUM', 'HIGH': 'HIGH', 'CRITICAL': 'CRITICAL',
  };
  const priority = priorityMap[args.priority] || (args.priority ? args.priority.toUpperCase() : 'MEDIUM');

  // Resolve assigneeId shortname to agent DB ID
  let ownerAgentId = agentId;
  if (args.assigneeId) {
    const shortName = args.assigneeId.toUpperCase();
    const agent = await prisma.agent.findFirst({
      where: { projectId, shortName },
      select: { id: true },
    });
    if (agent) ownerAgentId = agent.id;
  }

  // ── Semantic dedup: check for cards with similar titles ────
  const normalizeCardTitle = (title: string): string =>
    title
      .replace(/^(EPIC|Feature|Task|Bug|Story|Card|Implement|Create|Add|Build|Setup|Set up)\s*[:—-]?\s*/i, '')
      .replace(/[^a-z0-9\s]/gi, '')
      .toLowerCase()
      .trim();

  const normalizedNewTitle = normalizeCardTitle(args.title);
  const newWords = normalizedNewTitle.split(/\s+/).filter(w => w.length > 2);

  if (newWords.length > 0) {
    const existingCards = await prisma.card.findMany({
      where: { projectId },
      select: { id: true, title: true, state: true },
    });

    for (const card of existingCards) {
      const normalizedExisting = normalizeCardTitle(card.title);
      const existingWords = normalizedExisting.split(/\s+/).filter(w => w.length > 2);
      if (existingWords.length === 0) continue;

      // Strategy 1: Word overlap (Jaccard similarity)
      const newSet = new Set(newWords);
      const existingSet = new Set(existingWords);
      let overlap = 0;
      for (const word of newSet) {
        if (existingSet.has(word)) overlap++;
      }
      const unionSize = new Set([...newSet, ...existingSet]).size;
      const jaccardSimilarity = unionSize > 0 ? overlap / unionSize : 0;

      // Strategy 2: Substring containment (catches "User Auth" vs "User Authentication Module")
      const containsMatch = normalizedNewTitle.includes(normalizedExisting) || normalizedExisting.includes(normalizedNewTitle);

      if (jaccardSimilarity > 0.5 || containsMatch) {
        console.log(`[ToolExecutor] Semantic dedup: "${args.title}" ~= "${card.title}" (jaccard=${(jaccardSimilarity * 100).toFixed(0)}%, contains=${containsMatch})`);
        return { cardId: card.id, title: card.title, state: card.state, requirementIds, deduplicated: true };
      }
    }
  }

  // ── BUG-006 fix: Deduplicate by title within the same project (case-insensitive) ─────
  const existing = await prisma.card.findFirst({
    where: { projectId, title: { equals: args.title, mode: 'insensitive' } },
    select: { id: true, title: true, state: true },
  });
  if (existing) {
    return { cardId: existing.id, title: existing.title, state: existing.state, requirementIds, deduplicated: true };
  }

  const card = await prisma.card.create({
    data: {
      projectId,
      title: args.title,
      description,
      type: cardType as any,
      priority,
      state: 'PLANNED',
      ownerAgentId,
      module: args.module,
      parentId,
    },
  });
  return { cardId: card.id, title: card.title, state: card.state, requirementIds };
}

async function handleUpdateCard(args: Record<string, any>, projectId: string) {
  const data: any = {};

  // Map state to valid Prisma CardState enum value
  if (args.state) {
    const stateMap: Record<string, string> = {
      'PLANNED': 'PLANNED',
      'TODO': 'PLANNED',
      'IN_PROGRESS': 'IN_PROGRESS',
      'REVIEW': 'UNDER_REVIEW',
      'UNDER_REVIEW': 'UNDER_REVIEW',
      'TESTING': 'TESTING',
      'DONE': 'DONE',
      'BLOCKED': 'BLOCKED',
      'RELEASED': 'RELEASED',
    };
    data.state = stateMap[args.state.toUpperCase()] || args.state;
  }

  // Resolve assigneeId shortname to ownerAgentId (assigneeId FK points to User table,
  // so we use ownerAgentId which points to Agent table)
  if (args.assigneeId) {
    let resolvedAgentId = args.assigneeId;
    // If it's a short name (e.g. "JD", "SD", "UX", "DO"), resolve to agent DB ID
    if (!resolvedAgentId.startsWith('usr') && !resolvedAgentId.startsWith('cmm')) {
      const agent = await prisma.agent.findFirst({
        where: { projectId, shortName: resolvedAgentId.toUpperCase() },
        select: { id: true },
      });
      if (agent) resolvedAgentId = agent.id;
    }
    // Use ownerAgentId (references Agent table), NOT assigneeId (references User table)
    data.ownerAgentId = resolvedAgentId;
  }

  // Map priority to valid enum
  if (args.priority) {
    const priorityMap: Record<string, string> = {
      'low': 'LOW', 'medium': 'MEDIUM', 'high': 'HIGH', 'critical': 'CRITICAL',
      'LOW': 'LOW', 'MEDIUM': 'MEDIUM', 'HIGH': 'HIGH', 'CRITICAL': 'CRITICAL',
    };
    data.priority = priorityMap[args.priority] || args.priority.toUpperCase();
  }
  if (args.title) data.title = args.title;
  if (args.description) data.description = args.description;

  // ── Validate state transitions (same as API route) ──────────────────────
  if (data.state) {
    const existing = await prisma.card.findUnique({
      where: { id: args.cardId },
      select: { state: true, type: true, projectId: true },
    });
    if (!existing) {
      return { success: false, error: `Card ${args.cardId} not found` };
    }
    if (data.state !== existing.state) {
      const transitionResult = await validateCardTransition(
        args.cardId,
        projectId,
        existing.state as LifecycleCardState,
        data.state as LifecycleCardState,
        existing.type as LifecycleCardType,
      );
      if (!transitionResult.allowed) {
        return {
          success: false,
          error: `State transition from ${existing.state} to ${data.state} is not allowed: ${transitionResult.reason}`,
          requirements: transitionResult.requirements,
        };
      }
    }
  }

  const card = await prisma.card.update({
    where: { id: args.cardId },
    data,
  });
  return { cardId: card.id, title: card.title, state: card.state, ownerAgentId: data.ownerAgentId };
}

async function handleCreateDocument(
  args: Record<string, any>,
  projectId: string,
  agentId?: string,
) {
  const content = args.content || '';
  const title = args.title || `${args.type || 'Document'} - Draft`;

  if (!args.type) {
    return { error: 'Document type is required (e.g., BRD, SDD)' };
  }

  // Upsert: if a document of this type already exists for this project, update it instead of creating a duplicate
  const existing = await prisma.document.findFirst({
    where: { projectId, type: args.type },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    console.log(`[ToolExecutor] Updating existing ${args.type} document (${existing.id}) instead of creating duplicate`);
    const newContent = content || existing.content;
    const doc = await prisma.document.update({
      where: { id: existing.id },
      data: {
        title: title || existing.title,
        content: newContent,
        owner: agentId || existing.owner,
        wordCount: newContent.split(/\s+/).length,
        sections: (newContent.match(/^#{1,3}\s/gm) || []).length,
      },
    });
    return { documentId: doc.id, type: doc.type, title: doc.title, status: doc.status, updated: true };
  }

  const doc = await prisma.document.create({
    data: {
      projectId,
      type: args.type,
      title,
      content,
      status: 'DRAFT',
      owner: agentId || 'system',
      wordCount: content.split(/\s+/).length,
      sections: (content.match(/^#{1,3}\s/gm) || []).length,
    },
  });
  return { documentId: doc.id, type: doc.type, title: doc.title, status: doc.status };
}

async function handleUpdateDocument(args: Record<string, any>, projectId: string) {
  const existing = await prisma.document.findFirst({
    where: { projectId, type: args.type },
    orderBy: { createdAt: 'desc' },
  });

  if (!existing) {
    // Auto-create the document if it doesn't exist (e.g., first update_document(BRD) call)
    console.log(`[ToolExecutor] Auto-creating ${args.type} document (didn't exist yet)`);
    const doc = await prisma.document.create({
      data: {
        projectId,
        type: args.type,
        title: args.title || `Business Requirements Document`,
        content: args.content || '',
        status: 'DRAFT',
        owner: 'system',
        wordCount: (args.content || '').split(/\s+/).length,
        sections: ((args.content || '').match(/^#{1,3}\s/gm) || []).length,
      },
    });
    return { documentId: doc.id, type: doc.type, created: true };
  }

  const newContent = args.mode === 'append'
    ? `${existing.content}\n\n${args.content}`
    : args.content;

  const doc = await prisma.document.update({
    where: { id: existing.id },
    data: {
      content: newContent,
      wordCount: newContent.split(/\s+/).length,
      sections: (newContent.match(/^#{1,3}\s/gm) || []).length,
    },
  });
  return { documentId: doc.id, type: doc.type, updated: true };
}

async function handleApproveDocument(args: Record<string, any>, projectId: string) {
  // Documents cannot be self-approved by agents. They must go through
  // the user approval flow via My Decisions. This tool now creates a
  // decision for user approval instead of directly approving.
  const doc = await prisma.document.findFirst({
    where: { projectId, type: args.type },
    orderBy: { createdAt: 'desc' },
  });

  if (!doc) {
    throw new Error(`No ${args.type} document found to approve`);
  }

  // Instead of directly approving, create a decision for user sign-off
  const member = await prisma.projectMember.findFirst({
    where: { projectId },
    select: { userId: true },
  });
  const ownerId = member?.userId || 'usr-001';
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { name: true },
  });
  const projectName = project?.name || 'this project';
  const docLabel = args.type === 'BRD' ? 'Business Requirements Document' : args.type === 'SDD' ? 'System Design Document' : args.type;

  const decision = await prisma.decision.create({
    data: {
      projectId,
      trigger: `${args.type} Approval: ${projectName}`,
      context: `The ${docLabel} is ready for review and approval. Please review the document in the Documents section and approve or request changes.`,
      status: 'AWAITING_APPROVAL',
      recommendation: `Approve the ${args.type} — the document has been reviewed and is ready for the next phase.`,
      ownerId,
      options: {
        create: [
          { name: `Approve ${args.type} — proceed to next phase`, description: `The ${docLabel} is complete and ready`, pros: { set: ['Document is complete', 'Ready to proceed'] }, cons: { set: ['Changes require re-approval'] } },
          { name: 'Request changes', description: `Send back for revisions`, pros: { set: ['Opportunity to refine'] }, cons: { set: ['Delays the project'] } },
        ],
      },
    },
  });

  return {
    documentId: doc.id,
    type: args.type,
    status: 'AWAITING_APPROVAL',
    decisionId: decision.id,
    message: `${args.type} sent to My Decisions for user approval. The user must approve before proceeding.`,
  };
}

async function handleCreateDecision(
  args: Record<string, any>,
  projectId: string,
  agentId?: string,
) {
  // Decision model: trigger (title), context (description), ownerId, status=DRAFTED
  // Need a valid user ID for ownerId — use first project member or system user
  const member = await prisma.projectMember.findFirst({
    where: { projectId },
    select: { userId: true },
  });
  const ownerId = member?.userId || 'usr-001'; // fallback to default user

  // Parse options from tool args
  const options: Array<{ label: string; pros: string; cons: string }> = args.options || [];
  const hasOptions = options.length > 0;

  const decision = await prisma.decision.create({
    data: {
      projectId,
      trigger: args.title,
      context: args.description || '',
      status: hasOptions ? 'AWAITING_APPROVAL' : 'DRAFTED',
      recommendation: args.recommendation || '',
      ownerId,
      options: hasOptions ? {
        create: options.map((opt) => {
          // Normalize pros/cons — LLM may send string, array, or nothing
          const prosArr = Array.isArray(opt.pros) ? opt.pros : (opt.pros ? [String(opt.pros)] : []);
          const consArr = Array.isArray(opt.cons) ? opt.cons : (opt.cons ? [String(opt.cons)] : []);
          return {
            name: opt.label || (prosArr[0] || '').substring(0, 50) || 'Option',
            description: `${prosArr.join(', ')}\n${consArr.join(', ')}`.trim(),
            pros: { set: prosArr.map(String) },
            cons: { set: consArr.map(String) },
          };
        }),
      } : undefined,
    },
    include: { options: true },
  });
  return {
    decisionId: decision.id,
    trigger: decision.trigger,
    status: decision.status,
    optionCount: decision.options?.length || 0,
    message: hasOptions
      ? 'Decision created and sent to user for approval in My Decisions menu.'
      : 'Decision drafted. Add options to send for user approval.',
  };
}

async function handleRemember(args: Record<string, any>, projectId: string) {
  // Accept both key/value and category/content parameter names
  const category = args.key || args.category || 'general';
  const content = args.value || args.content || JSON.stringify(args);
  await prisma.projectMemory.create({
    data: {
      projectId,
      category,
      content,
      source: 'agent',
    },
  });
  return { key: category, stored: true };
}

// ─── Web Handlers ─────────────────────────────────────────────────────────────

// ─── Guardrail Handlers ───────────────────────────────────────────────────────

async function handleValidateCode(args: Record<string, any>, projectId: string) {
  const commands: string[] = [];
  const checks = args.checks || ['all'];
  const target = args.path || '.';

  if (checks.includes('all') || checks.includes('syntax')) {
    commands.push(`npx tsc --noEmit ${target !== '.' ? target : ''} 2>&1 || true`);
  }
  if (checks.includes('all') || checks.includes('lint')) {
    commands.push(`npx eslint ${target} --max-warnings 0 2>&1 || true`);
  }
  if (checks.includes('all') || checks.includes('security')) {
    commands.push('npm audit --json 2>&1 | head -100 || true');
  }

  const results = [];
  for (const cmd of commands) {
    const result = await runCommandInWorkspace(projectId, cmd, 60);
    results.push({ command: cmd.split(' ')[1], output: result.stdout.slice(0, 5000), exitCode: result.exitCode });
  }
  return { checks: results, path: target };
}

async function handleReviewChanges(args: Record<string, any>, projectId: string) {
  const scope = args.scope || 'all';
  const diffFlag = scope === 'staged' ? '--cached' : '';
  const result = await runCommandInWorkspace(projectId, `git diff ${diffFlag} --stat 2>&1`, 30);
  const diffContent = await runCommandInWorkspace(projectId, `git diff ${diffFlag} 2>&1 | head -500`, 30);
  return {
    scope,
    summary: result.stdout.slice(0, 5000),
    diff: diffContent.stdout.slice(0, 20000),
  };
}

async function handleCheckDependencies(args: Record<string, any>, projectId: string) {
  const auditResult = await runCommandInWorkspace(projectId, 'npm audit 2>&1 | tail -20', 60);
  const outdatedResult = await runCommandInWorkspace(projectId, 'npm outdated 2>&1 | head -30 || true', 30);

  if (args.fix) {
    await runCommandInWorkspace(projectId, 'npm audit fix 2>&1 || true', 120);
  }

  return {
    audit: auditResult.stdout.slice(0, 5000),
    outdated: outdatedResult.stdout.slice(0, 5000),
    fixed: !!args.fix,
  };
}

async function handleValidateArchitecture(args: Record<string, any>, projectId: string) {
  // Check for circular imports and module boundary violations
  const circularCheck = await runCommandInWorkspace(
    projectId,
    'npx madge --circular --extensions ts,tsx src/ 2>&1 | head -50 || echo "madge not installed"',
    60,
  );
  return {
    circularDependencies: circularCheck.stdout.slice(0, 5000),
    exitCode: circularCheck.exitCode,
  };
}

async function handleRunAnalysis(projectId: string) {
  const results = await analyzeProjectArtifacts(projectId);
  return {
    findings: results,
    summary: {
      total: results.length,
      critical: results.filter(r => r.severity === 'CRITICAL').length,
      high: results.filter(r => r.severity === 'HIGH').length,
      medium: results.filter(r => r.severity === 'MEDIUM').length,
      low: results.filter(r => r.severity === 'LOW').length,
    },
    formatted: formatAnalysisResults(results),
  };
}

// ─── Communication Handlers ───────────────────────────────────────────────────

const MAX_CONSULT_DEPTH = 3;

async function handleConsultAgent(
  args: Record<string, any>,
  projectId: string,
  agentShortName?: string,
) {
  const targetAgent: string = args.agent;
  const question: string = args.question;

  // Prevent self-consultation
  if (agentShortName && targetAgent === agentShortName) {
    throw new Error(`Agent ${agentShortName} cannot consult itself.`);
  }

  // Run the target agent silently and collect its response
  const result = await runAgentSilent(targetAgent, question, projectId, 1);

  return { agent: targetAgent, response: result };
}

async function handleWebFetch(url: string) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'AI-Team-Studio/1.0' },
      signal: AbortSignal.timeout(15000),
    });
    const text = await response.text();
    // Truncate to avoid token overload
    return { url, status: response.status, content: text.slice(0, 10000) };
  } catch (err: any) {
    throw new Error(`Failed to fetch ${url}: ${err.message}`);
  }
}
