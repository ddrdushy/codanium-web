'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Code2, FileText, Settings, TestTube, Copy, Download,
  Search, ChevronRight, ChevronDown, Check, File, Upload,
  Play, Square, Terminal, Loader2, CheckCircle2, XCircle, Clock,
} from 'lucide-react';
import { PushToGitHubModal } from '@/components/modals/push-to-github-modal';

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

// ---------------------------------------------------------------------------
// File tree builder
// ---------------------------------------------------------------------------

interface FileTreeNode {
  name: string;
  type: 'file' | 'dir';
  children: FileTreeNode[];
  agent?: string;
  artifactId?: string;
  artifactType?: ArtifactType;
}

function buildFileTree(artifacts: Artifact[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '/', type: 'dir', children: [] };
  for (const art of artifacts) {
    const parts = art.name.split('/');
    let current = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      let child = current.children.find((c) => c.name === name && c.type === (isFile ? 'file' : 'dir'));
      if (!child) {
        child = {
          name,
          type: isFile ? 'file' : 'dir',
          children: [],
          agent: isFile ? art.ownerAgent : undefined,
          artifactId: isFile ? art.id : undefined,
          artifactType: isFile ? art.type : undefined,
        };
        current.children.push(child);
      }
      current = child;
    }
  }
  // Sort: directories first, then alphabetical
  const sortTree = (nodes: FileTreeNode[]) => {
    nodes.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    nodes.forEach((n) => { if (n.children.length) sortTree(n.children); });
  };
  sortTree(root.children);
  return root.children;
}

// ---------------------------------------------------------------------------
// Recursive tree node component
// ---------------------------------------------------------------------------

function FileTreeNodeRow({
  node,
  depth,
  selectedId,
  onSelect,
  expandedDirs,
  onToggleDir,
}: {
  node: FileTreeNode;
  depth: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  expandedDirs: Set<string>;
  onToggleDir: (path: string) => void;
}) {
  const nodePath = node.name; // For top-level; parent will pass full path via key
  const isDir = node.type === 'dir';
  const isExpanded = expandedDirs.has(nodePath);
  const isSelected = node.artifactId === selectedId;
  const conf = node.artifactType ? typeConfig[node.artifactType] : null;

  if (isDir) {
    return (
      <div>
        <button
          onClick={() => onToggleDir(nodePath)}
          className="w-full flex items-center gap-1.5 py-1.5 hover:bg-white/[0.03] transition-colors text-left"
          style={{ paddingLeft: `${depth * 16 + 12}px`, paddingRight: '12px' }}
        >
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground/40 shrink-0" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground/40 shrink-0" />
          )}
          <span className="shrink-0">📁</span>
          <span className="text-[12px] font-mono text-muted-foreground/70 truncate">{node.name}</span>
        </button>
        <AnimatePresence initial={false}>
          {isExpanded && node.children.map((child) => (
            <motion.div
              key={`${nodePath}/${child.name}`}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
            >
              <FileTreeNodeRow
                node={child}
                depth={depth + 1}
                selectedId={selectedId}
                onSelect={onSelect}
                expandedDirs={expandedDirs}
                onToggleDir={onToggleDir}
              />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    );
  }

  // File node
  return (
    <button
      onClick={() => node.artifactId && onSelect(node.artifactId)}
      className={cn(
        'w-full flex items-center gap-1.5 py-1.5 transition-all text-left',
        isSelected
          ? 'bg-white/[0.05] border-l-2 border-l-amber'
          : 'hover:bg-[var(--sidebar-accent)] border-l-2 border-l-transparent'
      )}
      style={{ paddingLeft: `${depth * 16 + 12}px`, paddingRight: '12px' }}
    >
      <span className="w-3 shrink-0" /> {/* Spacer to align with dir chevrons */}
      <span className="shrink-0">📄</span>
      <span className={cn('text-[12px] font-mono truncate flex-1', isSelected ? 'text-foreground' : 'text-foreground/80')}>
        {node.name}
      </span>
      {node.agent && (
        <Badge variant="outline" className={cn(
          'text-[8px] h-3.5 px-1 shrink-0',
          conf ? `${conf.bg} ${conf.color}` : 'bg-white/[0.03] text-muted-foreground/40',
        )}>
          {node.agent}
        </Badge>
      )}
    </button>
  );
}

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
// Code Execution Helpers
// ---------------------------------------------------------------------------

interface CodeExecution {
  id: string;
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'CANCELLED';
  language: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  errorMessage: string | null;
}

const EXT_TO_LANGUAGE: Record<string, string> = {
  ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
  py: 'python', go: 'go', rs: 'rust', sh: 'bash', bash: 'bash',
};

function getExecutableLanguage(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return EXT_TO_LANGUAGE[ext] ?? null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CodePage() {
  const params = useParams();
  const projectId = params.id as string;

  // State
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedContent, setSelectedContent] = useState<string | null>(null);
  const [loadingContent, setLoadingContent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [filterTab, setFilterTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Set<ArtifactType>>(new Set());
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());

  // Code execution state
  const [execution, setExecution] = useState<CodeExecution | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);

  // Push modal state
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [gitConfig, setGitConfig] = useState<{
    hasToken: boolean;
    repoOwner?: string;
    repoName?: string;
    defaultBranch?: string;
  }>({ hasToken: false });

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
      .catch(() => { setArtifacts([]); });

    // Fetch git config for push modal
    fetch(`/api/projects/${projectId}/git/config`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setGitConfig({
            hasToken: data.hasToken ?? false,
            repoOwner: data.repoOwner,
            repoName: data.repoName,
            defaultBranch: data.defaultBranch,
          });
        }
      })
      .catch(() => {});
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

  // Build directory tree from filtered artifacts
  const fileTree = useMemo(() => buildFileTree(filteredArtifacts), [filteredArtifacts]);

  // Auto-expand all directories on first load
  useEffect(() => {
    if (fileTree.length > 0 && expandedDirs.size === 0) {
      const allDirs = new Set<string>();
      const collect = (nodes: FileTreeNode[]) => {
        for (const n of nodes) {
          if (n.type === 'dir') {
            allDirs.add(n.name);
            collect(n.children);
          }
        }
      };
      collect(fileTree);
      setExpandedDirs(allDirs);
    }
  }, [fileTree]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleDir = (path: string) => {
    setExpandedDirs(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
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

  // Code execution
  const executableLanguage = selected ? getExecutableLanguage(selected.name) : null;
  const canRun = !!executableLanguage && !!selectedContent && (selected?.type === 'CODE' || selected?.type === 'TEST');

  const handleRun = async () => {
    if (!selected || !selectedContent || !executableLanguage) return;
    setIsRunning(true);
    setShowTerminal(true);
    setExecution({
      id: '',
      status: 'QUEUED',
      language: executableLanguage,
      stdout: '',
      stderr: '',
      exitCode: null,
      durationMs: 0,
      errorMessage: null,
    });

    try {
      // Submit code for execution
      const res = await fetch(`/api/projects/${projectId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: executableLanguage,
          code: selectedContent,
          artifactId: selected.id,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Failed to start execution' }));
        setExecution(prev => prev ? {
          ...prev,
          status: 'FAILED',
          stderr: err.error || 'Failed to start execution',
          errorMessage: err.error,
        } : null);
        setIsRunning(false);
        return;
      }

      const data = await res.json();
      setExecution(prev => prev ? { ...prev, id: data.id, status: 'QUEUED' } : null);

      // Poll for completion
      const executionId = data.id;
      let attempts = 0;
      const maxAttempts = 60; // 60 * 1s = 60s max

      const poll = async () => {
        if (attempts >= maxAttempts) {
          setExecution(prev => prev ? {
            ...prev,
            status: 'TIMEOUT',
            stderr: 'Polling timed out — execution may still be running.',
          } : null);
          setIsRunning(false);
          return;
        }

        try {
          const statusRes = await fetch(`/api/projects/${projectId}/execute/${executionId}`);
          if (statusRes.ok) {
            const statusData = await statusRes.json();
            setExecution({
              id: statusData.id,
              status: statusData.status,
              language: statusData.language,
              stdout: statusData.stdout || '',
              stderr: statusData.stderr || '',
              exitCode: statusData.exitCode,
              durationMs: statusData.durationMs || 0,
              errorMessage: statusData.errorMessage,
            });

            if (['SUCCESS', 'FAILED', 'TIMEOUT', 'CANCELLED'].includes(statusData.status)) {
              setIsRunning(false);
              return;
            }
          }
        } catch {
          // Keep polling on network errors
        }

        attempts++;
        setTimeout(poll, 1000);
      };

      // Start polling after a brief delay
      setTimeout(poll, 500);
    } catch (err) {
      setExecution(prev => prev ? {
        ...prev,
        status: 'FAILED',
        stderr: err instanceof Error ? err.message : 'Unknown error',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      } : null);
      setIsRunning(false);
    }
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

        {/* File tree */}
        <div className="flex-1 overflow-y-auto py-1">
          {fileTree.length > 0 ? (
            fileTree.map((node) => (
              <FileTreeNodeRow
                key={node.name}
                node={node}
                depth={0}
                selectedId={selectedId}
                onSelect={setSelectedId}
                expandedDirs={expandedDirs}
                onToggleDir={toggleDir}
              />
            ))
          ) : (
            <div className="px-4 py-6 text-center">
              <p className="text-[11px] text-muted-foreground/40">No matching files</p>
            </div>
          )}
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
                  {canRun && (
                    <Button
                      size="sm"
                      onClick={handleRun}
                      disabled={isRunning}
                      className={cn(
                        'h-7 text-[11px]',
                        isRunning
                          ? 'bg-zinc-700 text-zinc-400'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white',
                      )}
                    >
                      {isRunning ? (
                        <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running...</>
                      ) : (
                        <><Play className="w-3 h-3 mr-1" /> Run</>
                      )}
                    </Button>
                  )}
                  {showTerminal && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => setShowTerminal(!showTerminal)}
                    >
                      <Terminal className="w-3 h-3 mr-1" /> Terminal
                    </Button>
                  )}
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
                  <Button
                    size="sm"
                    onClick={() => setPushModalOpen(true)}
                    className="h-7 text-[11px] bg-amber hover:bg-amber/90 text-black"
                  >
                    <Upload className="w-3 h-3 mr-1" /> Push to GitHub
                  </Button>
                </div>
              </div>

              {/* Code display + Terminal */}
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Code viewer */}
                <div className={cn(
                  'overflow-auto bg-black/30',
                  showTerminal && execution ? 'flex-1 min-h-0' : 'flex-1',
                )}>
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

                {/* Terminal Output Panel */}
                {showTerminal && execution && (
                  <div className="border-t border-border bg-[#0d1117] shrink-0" style={{ maxHeight: '40%', minHeight: '120px' }}>
                    {/* Terminal header */}
                    <div className="flex items-center justify-between px-4 py-1.5 bg-[#161b22] border-b border-border">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-3.5 h-3.5 text-muted-foreground/60" />
                        <span className="text-[11px] font-medium text-muted-foreground/70">Output</span>
                        {execution.status === 'QUEUED' && (
                          <Badge className="text-[9px] h-4 px-1.5 bg-zinc-700/50 text-zinc-400 border-zinc-600">
                            <Clock className="w-2.5 h-2.5 mr-0.5" /> Queued
                          </Badge>
                        )}
                        {execution.status === 'RUNNING' && (
                          <Badge className="text-[9px] h-4 px-1.5 bg-blue-500/10 text-blue-400 border-blue-500/20">
                            <Loader2 className="w-2.5 h-2.5 mr-0.5 animate-spin" /> Running
                          </Badge>
                        )}
                        {execution.status === 'SUCCESS' && (
                          <Badge className="text-[9px] h-4 px-1.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                            <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Exit 0
                          </Badge>
                        )}
                        {execution.status === 'FAILED' && (
                          <Badge className="text-[9px] h-4 px-1.5 bg-red-500/10 text-red-400 border-red-500/20">
                            <XCircle className="w-2.5 h-2.5 mr-0.5" /> Exit {execution.exitCode ?? '?'}
                          </Badge>
                        )}
                        {execution.status === 'TIMEOUT' && (
                          <Badge className="text-[9px] h-4 px-1.5 bg-amber/10 text-amber border-amber/20">
                            <Clock className="w-2.5 h-2.5 mr-0.5" /> Timed Out
                          </Badge>
                        )}
                        {execution.durationMs > 0 && (
                          <span className="text-[10px] text-muted-foreground/40">
                            {execution.durationMs < 1000
                              ? `${execution.durationMs}ms`
                              : `${(execution.durationMs / 1000).toFixed(1)}s`}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => setShowTerminal(false)}
                        className="text-muted-foreground/40 hover:text-foreground transition-colors"
                      >
                        <Square className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Terminal content */}
                    <div className="overflow-auto p-4" style={{ maxHeight: 'calc(40vh - 40px)' }}>
                      {(execution.status === 'QUEUED' || execution.status === 'RUNNING') && !execution.stdout && !execution.stderr && (
                        <div className="flex items-center gap-2 text-zinc-500 text-[12px] font-mono">
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          {execution.status === 'QUEUED' ? 'Waiting for sandbox...' : 'Executing...'}
                        </div>
                      )}

                      {/* stdout */}
                      {execution.stdout && (
                        <pre className="text-[12px] leading-5 font-mono text-emerald-300/90 whitespace-pre-wrap break-words">
                          {execution.stdout}
                        </pre>
                      )}

                      {/* stderr */}
                      {execution.stderr && (
                        <pre className="text-[12px] leading-5 font-mono text-red-400/90 whitespace-pre-wrap break-words mt-1">
                          {execution.stderr}
                        </pre>
                      )}

                      {/* Error message */}
                      {execution.errorMessage && !execution.stderr.includes(execution.errorMessage) && (
                        <pre className="text-[12px] leading-5 font-mono text-red-400/70 whitespace-pre-wrap break-words mt-1">
                          {execution.errorMessage}
                        </pre>
                      )}
                    </div>
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
      {/* Push to GitHub Modal */}
      <PushToGitHubModal
        open={pushModalOpen}
        onOpenChange={setPushModalOpen}
        projectId={projectId}
        artifactCount={artifacts.length}
        repoOwner={gitConfig.repoOwner}
        repoName={gitConfig.repoName}
        defaultBranch={gitConfig.defaultBranch}
        hasGitConfig={gitConfig.hasToken}
      />
    </div>
  );
}
