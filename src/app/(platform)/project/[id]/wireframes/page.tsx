'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WireframeModal, DeleteWireframeDialog } from '@/components/modals/wireframe-modal';
import { PenRenderer, type PenDocument } from '@/components/pen-renderer/PenRenderer';
import { penToHTML, penToReactComponent } from '@/lib/pen-to-html';
import { DesignSystemRenderer, WireframeVisualRenderer } from '@/components/wireframes/visual-ui-renderer';
import {
  PenTool, Plus, Grid3X3, Layers, Eye, Edit3,
  Smartphone, Monitor, Tablet, ChevronRight,
  Square, Type, Image, MousePointer, Layout,
  ArrowRight, CheckCircle2, Clock, Bot, Maximize2,
  Trash2, Send, Palette, Code, FileCode, Copy, Check, X,
} from 'lucide-react';

interface Wireframe {
  id: string;
  title: string;
  screen: string;
  status: 'draft' | 'review' | 'approved';
  device: 'desktop' | 'mobile' | 'tablet';
  owner: string;
  ownerAvatar: string;
  lastUpdated: string;
  components: number;
  version: number;
  penData?: PenDocument | null;
  content?: string | null;       // Markdown content for document-based wireframes
  isDocument?: boolean;           // True if this came from the documents table
}

// Sample .pen document for demo rendering
const samplePenDoc: PenDocument = {
  name: 'Login Screen',
  width: 375,
  height: 667,
  variables: { 'app.name': 'Codanium' },
  components: {
    'btn-primary': {
      id: 'btn-primary', type: 'frame', layout: 'horizontal', justifyContent: 'center', alignItems: 'center',
      width: 'fill_container', height: 48, fill: '#f59e0b', cornerRadius: 12, padding: [12, 16],
      children: [{ type: 'text', content: 'Button', fontSize: 16, fontWeight: 600, fill: '#000000' }],
    },
  },
  children: [
    {
      type: 'frame', layout: 'vertical', width: 'fill_container', height: 'fill_container',
      fill: '#0a0a0a', padding: [60, 24, 24, 24], gap: 24, alignItems: 'center',
      children: [
        { type: 'ellipse', width: 64, height: 64, fill: '#f59e0b', opacity: 0.2 },
        { type: 'text', content: '$app.name', fontSize: 24, fontWeight: 700, fill: '#ffffff', textAlign: 'center' },
        { type: 'text', content: 'Sign in to continue', fontSize: 14, fill: '#a1a1aa', textAlign: 'center' },
        {
          type: 'frame', layout: 'vertical', width: 'fill_container', gap: 12, padding: [20, 0, 0, 0],
          children: [
            {
              type: 'frame', layout: 'vertical', width: 'fill_container', gap: 6,
              children: [
                { type: 'text', content: 'Email', fontSize: 13, fontWeight: 500, fill: '#d4d4d8' },
                {
                  type: 'rectangle', width: 'fill_container', height: 44, fill: '#18181b',
                  cornerRadius: 8, stroke: { color: '#27272a', width: 1 }, padding: [0, 12],
                },
              ],
            },
            {
              type: 'frame', layout: 'vertical', width: 'fill_container', gap: 6,
              children: [
                { type: 'text', content: 'Password', fontSize: 13, fontWeight: 500, fill: '#d4d4d8' },
                {
                  type: 'rectangle', width: 'fill_container', height: 44, fill: '#18181b',
                  cornerRadius: 8, stroke: { color: '#27272a', width: 1 }, padding: [0, 12],
                },
              ],
            },
            {
              type: 'ref', refId: 'btn-primary',
              overrides: { children: [{ type: 'text', content: 'Sign In', fontSize: 16, fontWeight: 600, fill: '#000000' }] },
            },
          ],
        },
        { type: 'text', content: 'Forgot password?', fontSize: 13, fill: '#f59e0b', textAlign: 'center' },
      ],
    },
  ],
};

const mockWireframes: Wireframe[] = [
  { id: 'wf-001', title: 'Dashboard Overview', screen: 'dashboard', status: 'approved', device: 'desktop', owner: 'UI/UX Designer', ownerAvatar: '🎨', lastUpdated: '3d ago', components: 14, version: 3 },
  { id: 'wf-002', title: 'Kanban Board', screen: 'board', status: 'approved', device: 'desktop', owner: 'UI/UX Designer', ownerAvatar: '🎨', lastUpdated: '2d ago', components: 22, version: 5 },
  { id: 'wf-003', title: 'Agent Chat Interface', screen: 'chat', status: 'review', device: 'desktop', owner: 'UI/UX Designer', ownerAvatar: '🎨', lastUpdated: '6h ago', components: 18, version: 2 },
  { id: 'wf-004', title: 'Decision Panel', screen: 'decisions', status: 'approved', device: 'desktop', owner: 'UI/UX Designer', ownerAvatar: '🎨', lastUpdated: '4d ago', components: 16, version: 4 },
  { id: 'wf-005', title: 'Mobile Login (.pen)', screen: 'login', status: 'draft', device: 'mobile', owner: 'UI/UX Designer', ownerAvatar: '🎨', lastUpdated: '1h ago', components: 8, version: 1, penData: samplePenDoc },
  { id: 'wf-006', title: 'Settings & Preferences', screen: 'settings', status: 'draft', device: 'desktop', owner: 'UI/UX Designer', ownerAvatar: '🎨', lastUpdated: '2h ago', components: 12, version: 1 },
];

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
  draft: { label: 'Draft', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
  review: { label: 'In Review', color: 'text-amber', bg: 'bg-amber/10 border-amber/20' },
  approved: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
};

const deviceIcon: Record<string, React.ElementType> = {
  desktop: Monitor,
  mobile: Smartphone,
  tablet: Tablet,
};

// (DocumentMarkdownRenderer removed — now using DesignSystemRenderer / WireframeVisualRenderer)

// ASCII-art style wireframe preview components
function WireframePreview({ screen }: { screen: string }) {
  if (screen === 'dashboard') {
    return (
      <div className="p-4 space-y-3">
        {/* Header bar */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-amber/20 border border-amber/30" />
          <div className="h-3 w-32 rounded bg-foreground/10" />
          <div className="ml-auto flex gap-1.5">
            <div className="w-8 h-3 rounded bg-foreground/8" />
            <div className="w-8 h-3 rounded bg-foreground/8" />
          </div>
        </div>
        {/* Progress bar */}
        <div className="flex gap-1 h-2">
          {[1,2,3,4].map(i => <div key={i} className="flex-1 rounded-full bg-emerald-500/30" />)}
          {[5,6,7].map(i => <div key={i} className="flex-1 rounded-full bg-amber/30" />)}
          {[8,9,10].map(i => <div key={i} className="flex-1 rounded-full bg-foreground/5" />)}
        </div>
        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-2">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-lg border border-border p-2">
              <div className="h-2 w-10 rounded bg-foreground/8 mb-1.5" />
              <div className="h-4 w-6 rounded bg-foreground/15" />
              <div className="h-1.5 w-12 rounded bg-foreground/5 mt-1" />
            </div>
          ))}
        </div>
        {/* Two columns */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-border p-2 space-y-1.5">
            <div className="h-2 w-16 rounded bg-foreground/10" />
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-foreground/8" />
                <div className="h-2 flex-1 rounded bg-foreground/6" />
              </div>
            ))}
          </div>
          <div className="rounded-lg border border-border p-2 space-y-1.5">
            <div className="h-2 w-16 rounded bg-foreground/10" />
            {[1,2,3].map(i => (
              <div key={i} className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber/40" />
                <div className="h-2 flex-1 rounded bg-foreground/6" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (screen === 'board') {
    return (
      <div className="p-4 space-y-3">
        {/* Filters */}
        <div className="flex gap-1.5">
          {['All', 'Epics', 'Features', 'Tasks'].map(f => (
            <div key={f} className={cn('h-4 px-2 rounded text-[7px] flex items-center', f === 'All' ? 'bg-amber/20 text-amber' : 'bg-foreground/5 text-foreground/30')}>
              {f}
            </div>
          ))}
        </div>
        {/* Columns */}
        <div className="flex gap-1.5">
          {['Plan', 'WIP', 'Rev', 'Test', 'Block', 'Done', 'Ship'].map((col, ci) => (
            <div key={col} className="flex-1 space-y-1">
              <div className="text-[6px] text-muted-foreground/40 text-center font-medium">{col}</div>
              <div className="rounded border border-border p-1 space-y-1 min-h-[80px] bg-foreground/[0.01]">
                {Array.from({ length: ci === 1 ? 3 : ci === 5 ? 2 : ci === 4 ? 1 : ci < 4 ? 2 : 1 }).map((_, j) => (
                  <div key={j} className={cn(
                    'rounded p-1 border',
                    ci === 4 ? 'border-red-500/20 bg-red-500/5' : 'border-border bg-foreground/[0.02]'
                  )}>
                    <div className="h-1.5 w-full rounded bg-foreground/8" />
                    <div className="h-1 w-2/3 rounded bg-foreground/5 mt-0.5" />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (screen === 'chat') {
    return (
      <div className="p-4 flex gap-2 h-full">
        {/* Chat area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 space-y-2">
            <div className="flex justify-end">
              <div className="w-3/5 h-6 rounded-lg bg-amber/10 border border-amber/20" />
            </div>
            <div className="flex gap-1.5 items-start">
              <div className="w-4 h-4 rounded-full bg-foreground/10 shrink-0" />
              <div className="space-y-1">
                <div className="w-4/5 h-8 rounded-lg bg-foreground/[0.03] border border-border" />
                <div className="w-3/5 h-12 rounded-lg bg-foreground/[0.03] border border-border font-mono" />
              </div>
            </div>
            <div className="flex justify-end">
              <div className="w-2/5 h-5 rounded-lg bg-amber/10 border border-amber/20" />
            </div>
          </div>
          {/* Input */}
          <div className="h-8 rounded-xl border border-border bg-foreground/[0.02] flex items-center px-2 gap-1 mt-2">
            <div className="w-3 h-3 rounded bg-foreground/8" />
            <div className="flex-1 h-2 rounded bg-foreground/5" />
            <div className="w-5 h-5 rounded-lg bg-amber/20" />
          </div>
        </div>
        {/* Context panel */}
        <div className="w-1/4 border-l border-border pl-2 space-y-2">
          <div className="h-2 w-12 rounded bg-foreground/10" />
          {[1,2,3,4].map(i => (
            <div key={i} className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-foreground/8" />
              <div className="h-1.5 flex-1 rounded bg-foreground/5" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Default wireframe
  return (
    <div className="p-4 flex items-center justify-center h-full">
      <div className="text-center space-y-2">
        <Grid3X3 className="w-8 h-8 text-muted-foreground/20 mx-auto" />
        <p className="text-[10px] text-muted-foreground/30">Wireframe preview</p>
      </div>
    </div>
  );
}

const dbWfStatus: Record<string, Wireframe['status']> = {
  DRAFT: 'draft', REVIEW: 'review', APPROVED: 'approved',
  draft: 'draft', review: 'review', approved: 'approved',
};
const dbDevice: Record<string, Wireframe['device']> = {
  DESKTOP: 'desktop', MOBILE: 'mobile', TABLET: 'tablet',
  desktop: 'desktop', mobile: 'mobile', tablet: 'tablet',
};

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function mapApiWireframe(w: any): Wireframe {
  return {
    id: w.id,
    title: w.title,
    screen: w.screen ?? '',
    status: dbWfStatus[w.status] ?? 'draft',
    device: dbDevice[w.device] ?? 'desktop',
    owner: w.owner ?? 'Unknown',
    ownerAvatar: w.ownerAvatar ?? '🎨',
    lastUpdated: w.updatedAt ?? w.lastUpdated ? formatRelative(w.updatedAt ?? w.lastUpdated) : 'just now',
    components: w.components ?? 0,
    version: w.version ?? 1,
    penData: w.penData ?? null,
    content: w.content ?? null,
    isDocument: w.isDocument ?? false,
  };
}

// ---------------------------------------------------------------------------
// Design Tokens Extractor & Sidebar
// ---------------------------------------------------------------------------

interface DesignTokens {
  colors: { value: string; usages: number }[];
  fonts: { family: string; sizes: number[] }[];
  variables: Record<string, string>;
}

function extractDesignTokens(doc: PenDocument): DesignTokens {
  const colorMap = new Map<string, number>();
  const fontMap = new Map<string, Set<number>>();

  const walk = (nodes?: PenDocument['children']) => {
    if (!nodes) return;
    for (const node of nodes) {
      // Colors
      if (typeof node.fill === 'string' && node.fill.startsWith('#')) {
        colorMap.set(node.fill, (colorMap.get(node.fill) ?? 0) + 1);
      }
      if (node.stroke && typeof node.stroke === 'object' && 'color' in node.stroke) {
        const strokeColor = (node.stroke as { color: string }).color;
        if (strokeColor.startsWith('#')) {
          colorMap.set(strokeColor, (colorMap.get(strokeColor) ?? 0) + 1);
        }
      }
      // Fonts
      if (node.fontSize) {
        const family = node.fontFamily ?? 'System';
        if (!fontMap.has(family)) fontMap.set(family, new Set());
        fontMap.get(family)!.add(node.fontSize);
      }
      // Recurse
      if (node.children) walk(node.children as PenDocument['children']);
    }
  };

  walk(doc.children);
  // Also walk components
  if (doc.components) {
    for (const comp of Object.values(doc.components)) {
      walk([comp] as PenDocument['children']);
      if ((comp as any).children) walk((comp as any).children);
    }
  }

  const colors = Array.from(colorMap.entries())
    .map(([value, usages]) => ({ value, usages }))
    .sort((a, b) => b.usages - a.usages);

  const fonts = Array.from(fontMap.entries())
    .map(([family, sizes]) => ({ family, sizes: Array.from(sizes).sort((a, b) => a - b) }))
    .sort((a, b) => a.family.localeCompare(b.family));

  return { colors, fonts, variables: doc.variables ?? {} };
}

function DesignTokensSidebar({ tokens }: { tokens: DesignTokens }) {
  return (
    <div className="w-[220px] border-l border-border flex flex-col shrink-0 overflow-y-auto bg-background">
      <div className="px-3 py-3 border-b border-border">
        <h3 className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-wider flex items-center gap-1.5">
          <Palette className="w-3 h-3" />
          Design Tokens
        </h3>
      </div>

      {/* Colors */}
      <div className="px-3 py-3 border-b border-border">
        <h4 className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2">Colors</h4>
        <div className="space-y-1.5">
          {tokens.colors.length > 0 ? tokens.colors.map((c) => (
            <div key={c.value} className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded border border-border shrink-0"
                style={{ backgroundColor: c.value }}
              />
              <span className="text-[11px] font-mono text-foreground/70 flex-1">{c.value}</span>
              <span className="text-[9px] text-muted-foreground/40">{c.usages}x</span>
            </div>
          )) : (
            <p className="text-[10px] text-muted-foreground/30">No colors found</p>
          )}
        </div>
      </div>

      {/* Fonts */}
      <div className="px-3 py-3 border-b border-border">
        <h4 className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <Type className="w-3 h-3" />
          Typography
        </h4>
        <div className="space-y-2">
          {tokens.fonts.length > 0 ? tokens.fonts.map((f) => (
            <div key={f.family}>
              <p className="text-[11px] font-medium text-foreground/70">{f.family}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {f.sizes.map((s) => (
                  <span key={s} className="text-[9px] px-1.5 py-0.5 rounded bg-white/[0.04] border border-border text-muted-foreground/50 font-mono">
                    {s}px
                  </span>
                ))}
              </div>
            </div>
          )) : (
            <p className="text-[10px] text-muted-foreground/30">No fonts found</p>
          )}
        </div>
      </div>

      {/* Variables */}
      {Object.keys(tokens.variables).length > 0 && (
        <div className="px-3 py-3">
          <h4 className="text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider mb-2">Variables</h4>
          <div className="space-y-1.5">
            {Object.entries(tokens.variables).map(([key, val]) => (
              <div key={key} className="flex flex-col">
                <span className="text-[10px] font-mono text-amber/70">${key}</span>
                <span className="text-[11px] text-foreground/60 pl-2">{val}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WireframesPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [wireframes, setWireframes] = useState<Wireframe[]>([]);
  const [selectedWireframe, setSelectedWireframe] = useState<Wireframe | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showCodePreview, setShowCodePreview] = useState(false);
  const [codePreviewContent, setCodePreviewContent] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/wireframes`)
      .then(r => r.json())
      .then((data: any[]) => {
        if (Array.isArray(data) && data.length > 0) {
          const mapped = data.map(mapApiWireframe);
          setWireframes(mapped);
          setSelectedWireframe(mapped[0]);
        }
      })
      .catch(() => {
        setWireframes(mockWireframes);
        setSelectedWireframe(mockWireframes[0]);
      });
  }, [projectId]);

  // ── Handlers ──────────────────────────────────────────────────────────

  const handleCreateSuccess = (apiWf: any) => {
    const wf = mapApiWireframe(apiWf);
    setWireframes((prev) => [wf, ...prev]);
    setSelectedWireframe(wf);
  };

  const handleEditSuccess = (apiWf: any) => {
    const wf = mapApiWireframe(apiWf);
    setWireframes((prev) => prev.map((w) => (w.id === wf.id ? wf : w)));
    setSelectedWireframe(wf);
  };

  const handleDeleteSuccess = () => {
    const remaining = wireframes.filter((w) => w.id !== selectedWireframe?.id);
    setWireframes(remaining);
    setSelectedWireframe(remaining[0] ?? null);
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!selectedWireframe) return;
    try {
      const res = await fetch(`/api/projects/${projectId}/wireframes`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wireframeId: selectedWireframe.id, status: newStatus }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      const wf = mapApiWireframe(updated);
      setWireframes((prev) => prev.map((w) => (w.id === wf.id ? wf : w)));
      setSelectedWireframe(wf);
    } catch {
      // silent
    }
  };

  const handleExportHTML = () => {
    if (!selectedWireframe?.penData) return;
    const html = penToHTML(selectedWireframe.penData);
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
    }
  };

  const handleExportReact = () => {
    if (!selectedWireframe?.penData) return;
    const code = penToReactComponent(selectedWireframe.penData);
    setCodePreviewContent(code);
    setCodeCopied(false);
    setShowCodePreview(true);
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(codePreviewContent);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    } catch {
      // fallback
      const ta = document.createElement('textarea');
      ta.value = codePreviewContent;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    }
  };

  return (
    <div className="flex h-full">
      {/* Wireframe List */}
      <div className="w-[320px] border-r border-border flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <PenTool className="w-5 h-5 text-amber" />
              Designs
            </h1>
            <Button
              size="sm"
              className="h-7 text-[11px] bg-amber/20 text-amber hover:bg-amber/30 border border-amber/20"
              onClick={() => setShowCreateModal(true)}
            >
              <Plus className="w-3 h-3 mr-1" /> New
            </Button>
          </div>
          {/* View toggle */}
          <div className="flex gap-1 bg-[var(--sidebar-accent)] rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'flex-1 text-[11px] font-medium py-1 rounded-md transition-all flex items-center justify-center gap-1',
                viewMode === 'grid' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              <Grid3X3 className="w-3 h-3" /> Grid
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'flex-1 text-[11px] font-medium py-1 rounded-md transition-all flex items-center justify-center gap-1',
                viewMode === 'list' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
              )}
            >
              <Layers className="w-3 h-3" /> List
            </button>
          </div>
        </div>

        {/* Wireframe Items */}
        <div className="flex-1 overflow-y-auto p-2">
          {wireframes.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <PenTool className="w-8 h-8 text-muted-foreground/20 mb-2" />
              <p className="text-sm text-muted-foreground/50">No designs yet</p>
              <p className="text-[11px] text-muted-foreground/30 mt-1">Create a new design to get started</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 gap-2">
              {wireframes.map((wf, i) => {
                const isSelected = selectedWireframe?.id === wf.id;
                const DevIcon = deviceIcon[wf.device];
                return (
                  <motion.button
                    key={wf.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelectedWireframe(wf)}
                    className={cn(
                      'rounded-xl border p-2 text-left transition-all',
                      isSelected
                        ? 'border-amber/30 bg-amber/[0.04] ring-1 ring-amber/20'
                        : 'border-border bg-[var(--surface)] hover:border-border hover:bg-[var(--sidebar-accent)]'
                    )}
                  >
                    {/* Mini preview */}
                    <div className="aspect-[4/3] rounded-lg bg-background border border-border mb-2 overflow-hidden">
                      {wf.penData ? (
                        <div className="scale-[0.25] origin-top-left w-[400%] h-[400%] pointer-events-none">
                          {wf.penData.children?.map((node, i) => (
                            <div key={i} style={{ width: wf.penData!.width ?? 375, minHeight: wf.penData!.height ?? 667 }}>
                              {/* Tiny static preview - full render in canvas */}
                              <div className="p-2 text-center text-[8px] text-muted-foreground/30">.pen</div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="scale-[0.4] origin-top-left w-[250%] h-[250%]">
                          <WireframePreview screen={wf.screen} />
                        </div>
                      )}
                    </div>
                    <p className="text-[11px] font-medium truncate">{wf.title}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <DevIcon className="w-2.5 h-2.5 text-muted-foreground/40" />
                      <Badge variant="outline" className={cn('text-[8px] h-3.5 px-1', statusConfig[wf.status].bg, statusConfig[wf.status].color)}>
                        {statusConfig[wf.status].label}
                      </Badge>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          ) : (
            <div className="space-y-1">
              {wireframes.map((wf, i) => {
                const isSelected = selectedWireframe?.id === wf.id;
                const DevIcon = deviceIcon[wf.device];
                return (
                  <motion.button
                    key={wf.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    onClick={() => setSelectedWireframe(wf)}
                    className={cn(
                      'w-full text-left px-3 py-2.5 rounded-lg transition-all flex items-center gap-3',
                      isSelected ? 'bg-amber/[0.06]' : 'hover:bg-[var(--sidebar-accent)]'
                    )}
                  >
                    <DevIcon className={cn('w-4 h-4', isSelected ? 'text-amber' : 'text-muted-foreground/40')} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{wf.title}</p>
                      <p className="text-[10px] text-muted-foreground/40">v{wf.version} · {wf.lastUpdated}</p>
                    </div>
                    <Badge variant="outline" className={cn('text-[8px] h-3.5 px-1', statusConfig[wf.status].bg, statusConfig[wf.status].color)}>
                      {statusConfig[wf.status].label}
                    </Badge>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Wireframe Viewer */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {selectedWireframe ? (
            <motion.div
              key={selectedWireframe.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col"
            >
              {/* Toolbar */}
              <div className="px-6 py-2 border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-sm font-semibold">{selectedWireframe.title}</h2>
                  <Badge variant="outline" className={cn('text-[10px]', statusConfig[selectedWireframe.status].bg, statusConfig[selectedWireframe.status].color)}>
                    {statusConfig[selectedWireframe.status].label}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/40">
                    v{selectedWireframe.version} · {selectedWireframe.components} components
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Status workflow buttons */}
                  {selectedWireframe.status === 'draft' && (
                    <Button
                      size="sm"
                      className="h-7 text-[11px] bg-amber/20 text-amber hover:bg-amber/30 border border-amber/20"
                      onClick={() => handleStatusChange('REVIEW')}
                    >
                      <Send className="w-3 h-3 mr-1" />
                      Submit for Review
                    </Button>
                  )}
                  {selectedWireframe.status === 'review' && (
                    <Button
                      size="sm"
                      className="h-7 text-[11px] bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/20"
                      onClick={() => handleStatusChange('APPROVED')}
                    >
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      Approve
                    </Button>
                  )}
                  {selectedWireframe.status === 'approved' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => handleStatusChange('DRAFT')}
                    >
                      Revert to Draft
                    </Button>
                  )}

                  {/* Export buttons (only for .pen wireframes) */}
                  {selectedWireframe.penData && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={handleExportHTML}
                      >
                        <FileCode className="w-3 h-3 mr-1" />
                        Export HTML
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px]"
                        onClick={handleExportReact}
                      >
                        <Code className="w-3 h-3 mr-1" />
                        Export React
                      </Button>
                    </>
                  )}

                  {/* Device toggles */}
                  <div className="flex gap-0.5 bg-[var(--sidebar-accent)] rounded-md p-0.5">
                    {(['desktop', 'tablet', 'mobile'] as const).map(dev => {
                      const Icon = deviceIcon[dev];
                      return (
                        <button
                          key={dev}
                          className={cn(
                            'p-1.5 rounded transition-all',
                            selectedWireframe.device === dev ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground/40 hover:text-muted-foreground'
                          )}
                        >
                          <Icon className="w-3.5 h-3.5" />
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => setShowEditModal(true)}
                  >
                    <Edit3 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] text-red-400 hover:text-red-300 hover:border-red-500/30"
                    onClick={() => setShowDeleteDialog(true)}
                  >
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                </div>
              </div>

              {/* Canvas */}
              {selectedWireframe.penData ? (
                <div className="flex-1 flex overflow-hidden">
                  <PenRenderer document={selectedWireframe.penData} className="flex-1" />
                  <DesignTokensSidebar tokens={extractDesignTokens(selectedWireframe.penData)} />
                </div>
              ) : selectedWireframe.content && selectedWireframe.title?.toLowerCase().includes('ui kit') ? (
                /* Design System — render as visual UI components */
                <DesignSystemRenderer content={selectedWireframe.content} />
              ) : selectedWireframe.content && selectedWireframe.title?.toLowerCase().includes('wireframe') ? (
                /* Wireframe — render as actual UI preview */
                <WireframeVisualRenderer content={selectedWireframe.content} />
              ) : selectedWireframe.content ? (
                /* Fallback for other document types — use visual wireframe renderer */
                <WireframeVisualRenderer content={selectedWireframe.content} />
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 bg-[var(--sidebar-accent)]">
                  <div className={cn(
                    'bg-background border border-border rounded-xl shadow-2xl overflow-hidden transition-all duration-300',
                    selectedWireframe.device === 'desktop' && 'w-full max-w-4xl aspect-[16/10]',
                    selectedWireframe.device === 'tablet' && 'w-[600px] aspect-[4/3]',
                    selectedWireframe.device === 'mobile' && 'w-[375px] aspect-[9/16]',
                  )}>
                    <WireframePreview screen={selectedWireframe.screen} />
                  </div>
                </div>
              )}

              {/* Bottom bar */}
              <div className="px-6 py-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground/40 shrink-0">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <Bot className="w-3 h-3" /> Owner: {selectedWireframe.ownerAvatar} {selectedWireframe.owner}
                  </span>
                  <span>·</span>
                  <span>Last updated {selectedWireframe.lastUpdated}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>Zoom: 100%</span>
                  <span>·</span>
                  <span>{selectedWireframe.components} components</span>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground/40">
              Select a wireframe to view
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <WireframeModal
        open={showCreateModal}
        onOpenChange={setShowCreateModal}
        projectId={projectId}
        mode="create"
        onSuccess={handleCreateSuccess}
      />
      <WireframeModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        projectId={projectId}
        mode="edit"
        wireframe={selectedWireframe}
        onSuccess={handleEditSuccess}
      />
      <DeleteWireframeDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        projectId={projectId}
        wireframeId={selectedWireframe?.id}
        wireframeTitle={selectedWireframe?.title}
        onDeleted={handleDeleteSuccess}
      />

      {/* Code Preview Modal */}
      <AnimatePresence>
        {showCodePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCodePreview(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-3xl max-h-[80vh] bg-background border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="px-5 py-3 border-b border-border flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <Code className="w-4 h-4 text-amber" />
                  <h3 className="text-sm font-semibold">React Component</h3>
                  <span className="text-[10px] text-muted-foreground/50">Tailwind CSS</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className={cn(
                      'h-7 text-[11px] transition-all',
                      codeCopied && 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    )}
                    onClick={handleCopyCode}
                  >
                    {codeCopied ? (
                      <><Check className="w-3 h-3 mr-1" /> Copied</>
                    ) : (
                      <><Copy className="w-3 h-3 mr-1" /> Copy</>
                    )}
                  </Button>
                  <button
                    onClick={() => setShowCodePreview(false)}
                    className="p-1 rounded hover:bg-[var(--sidebar-accent)] text-muted-foreground/60 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Code content */}
              <div className="flex-1 overflow-auto p-5">
                <pre className="text-[12px] leading-relaxed font-mono text-foreground/80 whitespace-pre-wrap break-words">
                  <code>{codePreviewContent}</code>
                </pre>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
