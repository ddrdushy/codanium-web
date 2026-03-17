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
// Tolerates optional spaces inside brackets: [ ACTION:remember ] or [ACTION:remember]
const ACTION_REGEX = /\[\s*ACTION\s*:\s*(\w+)\s*\]([\s\S]*?)\[\s*\/\s*ACTION\s*\]/gi;

// [ARTIFACT:filename.ext]content here[/ARTIFACT]
// Tolerates optional spaces: [ ARTIFACT:file.md ] or [ARTIFACT:file.md]
const ARTIFACT_REGEX = /\[\s*ARTIFACT\s*:\s*([^\]]+?)\s*\]([\s\S]*?)\[\s*\/\s*ARTIFACT\s*\]/gi;

// [DELEGATE:BA]context for the BA agent[/DELEGATE]
// Also handles [/DELEGATE:AGENT_NAME] closing tag (LLMs sometimes add the name)
// Tolerates optional spaces: [ DELEGATE:SA ] or [DELEGATE:SA]
const DELEGATE_REGEX = /\[\s*DELEGATE\s*:\s*(\w+)\s*\]([\s\S]*?)\[\s*\/\s*DELEGATE\s*(?:\s*:\s*\w+\s*)?\]/gi;

// LLM text-based tool calls — when the model outputs tool calls as text instead of
// using native tool_use. Matches patterns like:
//   [UPDATE_DOCUMENT]{ "type": "BRD", ... }
//   [CREATE_CARD]{ "title": "..." }
//   [REMEMBER]{ "key": "..." }
// Captures the tool name and the JSON body (may be multi-line)
const TEXT_TOOL_CALL_REGEX = /\[\s*(?:UPDATE_DOCUMENT|CREATE_DOCUMENT|APPROVE_DOCUMENT|CREATE_CARD|UPDATE_CARD|CREATE_DECISION|REMEMBER|TASK_PROGRESS|RUN_CODE|TRIGGER_DEPLOY|CREATE_PIPELINE|CREATE_BRANCH|CREATE_PR|CREATE_RELEASE)\s*\]\s*\{[\s\S]*?\}\s*/gi;

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

    case 'approve_document':
      if (!parsed.type) return null;
      return {
        type: 'approve_document',
        data: {
          type: String(parsed.type),
        },
      };

    case 'update_document':
      if (!parsed.type || !parsed.content) return null;
      return {
        type: 'update_document',
        data: {
          type: String(parsed.type),
          content: String(parsed.content),
          mode: parsed.mode === 'replace' ? 'replace' : 'append',
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

    case 'run_code':
      if (!parsed.language || !parsed.code) return null;
      return {
        type: 'run_code',
        data: {
          language: String(parsed.language),
          code: String(parsed.code),
          stdin: parsed.stdin != null ? String(parsed.stdin) : undefined,
          artifactName: parsed.artifactName != null ? String(parsed.artifactName) : undefined,
        },
      };

    case 'create_repo':
      if (!parsed.name) return null;
      return {
        type: 'create_repo',
        data: {
          name: String(parsed.name),
          description: parsed.description != null ? String(parsed.description) : undefined,
          isPrivate: parsed.isPrivate != null ? Boolean(parsed.isPrivate) : undefined,
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

  // ── Extract Delegation FIRST ──────────────────────────────────────────────
  // We need to know where the delegate block starts so we can extract
  // actions/artifacts only from the AGENT's own content, not from
  // instructions meant for the delegate.

  DELEGATE_REGEX.lastIndex = 0;
  const delegateMatch = DELEGATE_REGEX.exec(rawContent);
  let delegateStartIdx = rawContent.length; // Default: no delegate block

  if (delegateMatch) {
    delegateTo = delegateMatch[1].trim();
    delegateContext = delegateMatch[2].trim();
    delegateStartIdx = delegateMatch.index;
    console.log(
      `[ResponseParser] ✅ Found DELEGATE marker → agent: "${delegateTo}"` +
      ` | context length: ${delegateContext.length}`,
    );
  } else {
    // Fallback: handle unclosed [DELEGATE:XX] blocks (model ran out of tokens)
    const unclosedMatch = /\[\s*DELEGATE\s*:\s*(\w+)\s*\]([\s\S]*)$/.exec(rawContent);
    if (unclosedMatch) {
      delegateTo = unclosedMatch[1].trim();
      delegateContext = unclosedMatch[2].trim();
      delegateStartIdx = unclosedMatch.index;
      console.warn(
        `[ResponseParser] ⚠️ Found UNCLOSED [DELEGATE:${delegateTo}] — using rest of content as context` +
        ` | context length: ${delegateContext.length}`,
      );
    }
  }

  // Content BEFORE the delegate block belongs to this agent
  const ownContent = rawContent.substring(0, delegateStartIdx);

  // ── Extract Actions (only from agent's own content) ────────────────────

  let match: RegExpExecArray | null;
  ACTION_REGEX.lastIndex = 0;
  while ((match = ACTION_REGEX.exec(ownContent)) !== null) {
    const actionType = match[1];
    const actionBody = match[2];
    const action = parseAction(actionType, actionBody);
    if (action) {
      actions.push(action);
    }
  }

  // ── Extract Artifacts (only from agent's own content) ──────────────────

  ARTIFACT_REGEX.lastIndex = 0;
  while ((match = ARTIFACT_REGEX.exec(ownContent)) !== null) {
    const filename = match[1].trim();
    const content = match[2];
    artifacts.push({
      name: filename,
      type: inferArtifactType(filename),
      content,
    });
  }

  // ── Clean message text ───────────────────────────────────────────────────
  // Remove all markers and clean up resulting whitespace.

  let message = rawContent
    .replace(ACTION_REGEX, '')
    .replace(ARTIFACT_REGEX, '')
    .replace(DELEGATE_REGEX, '')
    .replace(TEXT_TOOL_CALL_REGEX, '');

  // Also strip unclosed [DELEGATE:XX]...rest of content (if delegation was extracted above)
  if (delegateTo) {
    message = message.replace(/\[\s*DELEGATE\s*:\s*\w+\s*\][\s\S]*$/, '');
  }

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
