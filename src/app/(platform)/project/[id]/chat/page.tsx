'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { mockAgents } from '@/lib/mock-data';
import { Agent } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Send, Bot, User, Sparkles, ChevronDown, Paperclip,
  Code2, FileText, CheckCircle2, AlertTriangle, Clock,
  MessageSquare, Zap, Eye, Terminal, Copy, ThumbsUp,
  RotateCcw, ArrowRight
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

const mockMessages: ChatMessage[] = [
  {
    id: '1',
    role: 'system',
    content: 'Session started — connected to project AI Team Studio',
    timestamp: '10:30 AM',
  },
  {
    id: '2',
    role: 'user',
    content: 'Review the current architecture for the LLM Gateway and suggest improvements for multi-provider support.',
    timestamp: '10:31 AM',
  },
  {
    id: '3',
    role: 'agent',
    agent: mockAgents.find(a => a.id === 'solution-architect'),
    content: 'I\'ve analyzed the current LLM Gateway architecture. Here are my findings:\n\n**Current State:**\nThe gateway uses a single-provider pattern with OpenAI hardcoded. This limits flexibility and creates vendor lock-in.\n\n**Recommended Improvements:**\n1. **Abstract Provider Interface** — Create a base `LLMProvider` class with `complete()`, `stream()`, and `embed()` methods\n2. **Model Router** — Add configuration-driven routing that maps model aliases to specific providers\n3. **Fallback Chain** — Implement automatic fallback when a provider is unavailable\n4. **Token Budget Enforcement** — Add per-agent and per-session token limits',
    timestamp: '10:31 AM',
    thinking: 'Analyzing the current gateway.py implementation... The single-provider pattern violates the BYOM principle. Need to design an abstraction layer that supports OpenAI, Anthropic, Ollama, and custom endpoints while maintaining a unified API surface.',
    artifacts: [
      { name: 'gateway-refactor.md', type: 'document' },
      { name: 'provider-interface.py', type: 'code' },
    ],
  },
  {
    id: '4',
    role: 'agent',
    agent: mockAgents.find(a => a.id === 'solution-architect'),
    content: 'Here\'s the proposed provider interface:',
    timestamp: '10:32 AM',
    codeBlock: {
      language: 'python',
      code: `class LLMProvider(ABC):
    """Abstract base class for LLM providers."""

    @abstractmethod
    async def complete(
        self,
        messages: list[Message],
        model: str,
        **kwargs
    ) -> CompletionResponse:
        ...

    @abstractmethod
    async def stream(
        self,
        messages: list[Message],
        model: str,
        **kwargs
    ) -> AsyncIterator[StreamChunk]:
        ...`,
    },
    action: {
      label: 'Create FEAT-014: Refactor LLM Gateway to multi-provider',
      status: 'pending',
    },
  },
  {
    id: '5',
    role: 'user',
    content: 'Looks good. Approve the feature card creation. Also, what\'s the estimated effort?',
    timestamp: '10:33 AM',
  },
  {
    id: '6',
    role: 'agent',
    agent: mockAgents.find(a => a.id === 'solution-architect'),
    content: 'Feature card FEAT-014 has been created and assigned to the Junior Developer.\n\n**Effort Estimate:**\n- Provider abstraction: ~4 hours\n- OpenAI adapter: ~2 hours\n- Anthropic adapter: ~2 hours\n- Ollama adapter: ~3 hours\n- Model router + config: ~3 hours\n- Token budget tracking: ~2 hours\n- **Total: ~16 hours (2 days)**\n\nI\'ve marked this as High priority given it blocks the BYOM requirement.',
    timestamp: '10:34 AM',
    action: {
      label: 'Created FEAT-014 — assigned to Junior Developer',
      status: 'approved',
    },
  },
];

const activeAgents = mockAgents.filter(a => a.status === 'working' || a.status === 'waiting');

export default function ChatPage() {
  const [messages] = useState<ChatMessage[]>(mockMessages);
  const [inputValue, setInputValue] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [showThinking, setShowThinking] = useState<string | null>(null);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="flex h-full">
      {/* Main Chat */}
      <div className="flex-1 flex flex-col">
        {/* Chat Header */}
        <div className="px-6 py-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MessageSquare className="w-4 h-4 text-amber" />
            <h1 className="text-sm font-semibold">Agent Chat</h1>
            <Badge variant="outline" className="text-[10px] bg-white/[0.04]">
              {activeAgents.length} agents online
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground">
              <Clock className="w-3 h-3 mr-1" />
              History
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-[11px] text-muted-foreground">
              <FileText className="w-3 h-3 mr-1" />
              Export
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((msg, i) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                {/* System message */}
                {msg.role === 'system' && (
                  <div className="flex items-center justify-center py-2">
                    <span className="text-[10px] text-muted-foreground/40 bg-white/[0.02] px-3 py-1 rounded-full">
                      {msg.content}
                    </span>
                  </div>
                )}

                {/* User message */}
                {msg.role === 'user' && (
                  <div className="flex items-start gap-3 justify-end">
                    <div className="max-w-[80%]">
                      <div className="bg-amber/10 border border-amber/20 rounded-2xl rounded-tr-sm px-4 py-3">
                        <p className="text-sm text-foreground">{msg.content}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground/40 mt-1 block text-right">
                        {msg.timestamp}
                      </span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-amber/20 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-amber" />
                    </div>
                  </div>
                )}

                {/* Agent message */}
                {msg.role === 'agent' && (
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className="w-8 h-8 rounded-full bg-[var(--surface)] border border-border flex items-center justify-center text-base">
                        {msg.agent?.avatar || '🤖'}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-background" />
                    </div>
                    <div className="max-w-[85%] space-y-2">
                      {/* Agent name */}
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-semibold text-foreground">
                          {msg.agent?.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40">
                          {msg.timestamp}
                        </span>
                      </div>

                      {/* Thinking toggle */}
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
                              <span className="text-violet-400 font-semibold not-italic text-[10px] uppercase tracking-wider">
                                Reasoning
                              </span>
                              <p className="mt-1">{msg.thinking}</p>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Message content */}
                      <div className="bg-[var(--surface)] border border-border rounded-2xl rounded-tl-sm px-4 py-3">
                        <div className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed chat-content">
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
                            if (line.startsWith('- **')) {
                              const parts = line.match(/^- \*\*(.+?)\*\*:?\s*(.*)/);
                              if (parts) {
                                return (
                                  <p key={j} className="mt-1 pl-2 flex items-baseline gap-1">
                                    <span className="text-amber text-[10px]">•</span>
                                    <span><span className="font-semibold">{parts[1]}:</span> {parts[2]}</span>
                                  </p>
                                );
                              }
                            }
                            if (line === '') return <br key={j} />;
                            return <p key={j} className="mt-1 first:mt-0">{line}</p>;
                          })}
                        </div>
                      </div>

                      {/* Code block */}
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

                      {/* Artifacts */}
                      {msg.artifacts && msg.artifacts.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {msg.artifacts.map((art, j) => (
                            <Badge
                              key={j}
                              variant="outline"
                              className="text-[10px] bg-white/[0.03] cursor-pointer hover:bg-white/[0.06] transition-colors"
                            >
                              {art.type === 'code' ? (
                                <Code2 className="w-2.5 h-2.5 mr-1 text-emerald-400" />
                              ) : (
                                <FileText className="w-2.5 h-2.5 mr-1 text-blue-400" />
                              )}
                              {art.name}
                            </Badge>
                          ))}
                        </div>
                      )}

                      {/* Action */}
                      {msg.action && (
                        <div className={cn(
                          'rounded-lg border px-3 py-2 flex items-center gap-2',
                          msg.action.status === 'pending' && 'border-amber/20 bg-amber/[0.04]',
                          msg.action.status === 'approved' && 'border-emerald-500/20 bg-emerald-500/[0.04]',
                          msg.action.status === 'rejected' && 'border-red-500/20 bg-red-500/[0.04]',
                        )}>
                          {msg.action.status === 'pending' && (
                            <>
                              <AlertTriangle className="w-3.5 h-3.5 text-amber shrink-0" />
                              <span className="text-xs text-muted-foreground flex-1">{msg.action.label}</span>
                              <Button size="sm" className="h-6 text-[10px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20">
                                <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Approve
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 text-[10px] text-red-400 hover:text-red-300">
                                Reject
                              </Button>
                            </>
                          )}
                          {msg.action.status === 'approved' && (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span className="text-xs text-emerald-400/80">{msg.action.label}</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Message actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="text-muted-foreground/30 hover:text-foreground p-1 rounded transition-colors">
                          <ThumbsUp className="w-3 h-3" />
                        </button>
                        <button className="text-muted-foreground/30 hover:text-foreground p-1 rounded transition-colors">
                          <Copy className="w-3 h-3" />
                        </button>
                        <button className="text-muted-foreground/30 hover:text-foreground p-1 rounded transition-colors">
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border px-6 py-4">
          <div className="max-w-3xl mx-auto">
            {/* Agent selector */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] text-muted-foreground/50">Talking to:</span>
              <div className="relative">
                <button
                  onClick={() => setShowAgentPicker(!showAgentPicker)}
                  className="flex items-center gap-1.5 text-[11px] font-medium text-foreground bg-white/[0.04] hover:bg-white/[0.08] px-2 py-1 rounded-md border border-border transition-colors"
                >
                  {selectedAgent ? (
                    <>
                      <span>{selectedAgent.avatar}</span>
                      <span>{selectedAgent.name}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-amber" />
                      <span>Auto-route (Orchestrator)</span>
                    </>
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
                          className={cn(
                            'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors',
                            !selectedAgent ? 'bg-amber/10 text-amber' : 'hover:bg-white/[0.04]'
                          )}
                        >
                          <Sparkles className="w-4 h-4" />
                          <div>
                            <p className="text-[11px] font-medium">Auto-route</p>
                            <p className="text-[9px] text-muted-foreground/50">Orchestrator picks the best agent</p>
                          </div>
                        </button>
                        <div className="h-px bg-border my-1" />
                        {activeAgents.map(agent => (
                          <button
                            key={agent.id}
                            onClick={() => { setSelectedAgent(agent); setShowAgentPicker(false); }}
                            className={cn(
                              'w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors',
                              selectedAgent?.id === agent.id ? 'bg-amber/10' : 'hover:bg-white/[0.04]'
                            )}
                          >
                            <span className="text-base">{agent.avatar}</span>
                            <div>
                              <p className="text-[11px] font-medium">{agent.name}</p>
                              <p className="text-[9px] text-muted-foreground/50 truncate">
                                {agent.currentTask || 'Available'}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Input box */}
            <div className="relative">
              <div className="flex items-end gap-2 bg-[var(--surface)] border border-border rounded-2xl px-4 py-3 focus-within:border-amber/30 transition-colors">
                <button className="text-muted-foreground/30 hover:text-muted-foreground transition-colors pb-0.5">
                  <Paperclip className="w-4 h-4" />
                </button>
                <textarea
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Ask an agent, request an action, or review a decision..."
                  className="flex-1 bg-transparent text-sm resize-none outline-none text-foreground placeholder:text-muted-foreground/30 min-h-[24px] max-h-[120px]"
                  rows={1}
                  onInput={(e) => {
                    const target = e.target as HTMLTextAreaElement;
                    target.style.height = 'auto';
                    target.style.height = target.scrollHeight + 'px';
                  }}
                />
                <button className="text-muted-foreground/30 hover:text-muted-foreground transition-colors pb-0.5">
                  <Terminal className="w-4 h-4" />
                </button>
                <Button
                  size="sm"
                  className="h-7 px-3 bg-amber text-background hover:bg-amber/90 rounded-xl"
                  disabled={!inputValue.trim()}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between mt-1.5 px-1">
                <span className="text-[9px] text-muted-foreground/30">
                  Press Enter to send · Shift+Enter for new line
                </span>
                <span className="text-[9px] text-muted-foreground/30">
                  Powered by BYOM Gateway
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Sidebar — Context Panel */}
      <div className="w-[280px] border-l border-border flex flex-col shrink-0">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-xs font-semibold text-muted-foreground">Context</h3>
        </div>

        {/* Active Agents */}
        <div className="px-4 py-3 border-b border-border">
          <h4 className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">
            Online Agents
          </h4>
          <div className="space-y-1.5">
            {activeAgents.slice(0, 6).map(agent => (
              <div key={agent.id} className="flex items-center gap-2">
                <div className="relative">
                  <span className="text-sm">{agent.avatar}</span>
                  <div className={cn(
                    'absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-background',
                    agent.status === 'working' ? 'bg-emerald-500' : 'bg-amber'
                  )} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-medium">{agent.shortName}</span>
                  <p className="text-[9px] text-muted-foreground/40 truncate">{agent.currentTask}</p>
                </div>
              </div>
            ))}
            {activeAgents.length > 6 && (
              <span className="text-[10px] text-muted-foreground/30">
                +{activeAgents.length - 6} more
              </span>
            )}
          </div>
        </div>

        {/* Referenced Items */}
        <div className="px-4 py-3 border-b border-border">
          <h4 className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">
            Referenced in Chat
          </h4>
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

        {/* Generated Artifacts */}
        <div className="px-4 py-3">
          <h4 className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">
            Generated Artifacts
          </h4>
          <div className="space-y-1.5">
            {[
              { name: 'gateway-refactor.md', icon: FileText, color: 'text-blue-400' },
              { name: 'provider-interface.py', icon: Code2, color: 'text-emerald-400' },
            ].map(art => {
              const ArtIcon = art.icon;
              return (
                <div key={art.name} className="flex items-center gap-2 text-[11px] cursor-pointer hover:bg-white/[0.02] rounded px-1 py-0.5 -mx-1 transition-colors">
                  <ArtIcon className={cn('w-3 h-3', art.color)} />
                  <span className="text-muted-foreground font-mono truncate">{art.name}</span>
                  <ArrowRight className="w-2.5 h-2.5 text-muted-foreground/20 ml-auto" />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
