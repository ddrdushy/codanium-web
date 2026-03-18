// =============================================================================
// AI Team Studio — Tool Filter
// =============================================================================
// Filters the full tool registry to only include tools an agent is authorized
// to use, based on their canWrite authority from agent definitions.
// =============================================================================

import { ALL_TOOLS, type ToolDefinition } from './tool-definitions';

/**
 * Map of agent shortNames to the tool names they can use.
 * This is the SINGLE SOURCE OF TRUTH for agent tool access.
 */
const AGENT_TOOL_MAP: Record<string, string[]> = {
  // ─── SDLC Agents ───────────────────────────────────────
  BA: [
    'create_document', 'update_document', 'approve_document',
    'create_decision', 'remember', 'task_progress',
    'consult_agent',
  ],
  SA: [
    'create_document', 'update_document', 'approve_document',
    'create_decision', 'remember', 'task_progress',
    'web_search', 'web_fetch',
    'consult_agent',
  ],
  UX: [
    'create_document', 'update_document',
    'write_file', 'read_file', 'list_directory',
    'remember', 'task_progress',
    'web_search', 'web_fetch',
    'consult_agent',
  ],
  PM: [
    'create_card', 'update_card',
    'create_document', 'update_document',
    'create_decision', 'remember', 'task_progress',
    'run_analysis',
    'consult_agent',
  ],
  TL: [
    'create_card', 'update_card',
    'read_file', 'list_directory', 'glob', 'grep',
    'git_branch', 'git_diff',
    'create_decision', 'remember', 'task_progress',
    'consult_agent',
  ],

  // ─── Engineering Agents ─────────────────────────────────
  JD: [
    'read_file', 'write_file', 'edit_file',
    'list_directory', 'glob', 'grep',
    'run_command', 'run_tests', 'run_build',
    'git_commit', 'git_diff', 'create_pr',
    'update_card', 'task_progress',
    'web_search', 'web_fetch',
    'consult_agent',
  ],
  SD: [
    'read_file', 'write_file', 'edit_file',
    'list_directory', 'glob', 'grep',
    'run_command', 'run_tests', 'run_build',
    'git_commit', 'git_diff', 'create_pr',
    'update_card', 'task_progress',
    'web_search', 'web_fetch',
    'consult_agent',
  ],
  QA: [
    'read_file', 'write_file', 'edit_file',
    'list_directory', 'glob', 'grep',
    'run_command', 'run_tests',
    'git_diff',
    'update_card', 'create_card', 'task_progress',
    'validate_code', 'review_changes', 'check_dependencies',
    'run_analysis',
    'consult_agent',
  ],
  AT: [ // Automation Tester
    'read_file', 'write_file',
    'list_directory', 'glob', 'grep',
    'run_command', 'run_tests',
    'task_progress',
    'consult_agent',
  ],
  PF: [ // Performance Engineer
    'read_file', 'list_directory', 'glob', 'grep',
    'run_command',
    'create_document', 'task_progress',
    'consult_agent',
  ],

  // ─── Platform Agents ───────────────────────────────────
  DO: [
    'read_file', 'write_file', 'edit_file',
    'list_directory', 'glob', 'grep',
    'run_command', 'run_build',
    'git_commit', 'git_branch', 'git_diff',
    'trigger_deploy',
    'update_card', 'task_progress',
    'consult_agent',
  ],
  PE: [ // Platform Engineer
    'read_file', 'write_file', 'edit_file',
    'list_directory', 'glob', 'grep',
    'run_command',
    'task_progress',
    'consult_agent',
  ],
  IE: [ // Infrastructure Engineer
    'read_file', 'write_file',
    'run_command',
    'trigger_deploy',
    'task_progress',
    'consult_agent',
  ],
  SM: [ // Site Reliability
    'read_file', 'list_directory', 'glob', 'grep',
    'run_command',
    'task_progress',
    'consult_agent',
  ],
  SR: [ // Security
    'read_file', 'list_directory', 'glob', 'grep',
    'run_command',
    'task_progress',
    'consult_agent',
  ],

  // ─── Governance Agents ─────────────────────────────────
  SEC: [
    'read_file', 'list_directory', 'glob', 'grep',
    'git_diff',
    'update_card', 'create_card',
    'create_document', 'task_progress',
    'validate_code', 'review_changes', 'check_dependencies', 'validate_architecture',
    'run_analysis',
    'consult_agent',
  ],
  ORC: [ // Orchestrator
    'create_card', 'update_card',
    'create_decision', 'remember', 'task_progress',
    'run_analysis',
    'consult_agent',
  ],
  STC: [ // Stakeholder
    'create_decision', 'remember', 'task_progress',
    'consult_agent',
  ],
  DEC: [ // Decision Maker
    'create_decision', 'remember', 'task_progress',
    'consult_agent',
  ],
  AUD: [ // Auditor
    'read_file', 'list_directory', 'glob', 'grep',
    'create_document', 'task_progress',
    'run_analysis',
    'consult_agent',
  ],

  // ─── AI & Cost Agents ──────────────────────────────────
  LLM: [ 'remember', 'task_progress', 'consult_agent' ],
  PRE: [ 'remember', 'task_progress', 'consult_agent' ],
  CA:  [ 'remember', 'task_progress', 'create_document', 'consult_agent' ],
};

/**
 * Get the filtered list of tools available to a specific agent.
 */
export function getToolsForAgent(agentShortName: string): ToolDefinition[] {
  const allowedNames = AGENT_TOOL_MAP[agentShortName];
  if (!allowedNames) {
    console.warn(`[ToolFilter] No tool map for agent: ${agentShortName}, returning empty`);
    return [];
  }
  return ALL_TOOLS.filter(t => allowedNames.includes(t.name));
}

/**
 * Check if an agent is authorized to use a specific tool.
 */
export function isToolAuthorized(agentShortName: string, toolName: string): boolean {
  const allowedNames = AGENT_TOOL_MAP[agentShortName];
  return allowedNames ? allowedNames.includes(toolName) : false;
}
