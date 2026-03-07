'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAgents } from '@/lib/api';
import { mockAgents } from '@/lib/mock-data';
import { useAgentStream } from '@/lib/hooks/use-agent-stream';
import { Agent } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Send, Bot, User, Sparkles, ChevronDown, Paperclip,
  Code2, FileText, CheckCircle2, AlertTriangle, Clock,
  MessageSquare, Zap, Eye, Terminal, Copy, ThumbsUp,
  RotateCcw, ArrowRight, Loader2, Square, Settings, TestTube, X
} from 'lucide-react';

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

function getDemoMessages(agents: Agent[]): ChatMessage[] {
  const sa = agents.find(a => a.shortName === 'SA') ?? agents[0];
  return [
    {
      id: 'sys-1', role: 'system',
      content: 'Session started — connected to project AI Team Studio',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
    {
      id: 'agent-1', role: 'agent', agent: sa,
      content: 'I\'ve analyzed the current LLM Gateway architecture. Here are my findings:\n\n**Current State:**\nThe gateway uses a single-provider pattern with OpenAI hardcoded. This limits flexibility and creates vendor lock-in.\n\n**Recommended Improvements:**\n1. **Abstract Provider Interface** — Create a base `LLMProvider` class with `complete()`, `stream()`, and `embed()` methods\n2. **Model Router** — Add configuration-driven routing that maps model aliases to specific providers\n3. **Fallback Chain** — Implement automatic fallback when a provider is unavailable\n4. **Token Budget Enforcement** — Add per-agent and per-session token limits',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      thinking: 'Analyzing the current gateway implementation... The single-provider pattern violates the BYOM principle. Need to design an abstraction layer that supports OpenAI, Anthropic, Ollama, and custom endpoints while maintaining a unified API surface.',
      artifacts: [
        { name: 'gateway-refactor.md', type: 'document' },
        { name: 'provider-interface.py', type: 'code' },
      ],
    },
  ];
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatPage() {
  const params = useParams();
  const projectId = params.id as string;
  const searchParams = useSearchParams();
  const router = useRouter();
  const cardId = searchParams.get('cardId') ?? undefined;

  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showThinking, setShowThinking] = useState<string | null>(null);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [showStreamThinking, setShowStreamThinking] = useState(true);
  const [sidebarArtifacts, setSidebarArtifacts] = useState<Array<{id: string; name: string; type: string; ownerAgent: string}>>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    send: streamSend,
    stop: streamStop,
    isStreaming,
    currentAgent,
    streamContent,
    streamThinking,
    artifacts: streamArtifacts,
    completedMessageId,
    usage,
    error: streamError,
  } = useAgentStream();

  useEffect(() => {
    if (!projectId) return;

    fetchAgents(projectId)
      .then(setAgents)
      .catch(() => {});

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
            content: m.content,
            thinking: m.thinking ?? undefined,
            timestamp: formatTime(m.createdAt),
          })));
        }
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [projectId]);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/artifacts`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setSidebarArtifacts(data.slice(0, 8)); // show max 8
      })
      .catch(() => {});
  }, [projectId]);

  useEffect(() => {
    if (loaded && messages.length === 0 && agents.length > 0) {
      setMessages(getDemoMessages(agents));
    }
  }, [agents, messages.length, loaded]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamContent, streamThinking]);

  // When the stream completes, add the final agent message to the messages array
  useEffect(() => {
    if (completedMessageId && !isStreaming && streamContent) {
      const respondingAgent = currentAgent
        ? agents.find(a => a.shortName === currentAgent.shortName) ?? agents[0]
        : agents[0];

      const agentMsg: ChatMessage = {
        id: completedMessageId,
        role: 'agent',
        agent: respondingAgent,
        content: streamContent,
        thinking: streamThinking || undefined,
        artifacts: streamArtifacts.length > 0 ? streamArtifacts : undefined,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, agentMsg]);
    }
  }, [completedMessageId, isStreaming]);

  const activeAgents = agents.filter(a => a.status === 'working' || a.status === 'waiting');

  const handleSend = useCallback(async () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const tempId = `temp-${Date.now()}`;
    const userMsg: ChatMessage = { id: tempId, role: 'user', content: text, timestamp: now };
    setMessages(prev => [...prev, userMsg]);
    setInputValue('');
    setShowStreamThinking(true);

    // Save user message to DB
    try {
      const res = await fetch(`/api/projects/${projectId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: 'USER', content: text }),
      });
      if (res.ok) {
        const saved = await res.json();
        setMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: saved.id } : m));
      }
    } catch {
      // DB save failed — user message is still shown optimistically
    }

    // Start AI streaming via the orchestration engine
    streamSend(projectId, text, selectedAgent?.shortName, cardId);
  }, [inputValue, isStreaming, projectId, selectedAgent, streamSend, cardId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
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

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
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
                          onClick={() => setShowThinking(showThinking === msg.id ? null : msg.id)}
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

                      <div className="bg-[var(--surface)] border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {msg.content.split('\n').map((line, j) => {
                            if (line.startsWith('**') && line.endsWith('**')) {
                              return <p key={j} className="font-semibold text-foreground mt-2 first:mt-0">{line.replace(/\*\*/g, '')}</p>;
                            }
                            if (line.match(/^\d+\.\s\*\*/)) {
                              const parts = line.match(/^(\d+\.)\s\*\*(.+?)\*\*\s*[—–-]?\s*(.*)/);
                              if (parts) {
                                return (
                                  <p key={j} className="mt-1.5 pl-2">
                                    <span className="text-amber font-mono text-[11px]">{parts[1]}</span>{' '}
                                    <span className="font-semibold text-foreground">{parts[2]}</span>
                                    {parts[3] && <span className="text-muted-foreground"> — {parts[3]}</span>}
                                  </p>
                                );
                              }
                            }
                            if (line === '') return <br key={j} />;
                            return <p key={j} className="mt-1 first:mt-0">{line}</p>;
                          })}
                        </div>
                      </div>

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
            ))}

            {isStreaming && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--surface)] border border-border flex items-center justify-center text-base">
                      {currentAgent
                        ? (agents.find(a => a.shortName === currentAgent.shortName)?.avatar || '🤖')
                        : '🤖'}
                    </div>
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber border-2 border-background animate-pulse" />
                  </div>
                  <div className="max-w-[85%] space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-foreground">
                        {currentAgent?.name ?? 'AI Team'}
                      </span>
                      <Loader2 className="w-3 h-3 animate-spin text-amber" />
                      <span className="text-[10px] text-muted-foreground/40">streaming...</span>
                    </div>

                    {streamThinking && (
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
                                <p className="mt-1 whitespace-pre-wrap">{streamThinking}</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </>
                    )}

                    {streamContent ? (
                      <div className="bg-[var(--surface)] border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                          {streamContent.split('\n').map((line, j) => {
                            if (line.startsWith('**') && line.endsWith('**')) {
                              return <p key={j} className="font-semibold text-foreground mt-2 first:mt-0">{line.replace(/\*\*/g, '')}</p>;
                            }
                            if (line.match(/^\d+\.\s\*\*/)) {
                              const parts = line.match(/^(\d+\.)\s\*\*(.+?)\*\*\s*[—–-]?\s*(.*)/);
                              if (parts) {
                                return (
                                  <p key={j} className="mt-1.5 pl-2">
                                    <span className="text-amber font-mono text-[11px]">{parts[1]}</span>{' '}
                                    <span className="font-semibold text-foreground">{parts[2]}</span>
                                    {parts[3] && <span className="text-muted-foreground"> — {parts[3]}</span>}
                                  </p>
                                );
                              }
                            }
                            if (line === '') return <br key={j} />;
                            return <p key={j} className="mt-1 first:mt-0">{line}</p>;
                          })}
                          <span className="inline-block w-1.5 h-4 bg-amber/60 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
                        </div>
                      </div>
                    ) : (
                      <div className="bg-[var(--surface)] border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground/50">
                          <Loader2 className="w-3 h-3 animate-spin" /> Your AI team is working on it...
                        </div>
                      </div>
                    )}

                    {streamArtifacts.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {streamArtifacts.map((art, j) => (
                          <Badge key={j} variant="outline" className="text-[10px] bg-white/[0.03] animate-in fade-in">
                            {art.type === 'code' ? <Code2 className="w-2.5 h-2.5 mr-1 text-emerald-400" /> : <FileText className="w-2.5 h-2.5 mr-1 text-blue-400" />}
                            {art.name}
                          </Badge>
                        ))}
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px] text-muted-foreground/50 hover:text-red-400 hover:bg-red-500/10"
                      onClick={streamStop}
                    >
                      <Square className="w-2.5 h-2.5 mr-1 fill-current" /> Stop generating
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {streamError && !isStreaming && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-xs text-red-400/70 bg-red-500/[0.06] border border-red-500/15 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3 h-3 shrink-0" /> {streamError}
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
  );
}
