// =============================================================================
// AI Team Studio — Tool Executor
// =============================================================================
// Central execution engine for all tool calls. Takes a ToolCall, validates
// the agent's authority, executes the tool, and returns a structured result.
// Bridges between LLM tool calls and actual side effects (DB, filesystem, git).
// =============================================================================

import { type ToolCall, type ToolResult } from './tool-definitions';
import { isToolAuthorized } from './tool-filter';
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
    const result = await executeToolInternal(name, args, projectId, agentId);
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
  // Find the appropriate stage
  const stage = await prisma.sDLCStage.findFirst({
    where: { projectId, status: 'ACTIVE' },
    orderBy: { order: 'desc' },
  });

  const card = await prisma.card.create({
    data: {
      projectId,
      title: args.title,
      description: args.description || '',
      type: args.type || 'TASK',
      priority: args.priority || 'MEDIUM',
      state: 'PLANNED',
      stageId: stage?.id,
      createdById: agentId,
      module: args.module,
      parentId: args.parentId,
    },
  });
  return { cardId: card.id, title: card.title, state: card.state };
}

async function handleUpdateCard(args: Record<string, any>, projectId: string) {
  const data: any = {};
  if (args.state) data.state = args.state;
  if (args.assigneeId) data.assigneeId = args.assigneeId;
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
      version: 1,
      createdById: agentId,
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
    throw new Error(`No ${args.type} document found to update`);
  }

  const newContent = args.mode === 'append'
    ? `${existing.content}\n\n${args.content}`
    : args.content;

  const doc = await prisma.document.update({
    where: { id: existing.id },
    data: { content: newContent, version: existing.version + 1 },
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
  const decision = await prisma.decision.create({
    data: {
      projectId,
      title: args.title,
      description: args.description || '',
      status: 'OPEN',
      options: args.options || [],
      recommendation: args.recommendation,
      createdById: agentId,
    },
  });
  return { decisionId: decision.id, title: decision.title };
}

async function handleRemember(args: Record<string, any>, projectId: string) {
  await prisma.projectMemory.upsert({
    where: {
      projectId_key: { projectId, key: args.key },
    },
    create: {
      projectId,
      key: args.key,
      value: args.value,
    },
    update: {
      value: args.value,
    },
  });
  return { key: args.key, stored: true };
}

// ─── Web Handlers ─────────────────────────────────────────────────────────────

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
