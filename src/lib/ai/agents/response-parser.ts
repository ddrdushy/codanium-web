// =============================================================================
// AI Team Studio — Agent Response Parser
// =============================================================================
// Parses structured markers from raw LLM response text and extracts:
//   - Actions:    [ACTION:type]{json}[/ACTION]
//   - Artifacts:  [ARTIFACT:filename.ext]content[/ARTIFACT]
//   - Delegation: [DELEGATE:AGENT_SHORT_NAME]context[/DELEGATE]
//
// The parser is intentionally lenient — malformed JSON in action markers is
// skipped with a warning rather than crashing the pipeline.
// =============================================================================

import { AgentAction } from './types';

// ─── Public Interface ────────────────────────────────────────────────────────

export interface ParsedResponse {
  /** Clean text with all structured markers removed. */
  message: string;
  /** Extracted actions the agent wants to perform. */
  actions: AgentAction[];
  /** File artifacts the agent produced. */
  artifacts: Array<{ name: string; type: string; content: string }>;
  /** Agent short name to delegate to, if any. */
  delegateTo?: string;
  /** Context string passed to the delegate agent. */
  delegateContext?: string;
}

// ─── Regex Patterns ──────────────────────────────────────────────────────────

// [ACTION:create_card]{"title":"..."}[/ACTION]
const ACTION_REGEX = /\[ACTION:(\w+)\]([\s\S]*?)\[\/ACTION\]/g;

// [ARTIFACT:filename.ext]content here[/ARTIFACT]
const ARTIFACT_REGEX = /\[ARTIFACT:([^\]]+)\]([\s\S]*?)\[\/ARTIFACT\]/g;

// [DELEGATE:BA]context for the BA agent[/DELEGATE]
// Also handles [/DELEGATE:AGENT_NAME] closing tag (LLMs sometimes add the name)
const DELEGATE_REGEX = /\[DELEGATE:(\w+)\]([\s\S]*?)\[\/DELEGATE(?::\w+)?\]/g;

// ─── File Extension to Type Mapping ──────────────────────────────────────────

const EXTENSION_TYPE_MAP: Record<string, string> = {
  ts: 'typescript',
  tsx: 'typescript-react',
  js: 'javascript',
  jsx: 'javascript-react',
  py: 'python',
  java: 'java',
  go: 'go',
  rs: 'rust',
  rb: 'ruby',
  sql: 'sql',
  json: 'json',
  yaml: 'yaml',
  yml: 'yaml',
  md: 'markdown',
  html: 'html',
  css: 'css',
  scss: 'scss',
  sh: 'shell',
  bash: 'shell',
  dockerfile: 'dockerfile',
  xml: 'xml',
  toml: 'toml',
  env: 'env',
  txt: 'text',
  prisma: 'prisma',
  graphql: 'graphql',
  proto: 'protobuf',
  tf: 'terraform',
};

function inferArtifactType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXTENSION_TYPE_MAP[ext] ?? 'text';
}

// ─── Action Parsers ──────────────────────────────────────────────────────────

/**
 * Attempt to parse a raw JSON string from an action marker into a typed AgentAction.
 * Returns null if the JSON is malformed or the action type is unrecognized.
 */
function parseAction(actionType: string, rawJson: string): AgentAction | null {
  let parsed: Record<string, unknown>;

  try {
    parsed = JSON.parse(rawJson.trim());
  } catch {
    console.warn(
      `[ResponseParser] Malformed JSON in [ACTION:${actionType}], skipping. Raw: ${rawJson.slice(0, 200)}`,
    );
    return null;
  }

  switch (actionType) {
    case 'create_card':
      return {
        type: 'create_card',
        data: {
          title: String(parsed.title ?? ''),
          description: parsed.description != null ? String(parsed.description) : undefined,
          type: parsed.type != null ? String(parsed.type) : undefined,
          priority: parsed.priority != null ? String(parsed.priority) : undefined,
          parentId: parsed.parentId != null ? String(parsed.parentId) : undefined,
          module: parsed.module != null ? String(parsed.module) : undefined,
        },
      };

    case 'update_card':
      return {
        type: 'update_card',
        cardId: String(parsed.cardId ?? ''),
        data: {
          state: parsed.data && typeof parsed.data === 'object' && 'state' in parsed.data
            ? String((parsed.data as Record<string, unknown>).state)
            : (parsed.state != null ? String(parsed.state) : undefined),
          title: parsed.data && typeof parsed.data === 'object' && 'title' in parsed.data
            ? String((parsed.data as Record<string, unknown>).title)
            : (parsed.title != null && parsed.cardId != null ? String(parsed.title) : undefined),
          priority: parsed.data && typeof parsed.data === 'object' && 'priority' in parsed.data
            ? String((parsed.data as Record<string, unknown>).priority)
            : (parsed.priority != null && parsed.cardId != null ? String(parsed.priority) : undefined),
        },
      };

    case 'create_decision':
      return {
        type: 'create_decision',
        data: {
          trigger: String(parsed.trigger ?? ''),
          context: parsed.context != null ? String(parsed.context) : undefined,
          riskRating: parsed.riskRating != null ? String(parsed.riskRating) : undefined,
          recommendation: parsed.recommendation != null ? String(parsed.recommendation) : undefined,
          options: Array.isArray(parsed.options)
            ? parsed.options.map((opt: Record<string, unknown>) => ({
                name: String(opt.name ?? ''),
                description: opt.description != null ? String(opt.description) : undefined,
                pros: Array.isArray(opt.pros) ? opt.pros.map(String) : undefined,
                cons: Array.isArray(opt.cons) ? opt.cons.map(String) : undefined,
                risk: opt.risk != null ? String(opt.risk) : undefined,
                effort: opt.effort != null ? String(opt.effort) : undefined,
              }))
            : undefined,
        },
      };

    case 'create_document':
      return {
        type: 'create_document',
        data: {
          title: String(parsed.title ?? ''),
          type: String(parsed.type ?? 'BRD'),
          content: String(parsed.content ?? ''),
          owner: parsed.owner != null ? String(parsed.owner) : undefined,
        },
      };

    case 'update_agent_status':
      return {
        type: 'update_agent_status',
        agentId: String(parsed.agentId ?? ''),
        status: String(parsed.status ?? 'IDLE'),
        task: parsed.task != null ? String(parsed.task) : undefined,
      };

    case 'advance_sdlc':
      return {
        type: 'advance_sdlc',
        stageName: String(parsed.stageName ?? ''),
      };

    case 'create_branch':
      if (!parsed.name) return null;
      return {
        type: 'create_branch',
        data: {
          name: String(parsed.name),
          baseBranch: parsed.baseBranch != null ? String(parsed.baseBranch) : undefined,
        },
      };

    case 'create_pr':
      if (!parsed.title || !parsed.branch) return null;
      return {
        type: 'create_pr',
        data: {
          title: String(parsed.title),
          branch: String(parsed.branch),
          description: parsed.description != null ? String(parsed.description) : undefined,
        },
      };

    case 'create_release':
      if (!parsed.version) return null;
      return {
        type: 'create_release',
        data: {
          version: String(parsed.version),
          features: Array.isArray(parsed.features) ? parsed.features.map(String) : undefined,
        },
      };

    case 'trigger_deploy':
      return {
        type: 'trigger_deploy',
        data: {
          pipelineName: parsed.pipelineName != null ? String(parsed.pipelineName) : undefined,
          environment: parsed.environment != null ? String(parsed.environment) : undefined,
          branch: parsed.branch != null ? String(parsed.branch) : undefined,
        },
      };

    case 'create_pipeline':
      if (!parsed.name || !parsed.environment || !parsed.trigger) return null;
      return {
        type: 'create_pipeline',
        data: {
          name: String(parsed.name),
          environment: String(parsed.environment),
          trigger: String(parsed.trigger),
          config: parsed.config != null ? String(parsed.config) : undefined,
        },
      };

    case 'remember':
      if (!parsed.category || !parsed.content) return null;
      return {
        type: 'remember',
        data: {
          category: String(parsed.category),
          content: String(parsed.content),
        },
      };

    default:
      console.warn(
        `[ResponseParser] Unrecognized action type: "${actionType}", skipping.`,
      );
      return null;
  }
}

// ─── Main Parser ─────────────────────────────────────────────────────────────

/**
 * Parse structured markers from raw LLM response text.
 *
 * Extracts all [ACTION], [ARTIFACT], and [DELEGATE] markers, then strips them
 * from the message text to produce a clean human-readable response.
 */
export function parseAgentResponse(rawContent: string): ParsedResponse {
  const actions: AgentAction[] = [];
  const artifacts: ParsedResponse['artifacts'] = [];
  let delegateTo: string | undefined;
  let delegateContext: string | undefined;

  // ── Extract Actions ──────────────────────────────────────────────────────

  let match: RegExpExecArray | null;
  ACTION_REGEX.lastIndex = 0;
  while ((match = ACTION_REGEX.exec(rawContent)) !== null) {
    const actionType = match[1];
    const actionBody = match[2];
    const action = parseAction(actionType, actionBody);
    if (action) {
      actions.push(action);
    }
  }

  // ── Extract Artifacts ────────────────────────────────────────────────────

  ARTIFACT_REGEX.lastIndex = 0;
  while ((match = ARTIFACT_REGEX.exec(rawContent)) !== null) {
    const filename = match[1].trim();
    const content = match[2];
    artifacts.push({
      name: filename,
      type: inferArtifactType(filename),
      content,
    });
  }

  // ── Extract Delegation ───────────────────────────────────────────────────
  // Only the first [DELEGATE] marker is used; subsequent ones are ignored.

  DELEGATE_REGEX.lastIndex = 0;
  const delegateMatch = DELEGATE_REGEX.exec(rawContent);
  if (delegateMatch) {
    delegateTo = delegateMatch[1].trim();
    delegateContext = delegateMatch[2].trim();
    console.log(
      `[ResponseParser] ✅ Found DELEGATE marker → agent: "${delegateTo}"` +
      ` | context length: ${delegateContext.length}`,
    );
  } else {
    // Check if there's a DELEGATE tag that our regex didn't match
    const hasDelegate = rawContent.includes('[DELEGATE:');
    if (hasDelegate) {
      console.warn(
        `[ResponseParser] ⚠️ Found "[DELEGATE:" in content but regex did NOT match!` +
        ` Raw snippet: "${rawContent.substring(rawContent.indexOf('[DELEGATE:'), rawContent.indexOf('[DELEGATE:') + 120)}"`,
      );
    }
  }

  // ── Clean message text ───────────────────────────────────────────────────
  // Remove all markers and clean up resulting whitespace.

  let message = rawContent
    .replace(ACTION_REGEX, '')
    .replace(ARTIFACT_REGEX, '')
    .replace(DELEGATE_REGEX, '');

  // Collapse multiple blank lines into a single blank line
  message = message.replace(/\n{3,}/g, '\n\n').trim();

  return {
    message,
    actions,
    artifacts,
    delegateTo,
    delegateContext,
  };
}
