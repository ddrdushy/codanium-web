'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { WireframeModal, DeleteWireframeDialog } from '@/components/modals/wireframe-modal';
import {
  PenTool, Plus, Grid3X3, Layers, Eye, Edit3,
  Smartphone, Monitor, Tablet, ChevronRight,
  Square, Type, Image, MousePointer, Layout,
  ArrowRight, CheckCircle2, Clock, Bot, Maximize2,
  Trash2, Send,
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
}

const mockWireframes: Wireframe[] = [
  { id: 'wf-001', title: 'Dashboard Overview', screen: 'dashboard', status: 'approved', device: 'desktop', owner: 'UI/UX Designer', ownerAvatar: '🎨', lastUpdated: '3d ago', components: 14, version: 3 },
  { id: 'wf-002', title: 'Kanban Board', screen: 'board', status: 'approved', device: 'desktop', owner: 'UI/UX Designer', ownerAvatar: '🎨', lastUpdated: '2d ago', components: 22, version: 5 },
  { id: 'wf-003', title: 'Agent Chat Interface', screen: 'chat', status: 'review', device: 'desktop', owner: 'UI/UX Designer', ownerAvatar: '🎨', lastUpdated: '6h ago', components: 18, version: 2 },
  { id: 'wf-004', title: 'Decision Panel', screen: 'decisions', status: 'approved', device: 'desktop', owner: 'UI/UX Designer', ownerAvatar: '🎨', lastUpdated: '4d ago', components: 16, version: 4 },
  { id: 'wf-005', title: 'Mobile Dashboard', screen: 'dashboard-mobile', status: 'draft', device: 'mobile', owner: 'UI/UX Designer', ownerAvatar: '🎨', lastUpdated: '1h ago', components: 8, version: 1 },
  { id: 'wf-006', title: 'Settings - LLM Config', screen: 'settings', status: 'draft', device: 'desktop', owner: 'UI/UX Designer', ownerAvatar: '🎨', lastUpdated: '2h ago', components: 12, version: 1 },
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

const dbWfStatus: Record<string, Wireframe['status']> = { DRAFT: 'draft', REVIEW: 'review', APPROVED: 'approved' };
const dbDevice: Record<string, Wireframe['device']> = { DESKTOP: 'desktop', MOBILE: 'mobile', TABLET: 'tablet' };

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
    lastUpdated: w.updatedAt ? formatRelative(w.updatedAt) : 'just now',
    components: w.components ?? 0,
    version: w.version ?? 1,
  };
}

export default function WireframesPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [wireframes, setWireframes] = useState<Wireframe[]>(mockWireframes);
  const [selectedWireframe, setSelectedWireframe] = useState<Wireframe | null>(mockWireframes[0]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

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
      .catch(() => {});
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
          {viewMode === 'grid' ? (
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
                      <div className="scale-[0.4] origin-top-left w-[250%] h-[250%]">
                        <WireframePreview screen={wf.screen} />
                      </div>
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
    </div>
  );
}
