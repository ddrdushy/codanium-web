'use client';

import React, { useState, useRef, useEffect, useCallback, memo, useMemo } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAgents, checkLLMHealth } from '@/lib/api';

import { useAgentStream } from '@/lib/hooks/use-agent-stream';
import { useProjectStream } from '@/lib/hooks/use-project-stream';
import { Agent } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Send, Bot, User, Sparkles, ChevronDown, Paperclip,
  Code2, FileText, CheckCircle2, AlertTriangle, Clock,
  MessageSquare, Zap, Eye, Terminal, Copy, ThumbsUp,
  RotateCcw, ArrowRight, Loader2, Square, Settings, TestTube, X,
  Wrench, Pencil, FolderOpen, Play, Search, GitBranch,
  Shield, Palette, LayoutList, ArrowRightLeft
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Error boundary that catches render errors in the chat area
 * and shows a recovery UI instead of crashing the entire tab.
 */
class ChatErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 p-8">
          <AlertTriangle className="w-8 h-8 text-amber" />
          <p className="text-sm text-muted-foreground">Something went wrong rendering the chat.</p>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber/10 text-amber border border-amber/20 rounded-lg hover:bg-amber/20 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

/**
 * Strip raw agent markers ([ACTION:...], [DELEGATE:...], etc.) from content
 * before displaying in the chat UI. These markers are parsed server-side
 * for side effects but may leak through during streaming or DB storage.
 * Handles multi-line markers, bold-wrapped markers, and partial markers.
 */
function stripAgentMarkers(content: string): string {
  return content
    // Full [ACTION:xxx]...content...[/ACTION] blocks (including multi-line)
    // Handles spaces: [ ACTION:remember ], [ACTION:remember], **[ACTION:remember]** etc.
    .replace(/\*{0,2}\[\s*ACTION\s*:\s*\w+\s*\]\*{0,2}[\s\S]*?\*{0,2}\[\s*\/\s*ACTION\s*\]\*{0,2}/gi, '')
    // Full [DELEGATE:xxx]...content...[/DELEGATE] blocks (with optional spaces)
    .replace(/\[\s*DELEGATE\s*:\s*\w+\s*\][\s\S]*?\[\s*\/\s*DELEGATE\s*(?::\s*\w+\s*)?\]/gi, '')
    // Full [ARTIFACT:xxx]...content...[/ARTIFACT] blocks (with optional spaces)
    .replace(/\[\s*ARTIFACT\s*:[^\]]*\][\s\S]*?\[\s*\/\s*ARTIFACT\s*\]/gi, '')
    // Standalone opening tags (orphaned — no closing tag found)
    .replace(/\*{0,2}\[\s*ACTION\s*:\s*\w+\s*\]\*{0,2}[^[\n]*$/gm, '')
    .replace(/^\s*\*{0,2}\[\s*\/\s*ACTION\s*\]\*{0,2}/gm, '')
    .replace(/\[\s*DELEGATE\s*:\s*\w+\s*\]\s*$/gm, '')
    .replace(/^\s*\[\s*\/\s*DELEGATE\s*(?::\s*\w+\s*)?\]/gm, '')
    // Strip text-based tool calls in two formats:
    //   [UPDATE_DOCUMENT]{ "type": "BRD", ... }    (bracket then JSON)
    //   [REMEMBER {"key":"x","value":"y"}]          (JSON inside brackets)
    .replace(/\[\s*(?:UPDATE_DOCUMENT|CREATE_DOCUMENT|APPROVE_DOCUMENT|CREATE_CARD|UPDATE_CARD|CREATE_DECISION|REMEMBER|TASK_PROGRESS|RUN_CODE|TRIGGER_DEPLOY|CREATE_PIPELINE|CREATE_BRANCH|CREATE_PR|CREATE_RELEASE)\s*(?:\{[\s\S]*?\}\s*\]|\]\s*\{[\s\S]*?\})\s*/gi, '')
    // Strip agent name prefixes like "[BA]", "[SA]", "[DEC]", "[ORC]" at start of lines
    .replace(/^\s*\[\s*(?:BA|SA|DEC|ORC|QA|UX|TL|FE|BE|DB|SE|PE|DO|IE|SM|CA|AUD|PM|DA|ML|DOC|TE|COM)\s*\]\s*/gm, '')
    // Strip repetition loops — any short pattern repeated 5+ times (e.g. "[TL] [TL] [TL]...")
    .replace(/(.{2,20})\1{4,}/g, '*[Repetitive content removed]*')
    // Strip inline agent tags that aren't at start of line (e.g. "[TL] [TL] [TL]")
    .replace(/(\[\s*(?:BA|SA|QA|UX|TL|FE|BE|DB|SE|PE|DO|IE|SM|CA|AUD|PM|DA|ML|DOC|TE|COM)\s*\]\s*){3,}/gi, '')
    // XML tool calls: <tool_call>...</tool_call>
    .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, '')
    // Anthropic-style: <function=name>...</function> or self-closing <function=name>
    .replace(/<function=[^>]*>[\s\S]*?<\/function>/gi, '')
    .replace(/<function=[^>]*\/?>/gi, '')
    // Parameter blocks: <parameter=name>...</parameter>
    .replace(/<parameter=[^>]*>[\s\S]*?<\/parameter>/gi, '')
    // ChatML/Qwen: <|tool_call|>...<|end|>
    .replace(/<\|tool_call\|>[\s\S]*?<\|end\|>/gi, '')
    // [ACTION:...] inline markers
    .replace(/\[ACTION:[^\]]*\]/gi, '')
    // Clean up whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract option buttons from agent markdown content.
 * Matches patterns like "- **A)** Some option text" or "- **B)** Another option"
 * Detects "(Recommended)" suffix on options for visual highlighting.
 * Detects multi-select when content contains "(select all that apply)".
 */
function extractOptions(content: string): {
  cleanContent: string;
  options: { label: string; text: string; recommended: boolean }[];
  multiSelect: boolean;
} {
  // Strip agent markers first
  const stripped = stripAgentMarkers(content);
  // Flexible regex handles multiple format variations:
  // "- **A)** text", "* **A)** text", "• **A)** text", "- **A) text**"
  // Also handles plain format without bold: "- A) text", "• A) text"
  const optionRegex = /^[-*•]?\s*\*{0,2}([A-F])\)\*{0,2}\s+(.+)$/gm;
  const options: { label: string; text: string; recommended: boolean }[] = [];
  let match;
  while ((match = optionRegex.exec(stripped)) !== null) {
    // Skip duplicate labels (agent sometimes outputs options twice in different formats)
    if (options.some(o => o.label === match![1])) continue;
    let rawText = match[2].trim();
    // Skip recap items like "No email integration now** (you chose this option)."
    if (/\(you chose/i.test(rawText)) continue;
    // Strip trailing bold markers: "text**" → "text"
    rawText = rawText.replace(/\*{1,2}$/, '').trim();
    // Strip trailing bold+period: "text**." → "text"
    rawText = rawText.replace(/\*{1,2}\.?\s*$/, '').trim();
    const recommended = /\(recommended\)\.?/i.test(rawText);
    const text = rawText.replace(/\s*\(recommended\)\.?/i, '').trim();
    options.push({ label: match[1], text, recommended });
  }
  if (options.length === 0) return { cleanContent: stripped.replace(/\n{3,}/g, '\n\n').trim(), options: [], multiSelect: false };
  const multiSelect = /\(select all that apply\)/i.test(stripped);
  // Remove option lines from content (same flexible pattern)
  const cleanContent = stripped.replace(/^[-*•]?\s*\*{0,2}[A-F]\)\*{0,2}\s+.+$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
  return { cleanContent, options, multiSelect };
}

/**
 * Memoized markdown renderer — prevents expensive re-parsing
 * on parent re-renders when the content hasn't changed.
 * Also strips raw agent markers before rendering.
 */
const MemoizedMarkdown = memo(function MemoizedMarkdown({ content }: { content: string }) {
  const cleaned = stripAgentMarkers(content);
  return <ReactMarkdown remarkPlugins={[remarkGfm]}>{cleaned}</ReactMarkdown>;
});

/**
 * Lightweight streaming text renderer — displays plain text during streaming
 * instead of running ReactMarkdown on every token batch (~30fps).
 *
 * ReactMarkdown parses markdown into an AST and generates a full React tree
 * on every render. At 30fps with growing content, this causes exponential
 * CPU usage and crashes the browser tab.
 *
 * This component strips agent markers (cheap regex) and renders as
 * pre-wrapped text. Full markdown formatting is applied after streaming
 * completes when messages refetch from DB.
 */
const StreamingText = memo(function StreamingText({ content }: { content: string }) {
  // Strip agent markers and option lines (lightweight vs full markdown parse)
  const cleaned = stripAgentMarkers(content);
  // Render bold text minimally: **text** → <strong>text</strong>
  const parts = cleaned.split(/(\*\*[^*]+\*\*)/g);
  return (
    <div className="whitespace-pre-wrap">
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i}>{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
});

// ─── Tool Activity Icon/Label Map ──────────────────────────────────────────
const TOOL_META: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  write_file:      { icon: Code2,        label: 'Writing file',         color: 'text-emerald-400' },
  edit_file:       { icon: Pencil,       label: 'Editing file',         color: 'text-blue-400' },
  read_file:       { icon: FileText,     label: 'Reading file',         color: 'text-zinc-400' },
  list_directory:  { icon: FolderOpen,   label: 'Scanning directory',   color: 'text-zinc-400' },
  glob:            { icon: Search,       label: 'Searching files',      color: 'text-zinc-400' },
  run_build:       { icon: Play,         label: 'Running build',        color: 'text-amber' },
  run_tests:       { icon: TestTube,     label: 'Running tests',        color: 'text-violet-400' },
  create_card:     { icon: LayoutList,   label: 'Creating task card',   color: 'text-amber' },
  update_card:     { icon: LayoutList,   label: 'Updating card',        color: 'text-amber' },
  task_progress:   { icon: CheckCircle2, label: 'Updating progress',    color: 'text-emerald-400' },
  delegate:        { icon: ArrowRightLeft, label: 'Delegating to agent', color: 'text-purple-400' },
  ask_user:        { icon: MessageSquare, label: 'Asking user',         color: 'text-amber' },
  create_decision: { icon: Zap,          label: 'Creating decision',    color: 'text-amber' },
  security_scan:   { icon: Shield,       label: 'Security scan',        color: 'text-red-400' },
  create_wireframe:{ icon: Palette,      label: 'Creating wireframe',   color: 'text-pink-400' },
};

function getToolMeta(name: string) {
  return TOOL_META[name] || { icon: Wrench, label: name.replace(/_/g, ' '), color: 'text-muted-foreground' };
}

/**
 * Live Activity Log — shows real-time tool calls during streaming.
 * Appears below the streaming message bubble with animated entries.
 */
const LiveActivityLog = memo(function LiveActivityLog({
  activities,
  pipelineProgress
}: {
  activities: { name: string; arguments?: Record<string, unknown>; result?: string; success?: boolean; status: 'calling' | 'completed' | 'failed' }[];
  pipelineProgress: { fromAgent: string; toAgent: string; depth: number; maxDepth: number } | null;
}) {
  if (activities.length === 0 && !pipelineProgress) return null;

  // Show last 8 activities to avoid overwhelming the UI
  const visible = activities.slice(-8);

  return (
    <div className="mt-2 space-y-1">
      {/* Pipeline handoff indicator */}
      {pipelineProgress && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 text-[10px] text-purple-400 bg-purple-500/[0.06] border border-purple-500/15 rounded-lg px-2.5 py-1.5"
        >
          <ArrowRightLeft className="w-3 h-3 shrink-0" />
          <span className="font-medium">{pipelineProgress.fromAgent}</span>
          <ArrowRight className="w-2.5 h-2.5" />
          <span className="font-medium">{pipelineProgress.toAgent}</span>
          <span className="text-purple-400/50 ml-auto">step {pipelineProgress.depth}/{pipelineProgress.maxDepth}</span>
        </motion.div>
      )}

      {/* Tool activity entries */}
      <AnimatePresence mode="popLayout">
        {visible.map((activity, i) => {
          const meta = getToolMeta(activity.name);
          const Icon = meta.icon;
          const isActive = activity.status === 'calling';
          const isFailed = activity.status === 'failed';

          // Extract filename from arguments for display
          const fileName = activity.arguments?.path as string
            || activity.arguments?.filePath as string
            || activity.arguments?.file as string
            || activity.arguments?.cardId as string
            || '';
          const shortFile = fileName ? fileName.split('/').pop() || fileName : '';

          return (
            <motion.div
              key={`${activity.name}-${i}-${activities.length}`}
              initial={{ opacity: 0, x: -10, height: 0 }}
              animate={{ opacity: 1, x: 0, height: 'auto' }}
              exit={{ opacity: 0, x: 10, height: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'flex items-center gap-2 text-[10px] rounded-md px-2 py-1 transition-colors',
                isActive && 'bg-white/[0.03] text-foreground/70',
                !isActive && !isFailed && 'text-muted-foreground/40',
                isFailed && 'text-red-400/60'
              )}
            >
              {isActive ? (
                <Loader2 className={cn('w-3 h-3 animate-spin shrink-0', meta.color)} />
              ) : isFailed ? (
                <AlertTriangle className="w-3 h-3 shrink-0 text-red-400" />
              ) : (
                <CheckCircle2 className="w-3 h-3 shrink-0 text-emerald-500/50" />
              )}
              <span className={cn('font-medium', isActive && meta.color)}>
                {meta.label}
              </span>
              {shortFile && (
                <span className="font-mono text-[9px] text-muted-foreground/30 truncate max-w-[140px]">
                  {shortFile}
                </span>
              )}
              {isActive && (
                <span className="ml-auto flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-amber animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-amber animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-amber animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>

      {/* Summary line when many activities */}
      {activities.length > 8 && (
        <div className="text-[9px] text-muted-foreground/30 pl-5">
          {activities.filter(a => a.status === 'completed').length} completed · {activities.filter(a => a.status === 'calling').length} in progress
        </div>
      )}
    </div>
  );
});

interface ChatMessage {
  id: string;
  role: 'user' | 'agent' | 'system';
  agent?: Agent;
  content: string;
  timestamp: string;
  thinking?: string;
  artifacts?: { name: string; type: string }[];
  action?: { label: string; status: 'pending' | 'approved' | 'rejected' };
  codeBlock?: { language: string; code: string };
}

// No demo messages — real chat only. If no messages exist, show empty state.

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage() {
  const params = useParams();
  const projectId = params.id as string;
  const searchParams = useSearchParams();
  const router = useRouter();
  const cardId = searchParams.get('cardId') ?? undefined;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showThinking, setShowThinking] = useState<string | null>(null);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showStreamThinking, setShowStreamThinking] = useState(true);
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(30);
  const sendRef = useRef<(text: string) => void>(() => {});
  const isSendingRef = useRef(false); // Prevent double-sends (race condition guard)
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [sidebarArtifacts, setSidebarArtifacts] = useState<Array<{id: string; name: string; type: string; ownerAgent: string}>>([]);
  const [llmConfigured, setLlmConfigured] = useState<boolean | null>(null);
  const [showVSCodePrompt, setShowVSCodePrompt] = useState(false);
  const [llmError, setLlmError] = useState<string | undefined>(undefined);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    send: streamSend,
    stop: streamStop,
    isStreaming,
    currentAgent,
    streamContent,
    streamThinking,
    artifacts: streamArtifacts,
    toolActivities,
    completedMessageId,
    usage,
    error: streamError,
    pipelineProgress,
    vscodeRequired,
  } = useAgentStream();

  const {
    isBackgroundStreaming,
    backgroundAgent,
    backgroundContent,
    backgroundThinking,
    backgroundArtifacts,
    backgroundToolActivities,
    backgroundPipelineProgress,
    backgroundError,
  } = useProjectStream(projectId);

  // Compute effective stream properties (Interactive stream takes precedence)
  const showStreamBubble = isStreaming || isBackgroundStreaming;
  const activeAgent = isStreaming ? currentAgent : backgroundAgent;
  const activeContent = isStreaming ? streamContent : backgroundContent;
  const activeThinking = isStreaming ? streamThinking : backgroundThinking;
  const activeArtifacts = isStreaming ? streamArtifacts : backgroundArtifacts;
  const activeToolActivities = isStreaming ? toolActivities : backgroundToolActivities;
  const activePipelineProgress = isStreaming ? pipelineProgress : backgroundPipelineProgress;
  const activeError = isStreaming ? streamError : backgroundError;

  useEffect(() => {
    if (!projectId) return;

    fetchAgents(projectId)
      .then(setAgents)
      .catch(() => { setAgents([]); });

    fetch(`/api/projects/${projectId}/chat`)
      .then(r => r.json())
      .then((data: any[]) => {
        if (data.length > 0) {
          setMessages(data.map(m => ({
            id: m.id,
            role: m.role.toLowerCase() as 'user' | 'agent' | 'system',
            agent: m.agent ? {
              id: m.agent.id, name: m.agent.name, shortName: m.agent.shortName,
              avatar: m.agent.avatar, status: m.agent.status?.toLowerCase() ?? 'idle',
              group: 'core' as any, currentTask: null,
            } : undefined,
            content: stripAgentMarkers(m.content),
            thinking: m.thinking ?? undefined,
            timestamp: formatTime(m.createdAt),
          })));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [projectId]);

  // Check LLM provider health on mount
  useEffect(() => {
    checkLLMHealth()
      .then((result) => {
        setLlmConfigured(result.configured);
        setLlmError(result.error);
      })
      .catch(() => {
        setLlmConfigured(false);
        setLlmError('Failed to check LLM configuration. Please try again.');
      });
  }, []);

  // Poll for BA auto-kickoff response when only system message exists.
  // On new projects, BA generates its first message in the background (~5s).
  // The page may load before BA finishes, showing only the system message.
  // Poll every 2s until PM + BA messages appear (pipeline kickoff creates both).
  // IMPORTANT: Do NOT depend on `messages` — it changes during streaming
  // and would cause re-render storms / browser crashes.
  const [needsKickoffPoll, setNeedsKickoffPoll] = useState(false);
  const kickoffAgentCountRef = useRef(0);
  useEffect(() => {
    if (!loaded) return;
    const hasAgentMsg = messages.some(m => m.role === 'agent');
    if (!hasAgentMsg && messages.length > 0) {
      setNeedsKickoffPoll(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]); // Only check once on initial load

  useEffect(() => {
    if (!needsKickoffPoll) return;

    const interval = setInterval(() => {
      fetch(`/api/projects/${projectId}/chat`)
        .then(r => r.json())
        .then((data: any[]) => {
          if (!Array.isArray(data)) return;
          const agentMsgs = data.filter((m: any) => m.role === 'AGENT');
          if (agentMsgs.length > 0) {
            const seen = new Set<string>();
            const unique = data.filter((m: any) => {
              if (seen.has(m.id)) return false;
              seen.add(m.id);
              return true;
            });
            setMessages(unique.map((m: any) => ({
              id: m.id,
              role: m.role.toLowerCase() as 'user' | 'agent' | 'system',
              agent: m.agent ? {
                id: m.agent.id, name: m.agent.name, shortName: m.agent.shortName,
                avatar: m.agent.avatar, status: m.agent.status?.toLowerCase() ?? 'idle',
                group: 'core' as any, currentTask: null,
              } : undefined,
              content: stripAgentMarkers(m.content),
              thinking: m.thinking ?? undefined,
              timestamp: formatTime(m.createdAt),
            })));
            // Stop polling once we have 2+ agent messages (PM + BA) or count stabilized
            if (agentMsgs.length >= 2 || (agentMsgs.length === kickoffAgentCountRef.current && kickoffAgentCountRef.current > 0)) {
              setNeedsKickoffPoll(false);
              clearInterval(interval);
            }
            kickoffAgentCountRef.current = agentMsgs.length;
          }
        })
        .catch(() => {});
    }, 2000);

    const timeout = setTimeout(() => { clearInterval(interval); setNeedsKickoffPoll(false); }, 90000);
    return () => { clearInterval(interval); clearTimeout(timeout); };
  }, [needsKickoffPoll, projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/artifacts`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSidebarArtifacts(data.slice(0, 8)); // show max 8
      })
      .catch(() => {});
  }, [projectId]);

  // Empty state handled in JSX — no demo messages injected

  // Scroll to bottom on new messages and stream state changes.
  // IMPORTANT: Do NOT depend on streamContent/streamThinking — those change
  // ~30 times/sec during streaming and would trigger layout reflow each time,
  // contributing to browser tab crashes.
  useEffect(() => {
    if (scrollThrottleRef.current) return;
    scrollThrottleRef.current = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      scrollThrottleRef.current = null;
    }, 200);
  }, [messages, showStreamBubble]);

  // When the stream completes, refetch ALL messages from DB.
  // This correctly handles delegation chains (BA → SA → PE etc.)
  // where multiple agent messages are saved during a single stream.
  const lastRefetchedIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (completedMessageId && !isStreaming && projectId && completedMessageId !== lastRefetchedIdRef.current) {
      lastRefetchedIdRef.current = completedMessageId;
      fetch(`/api/projects/${projectId}/chat`)
        .then(r => r.json())
        .then((data: any[]) => {
          if (Array.isArray(data) && data.length > 0) {
            // Deduplicate by message ID
            const seen = new Set<string>();
            const unique = data.filter((m: any) => {
              if (seen.has(m.id)) return false;
              seen.add(m.id);
              return true;
            });
            setMessages(unique.map((m: any) => ({
              id: m.id,
              role: m.role.toLowerCase() as 'user' | 'agent' | 'system',
              agent: m.agent ? {
                id: m.agent.id, name: m.agent.name, shortName: m.agent.shortName,
                avatar: m.agent.avatar, status: m.agent.status?.toLowerCase() ?? 'idle',
                group: 'core' as any, currentTask: null,
              } : undefined,
              content: stripAgentMarkers(m.content),
              thinking: m.thinking ?? undefined,
              timestamp: formatTime(m.createdAt),
            })));
          }
        })
        .catch(() => {});
      setSelectedOptions([]);
    }
  }, [completedMessageId, showStreamBubble, projectId]);

  // Show "Open in VS Code" prompt when DO finishes scaffolding and hands off to TL
  useEffect(() => {
    const pp = activePipelineProgress;
    if (pp && pp.fromAgent === 'DO' && pp.toAgent === 'TL') {
      setShowVSCodePrompt(true);
    }
  }, [activePipelineProgress]);

  const activeAgents = agents.filter(a => a.status === 'working' || a.status === 'waiting');

  // Core send function — takes text directly, eliminating stale closure issues
  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) return;

    // Prevent double-sends — if a send is already in flight, bail out.
    // This guards against race conditions where two clicks/keypresses
    // fire within milliseconds of each other.
    if (isSendingRef.current) return;
    isSendingRef.current = true;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tempId = `temp-${Date.now()}`;
    const userMsg: ChatMessage = { id: tempId, role: 'user', content: trimmed, timestamp: now };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setSelectedOptions([]);
    setShowStreamThinking(true);

    // Save user message to DB
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'USER', content: trimmed }),
      });
      if (res.ok) {
        const saved = await res.json();
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: saved.id } : m));
      }
    } catch {
      // DB save failed — user message is still shown optimistically
    }

    // Release the send guard AFTER DB save completes (stream will set isStreaming)
    isSendingRef.current = false;

    // Start AI streaming via the orchestration engine
    streamSend(projectId, trimmed, selectedAgent?.shortName, cardId);
  }, [isStreaming, projectId, selectedAgent, streamSend, cardId]);

  // Keep ref updated so memoized callbacks always call the latest version
  sendRef.current = sendMessage;

  const handleSend = useCallback(() => {
    sendMessage(inputValue);
  }, [sendMessage, inputValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Memoized message list ──────────────────────────────────────────────
  // Critical performance optimization: during streaming, streamContent changes
  // ~30 times/sec causing ChatPage re-renders. Without useMemo, messages.map()
  // re-evaluates ALL messages (ReactMarkdown, framer-motion, etc.) on every token.
  // With useMemo, messages only re-render when their deps actually change.
  // IMPORTANT: slice INSIDE useMemo — slicing outside creates a new array reference
  // on every render, defeating memoization entirely.
  const renderedMessages = useMemo(() => {
    const visible = messages.slice(-visibleCount);
    return visible.map((msg, i) => (
      <motion.div
        key={msg.id}
        initial={i >= visible.length - 3 ? { opacity: 0, y: 10 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.15 }}
      >
        {msg.role === 'system' && (
          <div className="flex items-center justify-center py-2">
            <span className="text-[10px] text-muted-foreground/40 bg-white/[0.02] px-3 py-1 rounded-full">
              {msg.content}
            </span>
          </div>
        )}

        {msg.role === 'user' && (
          <div className="flex items-start gap-3 justify-end">
            <div className="max-w-[80%]">
              <div className="bg-amber/10 border border-amber/20 rounded-2xl rounded-tr-sm px-4 py-3">
                <p className="text-sm text-foreground">{msg.content}</p>
              </div>
              <span className="text-[10px] text-muted-foreground/40 mt-1 block text-right">{msg.timestamp}</span>
            </div>
            <div className="w-8 h-8 rounded-full bg-amber/20 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-amber" />
            </div>
          </div>
        )}

        {msg.role === 'agent' && (
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-[var(--surface)] border border-border flex items-center justify-center text-base">
                {msg.agent?.avatar || '🤖'}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
            </div>
            <div className="max-w-[85%] space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-foreground">{msg.agent?.name ?? 'Agent'}</span>
                <span className="text-[10px] text-muted-foreground/40">{msg.timestamp}</span>
              </div>

              {msg.thinking && (
                <button
                  onClick={() => setShowThinking(prev => prev === msg.id ? null : msg.id)}
                  className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  <Eye className="w-3 h-3" />
                  {showThinking === msg.id ? 'Hide reasoning' : 'Show reasoning'}
                </button>
              )}

              <AnimatePresence>
                {showThinking === msg.id && msg.thinking && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="bg-violet-500/[0.06] border border-violet-500/15 rounded-lg px-3 py-2 text-[11px] text-muted-foreground/70 italic">
                      <span className="text-violet-400 font-semibold not-italic text-[10px] uppercase tracking-wider">Reasoning</span>
                      <p className="mt-1">{msg.thinking}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {(() => {
                // Show option buttons on the LAST agent message only (not old ones that already got answered)
                const isLastAgentMsg = i === visible.length - 1 ||
                  visible.slice(i + 1).every(m => m.role !== 'agent');
                // Always extract to clean option lines from content display,
                // but only show clickable buttons on the last agent message
                const extracted = extractOptions(msg.content);
                const { cleanContent } = extracted;
                const options = isLastAgentMsg && !isStreaming ? extracted.options : [] as { label: string; text: string; recommended: boolean }[];
                const multiSelect = isLastAgentMsg && !isStreaming ? extracted.multiSelect : false;
                return (
                  <>
                    <div className="bg-[var(--surface)] border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                      <div className="chat-markdown text-sm text-foreground/90 leading-relaxed break-words overflow-hidden">
                        <MemoizedMarkdown content={cleanContent} />
                      </div>
                    </div>
                    {options.length > 0 && (
                      <div className="mt-2 space-y-2">
                        <div className="flex flex-wrap gap-2">
                          {options.map((opt) => {
                            const isSelected = multiSelect
                              ? selectedOptions.includes(opt.text)
                              : false; // Single-select highlight handled by input field
                            return (
                              <button
                                key={opt.label}
                                onClick={() => {
                                  if (multiSelect) {
                                    setSelectedOptions(prev =>
                                      prev.includes(opt.text)
                                        ? prev.filter(t => t !== opt.text)
                                        : [...prev, opt.text]
                                    );
                                  } else {
                                    // Single-select: send label + text so LLM knows which option was picked
                                    // Use sendRef.current to avoid stale closure on sendMessage
                                    sendRef.current(`${opt.label}) ${opt.text}`);
                                  }
                                }}
                                className={cn(
                                  "group flex items-center gap-2 px-3 py-2 rounded-xl border transition-all text-left",
                                  isSelected
                                    ? "border-amber bg-amber/10"
                                    : opt.recommended
                                      ? "border-amber/40 bg-amber/[0.04] hover:border-amber hover:bg-amber/10"
                                      : "border-border bg-[var(--surface)] hover:border-amber/40 hover:bg-amber/[0.06]"
                                )}
                              >
                                <span className={cn(
                                  "flex items-center justify-center w-5 h-5 rounded-md text-[10px] font-bold shrink-0",
                                  isSelected
                                    ? "bg-amber text-black"
                                    : opt.recommended
                                      ? "bg-amber/20 text-amber"
                                      : "bg-amber/10 text-amber group-hover:bg-amber/20"
                                )}>
                                  {isSelected ? '✓' : opt.recommended ? '★' : opt.label}
                                </span>
                                <span className="text-xs text-foreground/80 group-hover:text-foreground">{opt.text}</span>
                                {opt.recommended && (
                                  <span className="text-[9px] font-medium text-amber/70 bg-amber/10 px-1.5 py-0.5 rounded-full ml-auto">
                                    Recommended
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                        {multiSelect && selectedOptions.length > 0 && (
                          <button
                            onClick={() => {
                              const text = selectedOptions.join(', ');
                              setSelectedOptions([]);
                              sendRef.current(text);
                            }}
                            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber text-black text-xs font-medium hover:bg-amber/90 transition-colors"
                          >
                            Continue <ArrowRight className="w-3 h-3" />
                          </button>
                        )}
                        <p className="text-[10px] text-muted-foreground/40 pl-1">
                          {multiSelect ? 'Select options above, then click Continue' : 'Click an option or type your own answer below ↓'}
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}

              {msg.codeBlock && (
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-1.5 bg-white/[0.03] border-b border-border">
                    <span className="text-[10px] font-mono text-muted-foreground/60">{msg.codeBlock.language}</span>
                    <button className="text-[10px] text-muted-foreground/40 hover:text-foreground flex items-center gap-1 transition-colors">
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                  </div>
                  <pre className="px-4 py-3 text-[12px] leading-5 font-mono text-emerald-300/80 bg-black/30 overflow-x-auto">
                    {msg.codeBlock.code}
                  </pre>
                </div>
              )}

              {msg.artifacts && msg.artifacts.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {msg.artifacts.map((art, j) => (
                    <Badge key={j} variant="outline" className="text-[10px] bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition-colors">
                      {art.type === 'code' ? <Code2 className="w-2.5 h-2.5 mr-1 text-emerald-400" /> : <FileText className="w-2.5 h-2.5 mr-1 text-blue-400" />}
                      {art.name}
                    </Badge>
                  ))}
                </div>
              )}

              {msg.action && (
                <div className={cn(
                  'rounded-lg border px-3 py-2 flex items-center gap-2',
                  msg.action.status === 'approved' && 'border-emerald-500/20 bg-emerald-500/[0.04]',
                  msg.action.status === 'pending' && 'border-amber/20 bg-amber/[0.04]',
                )}>
                  {msg.action.status === 'approved' && (
                    <><CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" /><span className="text-xs text-emerald-400/80">{msg.action.label}</span></>
                  )}
                  {msg.action.status === 'pending' && (
                    <><AlertTriangle className="w-3.5 h-3.5 text-amber shrink-0" /><span className="text-xs text-muted-foreground flex-1">{msg.action.label}</span></>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>
    ));
  }, [messages, visibleCount, selectedOptions, showThinking, showStreamBubble]);

  return (
    <ChatErrorBoundary>
    <div className="flex h-full">
      <div className="flex-1 flex flex-col">
        <div className="px-6 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-4 h-4 text-amber" />
            <h1 className="text-sm font-semibold">Chat with AI Team</h1>
            <Badge variant="outline" className="text-[10px] bg-white/[0.04]">
              {activeAgents.length} agents online
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3 mr-1" /> History
            </Button>
          </div>
        </div>

        {cardId && (
          <div className="px-6 py-2 bg-amber/[0.06] border-b border-amber/20 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-amber" />
              <span className="text-[11px] text-amber font-medium">Scoped to card</span>
              <span className="text-[10px] text-muted-foreground/60">AI context focused on this task&apos;s module</span>
            </div>
            <button
              onClick={() => router.push(`/project/${projectId}/chat`)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="w-3 h-3" /> Clear scope
            </button>
          </div>
        )}

        {llmConfigured === false ? (
          <div className="flex-1 flex items-center justify-center px-6 py-4">
            <div className="max-w-md w-full rounded-2xl border border-amber/30 bg-amber/[0.06] p-8 text-center space-y-4">
              <div className="flex justify-center">
                <div className="w-12 h-12 rounded-full bg-amber/10 border border-amber/20 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-amber" />
                </div>
              </div>
              <h2 className="text-lg font-semibold text-foreground">AI Provider Not Configured</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Your AI team needs an LLM provider to work. Please contact your administrator to configure the AI provider in Admin Settings.
              </p>
              {llmError && (
                <p className="text-xs text-amber bg-amber/[0.08] border border-amber/20 rounded-lg px-3 py-2">
                  {llmError}
                </p>
              )}
            </div>
          </div>
        ) : (
        <>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.length > visibleCount && (
              <button
                onClick={() => setVisibleCount(prev => prev + 30)}
                className="w-full text-center py-2 text-[11px] text-muted-foreground/50 hover:text-muted-foreground bg-white/[0.02] rounded-lg border border-border/50 hover:border-border transition-colors"
              >
                Show earlier messages ({messages.length - visibleCount} more)
              </button>
            )}
            {renderedMessages}

            {isStreaming && !activeContent && (
              <div className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-amber" style={{ animation: 'pulse-dot 1.4s ease-in-out infinite' }} />
                <span>{activeAgent?.name || 'Agent'} is working...</span>
              </div>
            )}

            {showStreamBubble && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--surface)] border border-border flex items-center justify-center text-base">
                      {activeAgent
                        ? (agents.find(a => a.shortName === activeAgent.shortName)?.avatar || '🤖')
                        : '🤖'}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber border-2 border-background animate-pulse" />
                  </div>
                  <div className="max-w-[85%] space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-foreground">
                        {activeAgent?.name ?? 'AI Team'}
                        {!isStreaming && <span className="ml-2 text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wide">Background Task</span>}
                      </span>
                      <Loader2 className="w-3 h-3 animate-spin text-amber" />
                      <span className="text-[10px] text-muted-foreground/40">streaming...</span>
                    </div>

                    {activeThinking && (
                      <>
                        <button
                          onClick={() => setShowStreamThinking(!showStreamThinking)}
                          className="flex items-center gap-1.5 text-[10px] text-violet-400/70 hover:text-violet-400 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          {showStreamThinking ? 'Hide reasoning' : 'Show reasoning'}
                        </button>
                        <AnimatePresence>
                          {showStreamThinking && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="bg-violet-500/[0.06] border border-violet-500/15 rounded-lg px-3 py-2 text-[11px] text-muted-foreground/70 italic">
                                <span className="text-violet-400 font-semibold not-italic text-[10px] uppercase tracking-wider">Reasoning</span>
                                <p className="mt-1 whitespace-pre-wrap">{activeThinking}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}

                    {activeContent ? (
                      <div className="bg-[var(--surface)] border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="chat-markdown text-sm text-foreground/90 leading-relaxed break-words overflow-hidden">
                          <StreamingText content={activeContent} />
                          <span className="inline-block w-1.5 h-4 bg-amber/60 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[var(--surface)] border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                          <Loader2 className="w-3 h-3 animate-spin text-amber" />
                          <span>
                            {activeToolActivities.length > 0
                              ? `Working... ${activeToolActivities.filter(t => t.status === 'completed').length} actions done`
                              : 'Your AI team is working on it...'}
                          </span>
                        </div>
                        {/* Show activity log even when no text content yet */}
                        <LiveActivityLog
                          activities={activeToolActivities}
                          pipelineProgress={activePipelineProgress}
                        />
                      </div>
                    )}

                    {activeArtifacts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {activeArtifacts.map((art, j) => (
                          <Badge key={j} variant="outline" className="text-[10px] bg-white/[0.03] animate-in fade-in">
                            {art.type === 'code' ? <Code2 className="w-2.5 h-2.5 mr-1 text-emerald-400" /> : <FileText className="w-2.5 h-2.5 mr-1 text-blue-400" />}
                            {art.name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      {isStreaming && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10"
                          onClick={streamStop}
                        >
                          <Square className="w-2.5 h-2.5 mr-1 fill-current" /> Stop generating
                        </Button>
                      )}
                      {activeToolActivities.length > 0 && (
                        <span className="text-[9px] text-muted-foreground/30">
                          {activeToolActivities.filter(t => t.status === 'completed').length} actions completed
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {activeError && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-xs text-red-400/70 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3 h-3 shrink-0" /> {activeError}
              </motion.div>
            )}

            {/* VS Code handoff prompt — shown after DO scaffolds the project */}
            {showVSCodePrompt && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-auto max-w-2xl bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl p-4 my-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                    <Code2 className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-foreground mb-1">Project scaffold is ready!</h4>
                    <p className="text-xs text-muted-foreground mb-3">
                      Your project files have been generated. Open VS Code to see the code, run builds, and continue development with your AI team.
                    </p>
                    <div className="flex items-center gap-2">
                      <a
                        href={`vscode://aisensei.codanium/open?projectId=${projectId}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-colors"
                      >
                        <Code2 className="w-3 h-3" /> Open in VS Code
                      </a>
                      <button
                        onClick={() => setShowVSCodePrompt(false)}
                        className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="border-t border-border px-6 py-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-muted-foreground/50">Speaking with:</span>
              <div className="relative">
                <button
                  onClick={() => setShowAgentPicker(!showAgentPicker)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-foreground bg-white/[0.04] hover:bg-white/[0.08] px-2 py-1 rounded-md border border-border transition-colors"
                >
                  {selectedAgent ? (
                    <><span>{selectedAgent.avatar}</span><span>{selectedAgent.name}</span></>
                  ) : (
                    <><Sparkles className="w-3 h-3 text-amber" /><span>Auto (best available)</span></>
                  )}
                  <ChevronDown className="w-3 h-3 text-muted-foreground/40 ml-1" />
                </button>

                <AnimatePresence>
                  {showAgentPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.98 }}
                      className="absolute bottom-full left-0 mb-1 w-64 bg-[var(--surface-overlay)] border border-border rounded-xl shadow-2xl overflow-hidden z-50"
                    >
                      <div className="p-2">
                        <button
                          onClick={() => { setSelectedAgent(null); setShowAgentPicker(false); }}
                          className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors', !selectedAgent ? 'bg-amber/10 text-amber' : 'hover:bg-white/[0.04]')}
                        >
                          <Sparkles className="w-4 h-4" />
                          <div>
                            <p className="text-[11px] font-medium">Auto-route</p>
                            <p className="text-[9px] text-muted-foreground/50">We'll route your message to the right specialist</p>
                          </div>
                        </button>
                        <div className="h-px bg-border my-1" />
                        {activeAgents.map(agent => (
                          <button
                            key={agent.id}
                            onClick={() => { setSelectedAgent(agent); setShowAgentPicker(false); }}
                            className={cn('w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors', selectedAgent?.id === agent.id ? 'bg-amber/10' : 'hover:bg-white/[0.04]')}
                          >
                            <span className="text-base">{agent.avatar}</span>
                            <div>
                              <p className="text-[11px] font-medium">{agent.name}</p>
                              <p className="text-[9px] text-muted-foreground/50 truncate">{agent.currentTask || 'Available'}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* ── VS Code Required Gate Banner ──────────────────────────────── */}
            {vscodeRequired && (
              <div className="mx-4 mb-3 px-4 py-4 rounded-xl border-2 border-amber/50 bg-amber/[0.08] flex items-start gap-3 shadow-lg shadow-amber/5">
                <div className="mt-0.5 w-10 h-10 rounded-lg bg-amber/20 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-amber" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/>
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber mb-1">VS Code Required for Development</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-1">
                    All coding, testing, and deployment runs through VS Code. You can continue using this chat for requirements, planning, and design discussions.
                  </p>
                  <p className="text-xs text-muted-foreground/60 mb-3">
                    Open VS Code and connect the Codanium extension, then retry your request.
                  </p>
                  <a
                    href={vscodeRequired.deepLink}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber text-black text-xs font-bold hover:bg-amber/90 transition-colors shadow-sm"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M23.15 2.587L18.21.21a1.494 1.494 0 0 0-1.705.29l-9.46 8.63-4.12-3.128a.999.999 0 0 0-1.276.057L.327 7.261A1 1 0 0 0 .326 8.74L3.899 12 .326 15.26a1 1 0 0 0 .001 1.479L1.65 17.94a.999.999 0 0 0 1.276.057l4.12-3.128 9.46 8.63a1.492 1.492 0 0 0 1.704.29l4.942-2.377A1.5 1.5 0 0 0 24 20.06V3.939a1.5 1.5 0 0 0-.85-1.352zm-5.146 14.861L10.826 12l7.178-5.448v10.896z"/>
                    </svg>
                    Open VS Code to Continue
                  </a>
                </div>
              </div>
            )}

            <div className="relative">
              <div className="flex items-end gap-2 bg-[var(--surface)] border border-border rounded-2xl px-4 py-3 focus-within:border-amber/30 transition-colors">
                <button className="text-muted-foreground/30 hover:text-muted-foreground transition-colors pb-0.5">
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question, give feedback, or request changes..."
                  className="flex-1 bg-transparent text-sm resize-none outline-none text-foreground placeholder:text-muted-foreground/30 min-h-[24px] max-h-[120px]"
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                />
                <Button
                  size="sm"
                  className="h-7 px-3 bg-amber text-background hover:bg-amber/90 rounded-xl"
                  disabled={!inputValue.trim() || isStreaming}
                  onClick={handleSend}
                >
                  {isStreaming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1">
                <span className="text-[9px] text-muted-foreground/30">Press Enter to send · Shift+Enter for new line</span>
                <span className="text-[9px] text-muted-foreground/30"></span>
              </div>
            </div>
          </div>
        </div>
        </>
        )}
      </div>

      <div className="w-[280px] border-l border-border flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground">Context</h3>
        </div>

        <div className="px-4 py-3 border-b border-border">
          <h4 className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Online Team Members</h4>
          <div className="space-y-1.5">
            {activeAgents.slice(0, 6).map(agent => (
              <div key={agent.id} className="flex items-center gap-2">
                <div className="relative">
                  <span className="text-sm">{agent.avatar}</span>
                  <div className={cn('absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background', agent.status === 'working' ? 'bg-emerald-500' : 'bg-amber')} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-medium">{agent.shortName}</span>
                  <p className="text-[9px] text-muted-foreground/40 truncate">{agent.currentTask}</p>
                </div>
              </div>
            ))}
            {activeAgents.length > 6 && (
              <span className="text-[10px] text-muted-foreground/30">+{activeAgents.length - 6} more</span>
            )}
          </div>
        </div>

        <div className="px-4 py-3 border-b border-border">
          <h4 className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Referenced in Chat</h4>
          <div className="space-y-1.5">
            {[
              { id: 'FEAT-014', label: 'Refactor LLM Gateway', type: 'feature' },
              { id: 'DEC-003', label: 'Choose OAuth provider', type: 'decision' },
              { id: 'TASK-016', label: 'Decision API endpoints', type: 'task' },
            ].map(item => (
              <div key={item.id} className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-white/[0.02] rounded px-1 py-0.5 -mx-1 transition-colors">
                <Badge variant="outline" className={cn(
                  'text-[8px] h-3.5 px-1',
                  item.type === 'feature' && 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                  item.type === 'decision' && 'bg-amber/10 text-amber border-amber/20',
                  item.type === 'task' && 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                )}>
                  {item.id}
                </Badge>
                <span className="text-muted-foreground truncate">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="px-4 py-3">
          <h4 className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">
            Generated Artifacts {sidebarArtifacts.length > 0 && <span className="text-amber">({sidebarArtifacts.length})</span>}
          </h4>
          <div className="space-y-1.5">
            {sidebarArtifacts.length === 0 ? (
              <p className="text-[10px] text-muted-foreground/40 italic">No artifacts yet</p>
            ) : (
              sidebarArtifacts.map(art => {
                const isCode = art.type === 'CODE';
                const isConfig = art.type === 'CONFIG';
                const isTest = art.type === 'TEST';
                const ArtIcon = isCode ? Code2 : isTest ? TestTube : isConfig ? Settings : FileText;
                const color = isCode ? 'text-emerald-400' : isTest ? 'text-blue-400' : isConfig ? 'text-amber' : 'text-purple-400';
                return (
                  <a key={art.id} href={`/project/${projectId}/code?file=${art.id}`} className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-white/[0.02] rounded px-1 py-0.5 -mx-1 transition-colors">
                    <ArtIcon className={cn('w-3 h-3', color)} />
                    <span className="text-muted-foreground font-mono truncate">{art.name}</span>
                    <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/20 ml-auto" />
                  </a>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
    </ChatErrorBoundary>
  );
}
