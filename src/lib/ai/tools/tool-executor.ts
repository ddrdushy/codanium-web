// =============================================================================
// AI Team Studio — Tool Executor
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
} from './workspace';
import { prisma } from '@/lib/prisma';

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
    case 'read_file':
      return readFileInWorkspace(projectId, args.path);
    case 'write_file':
      return writeFileInWorkspace(projectId, args.path, args.content);
    case 'edit_file':
      return editFileInWorkspace(projectId, args.path, args.old_string, args.new_string);
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
    case 'create_pr':
      return { message: 'PR creation not yet connected to GitHub API', title: args.title };

    // ── Web ─────────────────────────────────────────────────
    case 'web_search':
      return { message: 'Web search not yet implemented', query: args.query };
    case 'web_fetch':
      return handleWebFetch(args.url);

    // ── Deploy ──────────────────────────────────────────────
    case 'trigger_deploy':
      return { message: `Deploy to ${args.environment} queued`, environment: args.environment };

    // ── Analysis ────────────────────────────────────────────
    case 'run_analysis':
      return handleRunAnalysis(projectId);

    // ── Communication ──────────────────────────────────────
    case 'consult_agent':
      return handleConsultAgent(args, projectId, agentShortName);

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

async function handleCreateCard(
  args: Record<string, any>,
  projectId: string,
  agentId?: string,
) {
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

  const card = await prisma.card.create({
    data: {
      projectId,
      title: args.title,
      description,
      type: args.type || 'TASK',
      priority: args.priority || 'MEDIUM',
      state: 'PLANNED',
      ownerAgentId: agentId,
      module: args.module,
      parentId: args.parentId,
    },
  });
  return { cardId: card.id, title: card.title, state: card.state, requirementIds };
}

async function handleUpdateCard(args: Record<string, any>, projectId: string) {
  const data: any = {};
  if (args.state) data.state = args.state;
  if (args.assigneeId) {
    let assigneeId = args.assigneeId;
    // If assigneeId is a short name (e.g. "JD", "SD"), resolve it to the actual agent ID
    if (!assigneeId.startsWith('usr') && !assigneeId.startsWith('cmm')) {
      const agent = await prisma.agent.findFirst({
        where: { projectId, shortName: assigneeId.toUpperCase() },
        select: { id: true },
      });
      if (agent) assigneeId = agent.id;
    }
    data.assigneeId = assigneeId;
  }
  if (args.priority) data.priority = args.priority;
  if (args.title) data.title = args.title;

  const card = await prisma.card.update({
    where: { id: args.cardId },
    data,
  });
  return { cardId: card.id, title: card.title, state: card.state };
}

async function handleCreateDocument(
  args: Record<string, any>,
  projectId: string,
  agentId?: string,
) {
  const doc = await prisma.document.create({
    data: {
      projectId,
      type: args.type,
      title: args.title,
      content: args.content,
      status: 'DRAFT',
      owner: agentId || 'system',
      wordCount: args.content.split(/\s+/).length,
      sections: (args.content.match(/^#{1,3}\s/gm) || []).length,
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
        title: `Staging: ${args.type} Requirements`,
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
  const doc = await prisma.document.findFirst({
    where: { projectId, type: args.type },
    orderBy: { createdAt: 'desc' },
  });

  if (!doc) {
    throw new Error(`No ${args.type} document found to approve`);
  }

  await prisma.document.update({
    where: { id: doc.id },
    data: { status: 'APPROVED' },
  });
  return { documentId: doc.id, type: args.type, status: 'APPROVED' };
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

  const decision = await prisma.decision.create({
    data: {
      projectId,
      trigger: args.title,
      context: args.description || '',
      status: 'DRAFTED',
      recommendation: args.recommendation || '',
      ownerId,
    },
  });
  return { decisionId: decision.id, trigger: decision.trigger };
}

async function handleRemember(args: Record<string, any>, projectId: string) {
  // ProjectMemory uses category + content + source
  await prisma.projectMemory.create({
    data: {
      projectId,
      category: args.key,
      content: args.value,
      source: 'agent',
    },
  });
  return { key: args.key, stored: true };
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
