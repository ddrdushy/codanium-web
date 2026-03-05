'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Code2, FileText, Settings, TestTube, Copy, Download,
  Search, ChevronRight, ChevronDown, Check, File,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ArtifactType = 'CODE' | 'CONFIG' | 'TEST' | 'DOCUMENT';

interface Artifact {
  id: string;
  name: string;
  type: ArtifactType;
  ownerAgent: string;
  version: number;
  createdAt: string;
  content?: string;
}

// ---------------------------------------------------------------------------
// Config maps
// ---------------------------------------------------------------------------

const typeConfig: Record<ArtifactType, {
  label: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  contentColor: string;
}> = {
  CODE: {
    label: 'Code',
    icon: Code2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    contentColor: 'text-emerald-300/80',
  },
  CONFIG: {
    label: 'Config',
    icon: Settings,
    color: 'text-amber',
    bg: 'bg-amber/10 border-amber/20',
    contentColor: 'text-amber/80',
  },
  TEST: {
    label: 'Tests',
    icon: TestTube,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    contentColor: 'text-blue-300/80',
  },
  DOCUMENT: {
    label: 'Documents',
    icon: FileText,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    contentColor: 'text-zinc-300',
  },
};

type FilterTab = 'all' | 'CODE' | 'CONFIG' | 'TEST';

const filterTabs: { key: FilterTab; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'CODE', label: 'Code' },
  { key: 'CONFIG', label: 'Config' },
  { key: 'TEST', label: 'Tests' },
];

// ---------------------------------------------------------------------------
// Mock data (graceful fallback before API loads)
// ---------------------------------------------------------------------------

const mockContent: Record<string, string> = {
  'art-001': `import { Request, Response, NextFunction } from 'express';
import { LLMGateway } from '../ai/gateway';
import { ContextBuilder } from '../ai/context';
import { AgentRegistry } from '../ai/agents';
import { EventBus } from '../events/bus';

export class OrchestrationService {
  private gateway: LLMGateway;
  private context: ContextBuilder;
  private agents: AgentRegistry;
  private events: EventBus;

  constructor(
    gateway: LLMGateway,
    context: ContextBuilder,
    agents: AgentRegistry,
    events: EventBus,
  ) {
    this.gateway = gateway;
    this.context = context;
    this.agents = agents;
    this.events = events;
  }

  async handleRequest(req: Request, res: Response, next: NextFunction) {
    try {
      const { projectId, message, agentHint } = req.body;

      // 1. Build context from project state
      const ctx = await this.context.build(projectId);

      // 2. Route to the best agent
      const agent = agentHint
        ? this.agents.get(agentHint)
        : await this.agents.route(message, ctx);

      // 3. Execute via LLM gateway
      const result = await this.gateway.complete({
        model: agent.preferredModel,
        systemPrompt: agent.systemPrompt(ctx),
        messages: [{ role: 'user', content: message }],
        temperature: agent.temperature,
      });

      // 4. Emit event
      this.events.emit('agent:response', {
        projectId,
        agentId: agent.id,
        tokenUsage: result.usage,
      });

      return res.json({
        content: result.content,
        agent: agent.shortName,
        artifacts: result.artifacts ?? [],
      });
    } catch (err) {
      next(err);
    }
  }
}`,
  'art-002': `FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
RUN npm ci --production=false

# Build stage
FROM base AS build
COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app

ENV NODE_ENV=production
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/src/generated ./src/generated

EXPOSE 3000
CMD ["npm", "start"]`,
  'art-003': `import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrchestrationService } from '../services/service';
import { mockGateway, mockContext, mockAgents, mockEvents } from './__mocks__';

describe('OrchestrationService', () => {
  let service: OrchestrationService;

  beforeEach(() => {
    service = new OrchestrationService(
      mockGateway,
      mockContext,
      mockAgents,
      mockEvents,
    );
    vi.clearAllMocks();
  });

  it('should route to the correct agent based on message intent', async () => {
    const req = { body: { projectId: 'proj-1', message: 'Create the login page' } };
    const res = { json: vi.fn() };
    const next = vi.fn();

    await service.handleRequest(req as any, res as any, next);

    expect(mockAgents.route).toHaveBeenCalledWith(
      'Create the login page',
      expect.any(Object),
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ agent: 'JD' }),
    );
  });

  it('should use agent hint when provided', async () => {
    const req = { body: { projectId: 'proj-1', message: 'Review this', agentHint: 'SA' } };
    const res = { json: vi.fn() };
    const next = vi.fn();

    await service.handleRequest(req as any, res as any, next);

    expect(mockAgents.get).toHaveBeenCalledWith('SA');
    expect(mockAgents.route).not.toHaveBeenCalled();
  });

  it('should emit an event after successful response', async () => {
    const req = { body: { projectId: 'proj-1', message: 'Hello' } };
    const res = { json: vi.fn() };
    const next = vi.fn();

    await service.handleRequest(req as any, res as any, next);

    expect(mockEvents.emit).toHaveBeenCalledWith(
      'agent:response',
      expect.objectContaining({ projectId: 'proj-1' }),
    );
  });

  it('should call next with error on failure', async () => {
    mockGateway.complete.mockRejectedValueOnce(new Error('LLM timeout'));

    const req = { body: { projectId: 'proj-1', message: 'Hello' } };
    const res = { json: vi.fn() };
    const next = vi.fn();

    await service.handleRequest(req as any, res as any, next);

    expect(next).toHaveBeenCalledWith(expect.any(Error));
    expect(res.json).not.toHaveBeenCalled();
  });
});`,
};

const mockArtifacts: Artifact[] = [
  {
    id: 'art-001',
    name: 'service.ts',
    type: 'CODE',
    ownerAgent: 'SD',
    version: 1,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'art-002',
    name: 'Dockerfile',
    type: 'CONFIG',
    ownerAgent: 'DO',
    version: 2,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'art-003',
    name: 'auth.test.ts',
    type: 'TEST',
    ownerAgent: 'QA',
    version: 1,
    createdAt: new Date().toISOString(),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(diff / 3600000);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(diff / 86400000);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CodePage() {
  const params = useParams();
  const projectId = params.id as string;

  // State
  const [artifacts, setArtifacts] = useState<Artifact[]>(mockArtifacts);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<ArtifactType>>(new Set());

  // Fetch artifacts list
  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/artifacts`)
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped: Artifact[] = data.map((d: any) => ({
            id: d.id,
            name: d.name,
            type: d.type ?? 'CODE',
            ownerAgent: d.ownerAgent ?? '??',
            version: d.version ?? 1,
            createdAt: d.createdAt ?? new Date().toISOString(),
          }));
          setArtifacts(mapped);
        }
      })
      .catch(() => {/* keep mock data */});
  }, [projectId]);

  // Fetch individual artifact content on selection
  useEffect(() => {
    if (!selectedId || !projectId) {
      setSelectedContent(null);
      return;
    }

    // Check mock content first (fallback)
    const fallback = mockContent[selectedId] ?? null;
    setSelectedContent(fallback);
    setLoadingContent(true);

    fetch(`/api/projects/${projectId}/artifacts/${selectedId}`)
      .then(r => r.json())
      .then((data: any) => {
        if (data?.content) {
          setSelectedContent(data.content);
        }
      })
      .catch(() => {/* keep mock/null */})
      .finally(() => setLoadingContent(false));
  }, [selectedId, projectId]);

  // Derived data
  const selected = artifacts.find(a => a.id === selectedId) ?? null;

  const filteredArtifacts = useMemo(() => {
    let list = artifacts;
    if (filterTab !== 'all') {
      list = list.filter(a => a.type === filterTab);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(a => a.name.toLowerCase().includes(q));
    }
    return list;
  }, [artifacts, filterTab, searchQuery]);

  // Group artifacts by type for the tree view
  const groupedArtifacts = useMemo(() => {
    const groups: Record<ArtifactType, Artifact[]> = {
      CODE: [],
      CONFIG: [],
      TEST: [],
      DOCUMENT: [],
    };
    for (const art of filteredArtifacts) {
      (groups[art.type] ?? groups.CODE).push(art);
    }
    return groups;
  }, [filteredArtifacts]);

  const toggleGroup = (type: ArtifactType) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  // Actions
  const handleCopy = async () => {
    if (!selectedContent) return;
    try {
      await navigator.clipboard.writeText(selectedContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API may fail in some contexts
    }
  };

  const handleDownload = () => {
    if (!selected || !selectedContent) return;
    const blob = new Blob([selectedContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selected.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Render line numbers + content
  const lines = selectedContent?.split('\n') ?? [];

  // ---------------------------------------------------------------------------
  // Empty state — no artifacts at all
  // ---------------------------------------------------------------------------
  if (artifacts.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-border flex items-center justify-center mx-auto mb-4">
            <Code2 className="w-8 h-8 text-muted-foreground/30" />
          </div>
          <h2 className="text-lg font-bold tracking-tight mb-2">No files generated yet</h2>
          <p className="text-sm text-muted-foreground/50 leading-relaxed">
            Start a conversation with your AI team to generate code, configurations, and test files.
          </p>
        </motion.div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Main layout
  // ---------------------------------------------------------------------------
  return (
    <div className="flex h-full">
      {/* ----------------------------------------------------------------- */}
      {/* Left Panel — File Tree                                            */}
      {/* ----------------------------------------------------------------- */}
      <div className="w-[280px] border-r border-border flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Code2 className="w-5 h-5 text-amber" />
              Generated Files
            </h1>
            <Badge variant="outline" className="text-[10px] bg-white/[0.04]">
              {artifacts.length}
            </Badge>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mb-3">
            {filterTabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterTab(tab.key)}
                className={cn(
                  'px-2 py-1 rounded-md text-[10px] font-medium transition-all',
                  filterTab === tab.key
                    ? 'bg-amber/10 text-amber border border-amber/20'
                    : 'text-muted-foreground/50 hover:text-foreground hover:bg-white/[0.03]'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/40" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Filter files..."
              className="w-full pl-8 pr-3 py-1.5 text-xs font-mono bg-[var(--sidebar-accent)] border border-border rounded-lg outline-none focus:border-amber/30 transition-colors text-foreground placeholder:text-muted-foreground/40"
            />
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {(Object.entries(groupedArtifacts) as [ArtifactType, Artifact[]][])
            .filter(([, items]) => items.length > 0)
            .map(([type, items]) => {
              const conf = typeConfig[type];
              const GroupIcon = conf.icon;
              const isCollapsed = collapsedGroups.has(type);

              return (
                <div key={type}>
                  {/* Group header */}
                  <button
                    onClick={() => toggleGroup(type)}
                    className="w-full flex items-center gap-2 px-4 py-2 text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider hover:bg-white/[0.02] transition-colors"
                  >
                    {isCollapsed ? (
                      <ChevronRight className="w-3 h-3" />
                    ) : (
                      <ChevronDown className="w-3 h-3" />
                    )}
                    <GroupIcon className={cn('w-3.5 h-3.5', conf.color)} />
                    {conf.label}
                    <Badge variant="outline" className="text-[8px] h-3.5 px-1 ml-auto bg-white/[0.03]">
                      {items.length}
                    </Badge>
                  </button>

                  {/* File items */}
                  <AnimatePresence initial={false}>
                    {!isCollapsed && items.map((art, i) => {
                      const TypeIcon = typeConfig[art.type].icon;
                      const isSelected = selectedId === art.id;

                      return (
                        <motion.button
                          key={art.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ delay: i * 0.02 }}
                          onClick={() => setSelectedId(art.id)}
                          className={cn(
                            'w-full text-left px-4 py-2 flex items-center gap-2 transition-all',
                            isSelected
                              ? 'bg-white/[0.05] border-l-2 border-l-amber'
                              : 'hover:bg-[var(--sidebar-accent)] border-l-2 border-l-transparent'
                          )}
                        >
                          <TypeIcon className={cn('w-3.5 h-3.5 shrink-0', typeConfig[art.type].color)} />
                          <span className="text-[12px] font-mono text-foreground truncate flex-1">
                            {art.name}
                          </span>
                          <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-white/[0.03] text-muted-foreground/40 shrink-0">
                            {art.ownerAgent}
                          </Badge>
                        </motion.button>
                      );
                    })}
                  </AnimatePresence>
                </div>
              );
            })}
        </div>

        {/* Footer stats */}
        <div className="px-4 py-3 border-t border-border text-[10px] text-muted-foreground/40">
          {artifacts.length} files
          {' '}&middot;{' '}
          {artifacts.filter(a => a.type === 'CODE').length} code
          {' '}&middot;{' '}
          {artifacts.filter(a => a.type === 'TEST').length} tests
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* Right Panel — Code Viewer                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {selected ? (
            <motion.div
              key={selected.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="flex flex-col h-full"
            >
              {/* Toolbar */}
              <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md border-b border-border px-6 py-2 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <File className={cn('w-4 h-4', typeConfig[selected.type].color)} />
                  <span className="text-sm font-mono font-semibold text-foreground">
                    {selected.name}
                  </span>
                  <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5', typeConfig[selected.type].bg, typeConfig[selected.type].color)}>
                    {typeConfig[selected.type].label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/40">
                    by {selected.ownerAgent}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40">
                    &middot; {formatRelative(selected.createdAt)}
                  </span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1.5 bg-white/[0.03] text-muted-foreground/50">
                    v{selected.version}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <><Check className="w-3 h-3 mr-1 text-emerald-400" /> Copied</>
                    ) : (
                      <><Copy className="w-3 h-3 mr-1" /> Copy</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={handleDownload}
                  >
                    <Download className="w-3 h-3 mr-1" /> Download
                  </Button>
                </div>
              </div>

              {/* Code display */}
              <div className="flex-1 overflow-auto bg-black/30">
                {loadingContent && !selectedContent ? (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-xs text-muted-foreground/40">Loading...</span>
                  </div>
                ) : selectedContent ? (
                  <div className="flex min-h-full">
                    {/* Line numbers gutter */}
                    <div className="shrink-0 select-none py-4 pr-2 text-right border-r border-white/[0.04]">
                      {lines.map((_, i) => (
                        <div
                          key={i}
                          className="px-3 text-[12px] leading-5 font-mono text-zinc-600"
                        >
                          {i + 1}
                        </div>
                      ))}
                    </div>

                    {/* Code content */}
                    <pre className={cn(
                      'flex-1 py-4 px-4 text-[12px] leading-5 font-mono overflow-x-auto',
                      typeConfig[selected.type].contentColor,
                    )}>
                      {lines.map((line, i) => (
                        <div key={i} className="whitespace-pre">
                          {line || '\u00A0'}
                        </div>
                      ))}
                    </pre>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <span className="text-xs text-muted-foreground/40">No content available</span>
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            /* Empty state — no file selected */
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center h-full"
            >
              <div className="text-center">
                <div className="w-12 h-12 rounded-xl bg-white/[0.03] border border-border flex items-center justify-center mx-auto mb-3">
                  <File className="w-6 h-6 text-muted-foreground/20" />
                </div>
                <p className="text-sm text-muted-foreground/40">
                  Select a file to view its contents
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
