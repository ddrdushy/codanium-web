'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { parseSDDToArchitecture, SDDArchitectureData, ArchNode } from '@/lib/sdd-parser';
import { AIRecommendations } from './ai-recommendations';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Network, Brain, FileText,
  Activity, Clock, AlertTriangle, Database,
  Cpu, DollarSign, Loader2, ArrowLeft,
  Globe, Server, Shield, Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

// Lazy-load React Flow canvas (heavy dependency, avoid SSR)
const ArchitectureCanvas = dynamic(
  () => import('./architecture-canvas').then(m => ({ default: m.ArchitectureCanvas })),
  { ssr: false, loading: () => <CanvasLoader /> }
);

function CanvasLoader() {
  return (
    <div className="flex-1 flex items-center justify-center bg-[var(--surface)]/30 rounded-xl border border-border">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading architecture view...</span>
      </div>
    </div>
  );
}

// ─── Tab Definitions ────────────────────────────────────────────────────────

type DashboardTab = 'overview' | 'architecture' | 'ai-review' | 'docs';

const TABS: { key: DashboardTab; label: string; icon: React.ElementType }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'architecture', label: 'Architecture', icon: Network },
  { key: 'ai-review', label: 'AI Review', icon: Brain },
  { key: 'docs', label: 'Docs', icon: FileText },
];

// ─── Overview Metrics ───────────────────────────────────────────────────────

function MetricCard({
  label, value, subtext, icon: Icon, color, index,
}: {
  label: string; value: string; subtext: string;
  icon: React.ElementType; color: string; index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06, duration: 0.3 }}
      className="rounded-xl border border-border bg-[var(--surface)] p-4 hover:border-amber/20 transition-colors"
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{subtext}</p>
        </div>
        <div className={cn('p-2 rounded-lg', color)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </motion.div>
  );
}

function OverviewTab({ data, sddContent }: { data: SDDArchitectureData; sddContent: string }) {
  const wordCount = sddContent.split(/\s+/).length;
  const sectionCount = (sddContent.match(/^#{1,3}\s/gm) || []).length;

  const metrics = [
    { label: 'Components', value: String(data.metrics.totalNodes), subtext: 'Architecture nodes', icon: Server, color: 'bg-amber-500/10 text-amber-400' },
    { label: 'Connections', value: String(data.metrics.totalEdges), subtext: 'Service links', icon: Network, color: 'bg-blue-500/10 text-blue-400' },
    { label: 'Tiers', value: String(data.metrics.tiers), subtext: 'Architecture layers', icon: Layers, color: 'bg-violet-500/10 text-violet-400' },
    { label: 'SDD Sections', value: String(sectionCount), subtext: `${wordCount.toLocaleString()} words`, icon: FileText, color: 'bg-emerald-500/10 text-emerald-400' },
    { label: 'Databases', value: data.metrics.hasDatabase ? 'Yes' : 'No', subtext: data.metrics.hasCache ? 'Cache: Yes' : 'Cache: No', icon: Database, color: 'bg-indigo-500/10 text-indigo-400' },
    { label: 'Infrastructure', value: data.metrics.hasQueue ? 'Async' : 'Sync', subtext: data.metrics.hasCDN ? 'CDN: Yes' : 'CDN: No', icon: Globe, color: 'bg-pink-500/10 text-pink-400' },
  ];

  return (
    <div className="p-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {metrics.map((m, i) => (
          <MetricCard key={m.label} {...m} index={i} />
        ))}
      </div>

      {/* Architecture summary */}
      <div className="mt-6 rounded-xl border border-border bg-[var(--surface)] p-5">
        <h3 className="text-sm font-bold text-foreground mb-3">Architecture Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {data.nodes.map((node) => (
            <div key={node.id} className="flex items-center gap-2 text-xs">
              <div className="w-2 h-2 rounded-full bg-amber/60" />
              <span className="text-foreground font-medium truncate">{node.label}</span>
              <span className="text-muted-foreground/50 text-[10px]">{node.type}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Architecture Tab ───────────────────────────────────────────────────────

function ArchitectureTab({ data }: { data: SDDArchitectureData }) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const nodeDetail = useMemo(
    () => data.nodes.find(n => n.id === selectedNode),
    [data.nodes, selectedNode]
  );

  return (
    <div className="flex h-full overflow-hidden">
      {/* AI Recommendations sidebar */}
      <div className="w-[240px] border-r border-border overflow-y-auto shrink-0">
        <AIRecommendations data={data} />
      </div>

      {/* Canvas */}
      <div className="flex-1 relative">
        <ArchitectureCanvas data={data} onNodeClick={setSelectedNode} />
      </div>

      {/* Node detail panel */}
      <AnimatePresence>
        {nodeDetail && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-l border-border overflow-hidden shrink-0"
          >
            <div className="w-[260px] p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-foreground">{nodeDetail.label}</h3>
                <button
                  onClick={() => setSelectedNode(null)}
                  className="text-muted-foreground hover:text-foreground text-xs"
                >
                  Close
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Type</p>
                  <p className="text-xs text-foreground mt-0.5">{nodeDetail.type.replace('-', ' ')}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Tier</p>
                  <p className="text-xs text-foreground mt-0.5">
                    {({ 0: 'Client', 1: 'Edge / Gateway', 2: 'Services', 3: 'Data Layer' } as Record<number, string>)[nodeDetail.tier] ?? 'Unknown'}
                  </p>
                </div>
                {nodeDetail.technology && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Technology</p>
                    <p className="text-xs text-foreground mt-0.5">{nodeDetail.technology}</p>
                  </div>
                )}
                {nodeDetail.description && (
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Description</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{nodeDetail.description}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Connections</p>
                  <p className="text-xs text-foreground mt-0.5">
                    {data.edges.filter(e => e.source === nodeDetail.id || e.target === nodeDetail.id).length} edges
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── AI Review Tab ──────────────────────────────────────────────────────────

function AIReviewTab({ data, sddContent }: { data: SDDArchitectureData; sddContent: string }) {
  const wordCount = sddContent.split(/\s+/).length;
  const sectionCount = (sddContent.match(/^#{1,3}\s/gm) || []).length;

  // Completeness heuristics
  const hasArchSection = /architecture|system design|component/i.test(sddContent);
  const hasApiSection = /api|endpoint|route/i.test(sddContent);
  const hasDbSection = /database|schema|model|entity/i.test(sddContent);
  const hasSecSection = /security|auth|encryption/i.test(sddContent);
  const hasDeploySection = /deploy|infrastructure|docker|ci\/cd/i.test(sddContent);

  const checks = [
    { label: 'Architecture Overview', passed: hasArchSection },
    { label: 'API Specification', passed: hasApiSection },
    { label: 'Database Schema', passed: hasDbSection },
    { label: 'Security Design', passed: hasSecSection },
    { label: 'Deployment Strategy', passed: hasDeploySection },
    { label: 'Minimum 1000 words', passed: wordCount >= 1000 },
    { label: 'At least 5 sections', passed: sectionCount >= 5 },
    { label: 'Component definitions', passed: data.metrics.totalNodes >= 3 },
  ];

  const passedCount = checks.filter(c => c.passed).length;
  const completeness = Math.round((passedCount / checks.length) * 100);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* Completeness Score */}
      <div className="rounded-xl border border-border bg-[var(--surface)] p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-foreground">SDD Completeness</h3>
          <span className={cn(
            'text-lg font-bold tabular-nums',
            completeness >= 80 ? 'text-emerald-400' : completeness >= 50 ? 'text-amber' : 'text-red-400'
          )}>
            {completeness}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-foreground/[0.06] overflow-hidden mb-4">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              completeness >= 80 ? 'bg-emerald-500' : completeness >= 50 ? 'bg-amber' : 'bg-red-500'
            )}
            style={{ width: `${completeness}%` }}
          />
        </div>

        <div className="space-y-2">
          {checks.map((check) => (
            <div key={check.label} className="flex items-center gap-2.5">
              <div className={cn(
                'w-4 h-4 rounded-full flex items-center justify-center text-[8px]',
                check.passed ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'
              )}>
                {check.passed ? '✓' : '✕'}
              </div>
              <span className={cn(
                'text-xs',
                check.passed ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {check.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Recommendations (full width) */}
      <div className="rounded-xl border border-border bg-[var(--surface)] overflow-hidden">
        <AIRecommendations data={data} />
      </div>
    </div>
  );
}

// ─── Docs Tab ───────────────────────────────────────────────────────────────

function DocsTab({ sddContent }: { sddContent: string }) {
  if (!sddContent.trim()) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">No SDD content available.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-3xl mx-auto prose prose-invert prose-sm">
        <div className="whitespace-pre-wrap text-xs text-muted-foreground font-mono leading-relaxed bg-[var(--surface)] rounded-xl border border-border p-6">
          {sddContent}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────────────────────

interface SDDDashboardProps {
  projectId: string;
  sddContent: string;
  projectName: string;
}

export function SDDDashboard({ projectId, sddContent, projectName }: SDDDashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  const archData = useMemo(() => parseSDDToArchitecture(sddContent), [sddContent]);

  return (
    <div className="flex flex-col h-full bg-[hsl(var(--background))]">
      {/* Top bar */}
      <div className="px-6 py-3 border-b border-border bg-[var(--surface)]/30 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href={`/project/${projectId}/docs`}
            className="p-1.5 rounded-md hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-sm font-bold text-foreground">{projectName} — Architecture</h1>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              System Design Document Analysis
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center bg-foreground/[0.04] rounded-lg p-0.5 border border-border">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                activeTab === key
                  ? 'bg-amber/15 text-amber border border-amber/20 shadow-sm'
                  : 'text-muted-foreground hover:text-foreground border border-transparent'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full overflow-y-auto"
            >
              <OverviewTab data={archData} sddContent={sddContent} />
            </motion.div>
          )}
          {activeTab === 'architecture' && (
            <motion.div
              key="architecture"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full"
            >
              <ArchitectureTab data={archData} />
            </motion.div>
          )}
          {activeTab === 'ai-review' && (
            <motion.div
              key="ai-review"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full overflow-y-auto"
            >
              <AIReviewTab data={archData} sddContent={sddContent} />
            </motion.div>
          )}
          {activeTab === 'docs' && (
            <motion.div
              key="docs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              <DocsTab sddContent={sddContent} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
