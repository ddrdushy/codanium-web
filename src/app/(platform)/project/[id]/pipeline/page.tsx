'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';

import { SDLCProgress } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeploymentPipelines } from '@/lib/hooks/use-deployment-pipelines';
import { useTaskQueue } from '@/lib/hooks/use-task-queue';
import {
  CheckCircle2, Loader2, XCircle, Clock, Timer,
  Zap, Shield, Rocket, GitBranch, Play,
  ChevronDown, ChevronRight, Terminal, Bot,
  Workflow, Container, ListTodo, Ban,
} from 'lucide-react';

// ─── SDLC Stage Metadata ────────────────────────────────────────────

const stageIcons: Record<string, string> = {
  'Idea & Planning': '\u{1F7E2}',
  'Requirement Gathering': '\u{1F7E1}',
  'Solution Design': '\u{1F535}',
  'UX/UI Design': '\u{1F7E3}',
  'Development': '\u{1F534}',
  'Testing': '\u{1F9EA}',
  'Deployment': '\u{1F680}',
  'Maintenance & Improvement': '\u{1F504}',
};

const gateDescriptions: Record<string, string> = {
  'Idea & Planning': 'Vision document or BRD must exist',
  'Requirement Gathering': 'BRD must be approved by stakeholder',
  'Solution Design': 'System Design Document (SDD/HLD) must be approved',
  'UX/UI Design': 'Wireframes or UI designs must be approved',
  'Development': 'Task cards must exist on the board',
  'Testing': 'Code artifacts must exist for testing',
  'Deployment': 'All tests must pass and release approved',
  'Maintenance & Improvement': 'System deployed and running in production',
};

// ─── Deploy Stage Steps ─────────────────────────────────────────────

const DEPLOY_STAGES = ['BUILD', 'TEST', 'DEPLOY', 'COMPLETE'] as const;

function deployStageIndex(stage: string): number {
  const idx = DEPLOY_STAGES.indexOf(stage as typeof DEPLOY_STAGES[number]);
  return idx === -1 ? 0 : idx;
}

// ─── Helpers ────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  return `${mins}m ${remSecs}s`;
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function statusColor(status: string) {
  switch (status) {
    case 'SUCCESS':
    case 'COMPLETED':
      return 'text-emerald-400';
    case 'RUNNING':
      return 'text-amber';
    case 'PENDING':
      return 'text-blue-400';
    case 'FAILED':
    case 'ERROR':
      return 'text-red-400';
    case 'CANCELLED':
      return 'text-zinc-400';
    default:
      return 'text-muted-foreground';
  }
}

function statusBg(status: string) {
  switch (status) {
    case 'SUCCESS':
    case 'COMPLETED':
      return 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20';
    case 'RUNNING':
      return 'bg-amber/15 text-amber border-amber/20';
    case 'PENDING':
      return 'bg-blue-500/15 text-blue-400 border-blue-500/20';
    case 'FAILED':
    case 'ERROR':
      return 'bg-red-500/15 text-red-400 border-red-500/20';
    case 'CANCELLED':
      return 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20';
    default:
      return 'bg-white/[0.04] text-muted-foreground border-border';
  }
}

function StatusIcon({ status, className }: { status: string; className?: string }) {
  switch (status) {
    case 'SUCCESS':
    case 'COMPLETED':
      return <CheckCircle2 className={cn('w-4 h-4 text-emerald-400', className)} />;
    case 'RUNNING':
      return <Loader2 className={cn('w-4 h-4 text-amber animate-spin', className)} />;
    case 'PENDING':
      return <Clock className={cn('w-4 h-4 text-blue-400', className)} />;
    case 'FAILED':
    case 'ERROR':
      return <XCircle className={cn('w-4 h-4 text-red-400', className)} />;
    case 'CANCELLED':
      return <Ban className={cn('w-4 h-4 text-zinc-400', className)} />;
    default:
      return <Clock className={cn('w-4 h-4 text-muted-foreground', className)} />;
  }
}

// ─── Tab Type ───────────────────────────────────────────────────────

type TabKey = 'delivery' | 'deployments' | 'tasks';

const tabs: { key: TabKey; label: string; icon: typeof Workflow }[] = [
  { key: 'delivery', label: 'Delivery Progress', icon: Workflow },
  { key: 'deployments', label: 'Deployments', icon: Rocket },
  { key: 'tasks', label: 'Task Queue', icon: ListTodo },
];

// ═══════════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════════

export default function PipelinePage() {
  const params = useParams();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState<TabKey>('delivery');

  // ── SDLC state (Delivery Progress tab) ──
  const [stages, setStages] = useState<SDLCProgress[]>([]);
  const [sdlcLoading, setSdlcLoading] = useState(true);

  useEffect(() => {
    if (projectId) {
      fetch(`/api/projects/${projectId}/sdlc`)
        .then(res => res.ok ? res.json() : Promise.reject())
        .then((data: any[]) => {
          setStages(data.map(s => ({
            stage: s.name as SDLCProgress['stage'],
            status: s.status.toLowerCase() as SDLCProgress['status'],
            gate_passed: s.gatePassed,
          })));
        })
        .catch(() => { setStages([]); })
        .finally(() => setSdlcLoading(false));
    } else {
      setSdlcLoading(false);
    }
  }, [projectId]);

  // ── Deployment pipelines (Deployments tab) ──
  const {
    pipelines,
    loading: pipelinesLoading,
    triggerDeploy,
    cancelRun,
  } = useDeploymentPipelines(projectId);

  // ── Task queue (Task Queue tab) ──
  const {
    activeTasks,
    recentTasks,
    loading: tasksLoading,
    cancelTask,
  } = useTaskQueue(projectId);

  // ── derived SDLC stats ──
  const completedCount = stages.filter(s => s.status === 'completed').length;
  const activeCount = stages.filter(s => s.status === 'active').length;
  const pendingCount = stages.filter(s => s.status === 'pending').length;

  return (
    <div className="flex h-full flex-col">
      {/* ── Page header + tabs ── */}
      <div className="px-6 py-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Workflow className="w-4 h-4 text-amber" />
          <h1 className="text-sm font-semibold">Pipeline</h1>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all border-b-2',
                  isActive
                    ? 'border-amber text-amber bg-amber/[0.06]'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-white/[0.03]',
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {activeTab === 'delivery' && (
            <motion.div
              key="delivery"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <DeliveryProgressTab
                stages={stages}
                loading={sdlcLoading}
                completedCount={completedCount}
                activeCount={activeCount}
                pendingCount={pendingCount}
              />
            </motion.div>
          )}

          {activeTab === 'deployments' && (
            <motion.div
              key="deployments"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <DeploymentsTab
                pipelines={pipelines}
                loading={pipelinesLoading}
                onTrigger={triggerDeploy}
                onCancel={cancelRun}
              />
            </motion.div>
          )}

          {activeTab === 'tasks' && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <TaskQueueTab
                activeTasks={activeTasks}
                recentTasks={recentTasks}
                loading={tasksLoading}
                onCancel={cancelTask}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tab 1: Delivery Progress (existing SDLC visualization)
// ═══════════════════════════════════════════════════════════════════

function DeliveryProgressTab({
  stages,
  loading,
  completedCount,
  activeCount,
  pendingCount,
}: {
  stages: SDLCProgress[];
  loading: boolean;
  completedCount: number;
  activeCount: number;
  pendingCount: number;
}) {
  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-64" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 p-4 rounded-xl border border-border">
              <Skeleton className="w-10 h-10 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-56" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-lg font-bold tracking-tight">Delivery Progress</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {stages.length}-step delivery process — quality checks at every step
        </p>
      </motion.div>

      {/* Pipeline Flow */}
      <div className="space-y-3">
        {stages.length === 0 && (
          <div className="rounded-xl border border-border bg-[var(--surface)] p-8 text-center">
            <Workflow className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-foreground mb-1">No delivery stages yet</h3>
            <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">
              Delivery stages will appear here once your project is set up.
            </p>
          </div>
        )}
        {stages.map((stage, i) => {
          const icon = stageIcons[stage.stage] || '\u{1F4CB}';
          const gate = gateDescriptions[stage.stage] || '';
          const isLast = i === stages.length - 1;

          return (
            <motion.div
              key={stage.stage}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
            >
              <div className={cn(
                'relative flex items-start gap-4 p-4 rounded-xl border transition-all',
                stage.status === 'completed' && 'border-emerald-500/20 bg-emerald-500/[0.03]',
                stage.status === 'active' && 'border-amber/30 bg-amber/[0.04] glow-amber',
                stage.status === 'pending' && 'border-border bg-[var(--surface)]/30 opacity-50',
                stage.status === 'blocked' && 'border-red-500/30 bg-red-500/[0.04]',
              )}>
                {/* Stage number */}
                <div className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold shrink-0',
                  stage.status === 'completed' && 'bg-emerald-500/15 text-emerald-400',
                  stage.status === 'active' && 'bg-amber/15 text-amber',
                  stage.status === 'pending' && 'bg-white/[0.04] text-muted-foreground/40',
                  stage.status === 'blocked' && 'bg-red-500/15 text-red-400',
                )}>
                  {stage.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : stage.status === 'active' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>

                {/* Stage info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <h3 className={cn(
                      'text-sm font-semibold',
                      stage.status === 'completed' && 'text-emerald-400',
                      stage.status === 'active' && 'text-amber',
                      stage.status === 'pending' && 'text-muted-foreground/50',
                    )}>
                      {stage.stage}
                    </h3>
                    {stage.status === 'active' && (
                      <Badge className="bg-amber/15 text-amber border-amber/20 text-[10px]">
                        Active
                      </Badge>
                    )}
                    {stage.status === 'completed' && stage.gate_passed && (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]">
                        Check Passed
                      </Badge>
                    )}
                  </div>

                  {/* Quality Gate */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <Shield className={cn(
                      'w-3 h-3',
                      stage.gate_passed ? 'text-emerald-500' : 'text-muted-foreground/30'
                    )} />
                    <span className="text-[11px] text-muted-foreground/70">{gate}</span>
                  </div>
                </div>

                {/* Status */}
                <div className="text-right shrink-0">
                  {stage.status === 'completed' && (
                    <span className="text-xs font-medium text-emerald-400">Complete</span>
                  )}
                  {stage.status === 'active' && (
                    <span className="text-xs font-medium text-amber">In Progress</span>
                  )}
                  {stage.status === 'pending' && (
                    <span className="text-xs font-medium text-muted-foreground/30">Pending</span>
                  )}
                </div>

                {/* Connector */}
                {!isLast && (
                  <div className="absolute left-[2.05rem] top-14 w-[2px] h-3 bg-gradient-to-b from-border to-transparent" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="rounded-xl border border-border bg-[var(--surface)] p-4"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="w-3 h-3 text-amber" />
          <span><strong className="text-foreground">{completedCount} of {stages.length}</strong> stages completed</span>
          <span className="text-border">&middot;</span>
          <span><strong className="text-amber">{activeCount}</strong> stages active</span>
          <span className="text-border">&middot;</span>
          <span><strong className="text-muted-foreground/50">{pendingCount}</strong> pending</span>
        </div>
      </motion.div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tab 2: Deployments
// ═══════════════════════════════════════════════════════════════════

function DeploymentsTab({
  pipelines,
  loading,
  onTrigger,
  onCancel,
}: {
  pipelines: any[];
  loading: boolean;
  onTrigger: (pipelineId: string, branch?: string) => Promise<boolean>;
  onCancel: (pipelineId: string, runId: string) => void;
}) {
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [expandedLogTab, setExpandedLogTab] = useState<'build' | 'test' | 'deploy'>('build');

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-64" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-5 space-y-3">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (pipelines.length === 0) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-8 text-center"
        >
          <Rocket className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">No deployment pipelines yet</h3>
          <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">
            Deployment pipelines will appear here once your project reaches the Release stage.
            Your AI team handles all the setup automatically.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-lg font-bold tracking-tight">Deployments</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          {pipelines.length} pipeline{pipelines.length !== 1 ? 's' : ''} configured — trigger, monitor, and review deployment runs
        </p>
      </motion.div>

      {pipelines.map((pipeline, pi) => {
        const latestRun = pipeline.runs?.[0];
        return (
          <motion.div
            key={pipeline.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: pi * 0.08, duration: 0.3 }}
            className="rounded-xl border border-border bg-[var(--surface)] p-5 space-y-4"
          >
            {/* Pipeline header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center">
                  <Rocket className="w-4 h-4 text-amber" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground">{pipeline.name}</h3>
                    <Badge className={cn(
                      'text-[10px]',
                      pipeline.environment === 'production'
                        ? 'bg-red-500/15 text-red-400 border-red-500/20'
                        : pipeline.environment === 'staging'
                        ? 'bg-amber/15 text-amber border-amber/20'
                        : 'bg-blue-500/15 text-blue-400 border-blue-500/20',
                    )}>
                      {pipeline.environment}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
                      <Zap className="w-2.5 h-2.5" /> {pipeline.trigger}
                    </span>
                    <span className="text-[10px] text-muted-foreground/30">&middot;</span>
                    <span className="text-[10px] text-muted-foreground/50">
                      {pipeline.runs?.length ?? 0} runs
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => onTrigger(pipeline.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-amber text-background hover:bg-amber/90 transition-colors"
              >
                <Play className="w-3 h-3" />
                Trigger Deploy
              </button>
            </div>

            {/* Latest run stage indicator */}
            {latestRun && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground/60">
                  <StatusIcon status={latestRun.status} className="w-3.5 h-3.5" />
                  <span className={statusColor(latestRun.status)}>Latest run: {latestRun.status}</span>
                  {latestRun.branch && (
                    <>
                      <span className="text-muted-foreground/20">&middot;</span>
                      <GitBranch className="w-3 h-3" />
                      <span>{latestRun.branch}</span>
                    </>
                  )}
                  {latestRun.durationMs > 0 && (
                    <>
                      <span className="text-muted-foreground/20">&middot;</span>
                      <Timer className="w-3 h-3" />
                      <span>{formatDuration(latestRun.durationMs)}</span>
                    </>
                  )}
                </div>

                {/* Stage progress bar */}
                <div className="flex items-center gap-1">
                  {DEPLOY_STAGES.map((stg, si) => {
                    const currentIdx = deployStageIndex(latestRun.currentStage || 'BUILD');
                    const isFailed = latestRun.status === 'FAILED';
                    const isRunning = latestRun.status === 'RUNNING';
                    let stageState: 'done' | 'active' | 'pending' | 'error' = 'pending';
                    if (latestRun.status === 'SUCCESS' || latestRun.status === 'COMPLETED') {
                      stageState = 'done';
                    } else if (si < currentIdx) {
                      stageState = 'done';
                    } else if (si === currentIdx) {
                      stageState = isFailed ? 'error' : isRunning ? 'active' : 'pending';
                    }
                    return (
                      <div key={stg} className="flex items-center gap-1 flex-1">
                        <div className={cn(
                          'h-1.5 flex-1 rounded-full transition-all duration-500',
                          stageState === 'done' && 'bg-emerald-500',
                          stageState === 'active' && 'bg-amber animate-pulse',
                          stageState === 'error' && 'bg-red-500',
                          stageState === 'pending' && 'bg-white/[0.06]',
                        )} />
                        {si < DEPLOY_STAGES.length - 1 && (
                          <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/20 shrink-0" />
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[9px] text-muted-foreground/40 px-0.5">
                  {DEPLOY_STAGES.map(stg => (
                    <span key={stg}>{stg}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Run history */}
            {pipeline.runs && pipeline.runs.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                  Run History
                </h4>
                {pipeline.runs.map((run: any) => (
                  <div key={run.id}>
                    <button
                      onClick={() => setExpandedRun(expandedRun === run.id ? null : run.id)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.03] transition-colors text-left"
                    >
                      <StatusIcon status={run.status} className="w-3.5 h-3.5 shrink-0" />
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <span className="text-[11px] font-mono text-muted-foreground truncate">
                          {run.commitHash ? run.commitHash.slice(0, 7) : run.id.slice(0, 7)}
                        </span>
                        <Badge className={cn('text-[9px]', statusBg(run.status))}>
                          {run.status}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground/50 shrink-0">
                        {run.durationMs > 0 && (
                          <span className="flex items-center gap-1">
                            <Timer className="w-2.5 h-2.5" />
                            {formatDuration(run.durationMs)}
                          </span>
                        )}
                        <span>{run.triggeredBy}</span>
                        <span>{formatTimeAgo(run.createdAt)}</span>
                        {(run.status === 'RUNNING' || run.status === 'PENDING') && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onCancel(pipeline.id, run.id); }}
                            className="text-red-400 hover:text-red-300 text-[10px] font-medium ml-1"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      <ChevronDown className={cn(
                        'w-3 h-3 text-muted-foreground/30 transition-transform shrink-0',
                        expandedRun === run.id && 'rotate-180',
                      )} />
                    </button>

                    {/* Expanded log viewer */}
                    <AnimatePresence>
                      {expandedRun === run.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-6 mt-1 mb-2 rounded-lg border border-border overflow-hidden">
                            {/* Log tabs */}
                            <div className="flex border-b border-border bg-white/[0.02]">
                              {(['build', 'test', 'deploy'] as const).map(lt => (
                                <button
                                  key={lt}
                                  onClick={() => setExpandedLogTab(lt)}
                                  className={cn(
                                    'flex items-center gap-1 px-3 py-1.5 text-[10px] font-medium capitalize transition-colors',
                                    expandedLogTab === lt
                                      ? 'text-amber border-b-2 border-amber'
                                      : 'text-muted-foreground/50 hover:text-muted-foreground border-b-2 border-transparent',
                                  )}
                                >
                                  <Terminal className="w-2.5 h-2.5" />
                                  {lt}
                                </button>
                              ))}
                            </div>
                            <pre className="px-3 py-2 text-[11px] leading-4 font-mono text-muted-foreground/70 bg-black/20 overflow-x-auto max-h-48 overflow-y-auto">
                              {expandedLogTab === 'build' && (run.buildLogs || 'No build logs available.')}
                              {expandedLogTab === 'test' && (run.testLogs || 'No test logs available.')}
                              {expandedLogTab === 'deploy' && (run.deployLogs || 'No deploy logs available.')}
                            </pre>
                            {run.errorMessage && (
                              <div className="px-3 py-2 bg-red-500/[0.06] border-t border-red-500/15 text-[11px] text-red-400">
                                <strong>Error:</strong> {run.errorMessage}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Tab 3: Task Queue
// ═══════════════════════════════════════════════════════════════════

function TaskQueueTab({
  activeTasks,
  recentTasks,
  loading,
  onCancel,
}: {
  activeTasks: any[];
  recentTasks: any[];
  loading: boolean;
  onCancel: (taskId: string) => void;
}) {
  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3 w-56" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border p-4 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-64" />
          </div>
        ))}
      </div>
    );
  }

  const noTasks = activeTasks.length === 0 && recentTasks.length === 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-lg font-bold tracking-tight">Task Queue</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Monitor active and recent background tasks processed by your AI team
        </p>
      </motion.div>

      {noTasks && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-8 text-center"
        >
          <ListTodo className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground mb-1">No tasks in the queue</h3>
          <p className="text-xs text-muted-foreground/60 max-w-sm mx-auto">
            When you interact with your AI team, background tasks like code generation, testing, and analysis
            will appear here so you can track their progress.
          </p>
        </motion.div>
      )}

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-amber animate-pulse" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
              Active Tasks ({activeTasks.length})
            </h2>
          </div>

          {activeTasks.map((task, i) => {
            const elapsed = task.startedAt
              ? Date.now() - new Date(task.startedAt).getTime()
              : Date.now() - new Date(task.createdAt).getTime();

            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn(
                  'rounded-xl border p-4 transition-all',
                  task.status === 'RUNNING'
                    ? 'border-amber/30 bg-amber/[0.04]'
                    : 'border-blue-500/20 bg-blue-500/[0.03]',
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {task.status === 'RUNNING' ? (
                      <Loader2 className="w-4 h-4 text-amber animate-spin" />
                    ) : (
                      <Clock className="w-4 h-4 text-blue-400" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Bot className="w-3 h-3 text-muted-foreground/50" />
                        {task.routedTo}
                      </span>
                      <Badge className={cn('text-[9px]', statusBg(task.status))}>
                        {task.status}
                      </Badge>
                      {task.isBackground && (
                        <Badge className="text-[9px] bg-white/[0.04] text-muted-foreground/50 border-border">
                          Background
                        </Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground/70 mt-1 line-clamp-2">
                      {task.userMessage}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground/40">
                      <span className="flex items-center gap-1">
                        <Timer className="w-2.5 h-2.5" />
                        {formatDuration(elapsed)}
                      </span>
                      {task.retryCount > 0 && (
                        <span>Retries: {task.retryCount}</span>
                      )}
                    </div>
                  </div>

                  {(task.status === 'RUNNING' || task.status === 'PENDING') && (
                    <button
                      onClick={() => onCancel(task.id)}
                      className="shrink-0 px-2.5 py-1 text-[10px] font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Recent Completed Tasks */}
      {recentTasks.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Recent Tasks ({recentTasks.length})
          </h2>

          {recentTasks.map((task, i) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, x: -15 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-border bg-[var(--surface)] p-4"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 shrink-0">
                  <StatusIcon status={task.status} className="w-4 h-4" />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Bot className="w-3 h-3 text-muted-foreground/50" />
                      {task.routedTo}
                    </span>
                    <Badge className={cn('text-[9px]', statusBg(task.status))}>
                      {task.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground/70 mt-1 line-clamp-1">
                    {task.userMessage}
                  </p>
                </div>

                <div className="text-right shrink-0 space-y-0.5">
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/40">
                    {task.durationMs > 0 && (
                      <span className="flex items-center gap-1">
                        <Timer className="w-2.5 h-2.5" />
                        {formatDuration(task.latencyMs || task.durationMs)}
                      </span>
                    )}
                    {task.tokensTotal > 0 && (
                      <span>{task.tokensTotal.toLocaleString()} tokens</span>
                    )}
                  </div>
                  <div className="text-[9px] text-muted-foreground/30">
                    {formatTimeAgo(task.completedAt || task.createdAt)}
                  </div>
                </div>
              </div>

              {task.errorMessage && (
                <div className="mt-2 ml-7 px-2.5 py-1.5 rounded-md bg-red-500/[0.06] border border-red-500/15 text-[10px] text-red-400">
                  {task.errorMessage}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
