'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { MetricSkeleton } from '@/components/ui/skeleton';
import {
  BarChart3, TrendingUp, Clock, Zap,
  DollarSign, CheckCircle2, AlertTriangle, Bot, Scale,
  GitPullRequest, ShieldCheck, Activity, Target
} from 'lucide-react';

interface KPIData {
  delivery: {
    total: number;
    planned: number;
    in_progress: number;
    under_review: number;
    testing: number;
    blocked: number;
    done: number;
    released: number;
  };
  agents: {
    total: number;
    working: number;
    list: { name: string; shortName: string; avatar: string; status: string; currentTask: string | null }[];
  };
  decisions: {
    total: number;
    approved: number;
    pending: number;
    approval_rate: number;
  };
  llm: {
    total_cost: number;
    total_tokens: number;
    by_provider: Record<string, number>;
    tokens_by_provider: Record<string, number>;
  };
  sdlc: {
    stages: { name: string; status: string; gate_passed: boolean }[];
    gates_passed: number;
    total_stages: number;
  };
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percent = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="w-24 h-2 rounded-full bg-white/[0.06] overflow-hidden">
      <div className={cn('h-full rounded-full', color)} style={{ width: `${percent}%` }} />
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="h-6 w-40 rounded bg-foreground/[0.06] animate-pulse" />
          <div className="h-4 w-64 rounded bg-foreground/[0.06] animate-pulse mt-2" />
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[1, 2, 3, 4].map(i => <MetricSkeleton key={i} />)}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-border bg-[var(--surface)] p-4 h-64 animate-pulse" />
        <div className="rounded-xl border border-border bg-[var(--surface)] p-4 h-64 animate-pulse" />
      </div>
    </div>
  );
}

export default function KPIPage() {
  const params = useParams();
  const projectId = params.id as string;
  const [data, setData] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    fetch(`/api/projects/${projectId}/kpi`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <LoadingSkeleton />;

  const d = data?.delivery;
  const totalCards = d?.total ?? 0;
  const completedCards = (d?.done ?? 0) + (d?.released ?? 0);
  const blockedCards = d?.blocked ?? 0;
  const inProgressCards = d?.in_progress ?? 0;

  const agentTotal = data?.agents?.total ?? 0;
  const agentWorking = data?.agents?.working ?? 0;
  const agentList = data?.agents?.list ?? [];

  const dec = data?.decisions;
  const llm = data?.llm;
  const sdlc = data?.sdlc;

  const heroMetrics = [
    { label: 'Total Tasks', value: String(totalCards), icon: Target, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
    { label: 'AI Team Active', value: `${agentWorking}/${agentTotal}`, icon: Bot, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
    { label: 'AI Costs', value: `$${(llm?.total_cost ?? 0).toFixed(2)}`, icon: DollarSign, color: 'text-amber', bg: 'bg-amber/10 border-amber/20' },
    { label: 'Quality Checks', value: `${sdlc?.gates_passed ?? 0}/${sdlc?.total_stages ?? 0}`, icon: ShieldCheck, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  ];

  const deliveryMetrics = [
    { label: 'Cards Created', value: String(totalCards), period: 'total' },
    { label: 'Cards Completed', value: String(completedCards), period: 'total' },
    { label: 'Cards In Progress', value: String(inProgressCards), period: 'now' },
    { label: 'Under Review', value: String(d?.under_review ?? 0), period: 'now' },
    { label: 'Testing', value: String(d?.testing ?? 0), period: 'now' },
    { label: 'Blocked Items', value: String(blockedCards), period: 'now', alert: blockedCards > 0 },
  ];

  const decisionMetrics = [
    { label: 'Total Decisions', value: String(dec?.total ?? 0), sub: 'total' },
    { label: 'Approved', value: String(dec?.approved ?? 0), sub: 'total' },
    { label: 'Pending Decisions', value: String(dec?.pending ?? 0), sub: 'now', alert: (dec?.pending ?? 0) > 0 },
    { label: 'Approval Rate', value: `${dec?.approval_rate ?? 0}%`, sub: 'avg' },
    { label: 'Quality Gates Passed', value: `${sdlc?.gates_passed ?? 0}/${sdlc?.total_stages ?? 0}`, sub: 'pipeline' },
  ];

  const providerEntries = Object.entries(llm?.by_provider ?? {});
  const maxCost = providerEntries.length > 0 ? Math.max(...providerEntries.map(([, c]) => c)) : 1;

  function formatTokens(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
    return String(n);
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber" />
            Project Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Progress, AI team performance, and cost breakdown</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-white/[0.04]">Live Data</Badge>
          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <Activity className="w-2.5 h-2.5 mr-0.5" /> Live
          </Badge>
        </div>
      </motion.div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-4 gap-3">
        {heroMetrics.map((metric, i) => {
          const Icon = metric.icon;
          return (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn('rounded-xl border p-4', metric.bg)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">{metric.label}</p>
                  <p className={cn('text-3xl font-bold mt-1 tracking-tight', metric.color)}>{metric.value}</p>
                </div>
                <Icon className={cn('w-5 h-5 opacity-40', metric.color)} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Two columns: Delivery + Decisions */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-4"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Target className="w-4 h-4 text-blue-400" />
            Delivery Metrics
          </h3>
          <div className="space-y-3">
            {deliveryMetrics.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  {m.alert && <AlertTriangle className="w-3 h-3 text-red-400" />}
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-semibold', m.alert ? 'text-red-400' : 'text-foreground')}>
                    {m.value}
                  </span>
                  <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-white/[0.02]">
                    {m.period}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-4"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Scale className="w-4 h-4 text-amber" />
            Decisions & Approvals
          </h3>
          <div className="space-y-3">
            {decisionMetrics.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  {m.alert && <Clock className="w-3 h-3 text-amber" />}
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn('text-sm font-semibold', m.alert ? 'text-amber' : 'text-foreground')}>
                    {m.value}
                  </span>
                  <Badge variant="outline" className="text-[8px] h-3.5 px-1 bg-white/[0.02]">
                    {m.sub}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Agent Performance + Cost Breakdown */}
      <div className="grid grid-cols-2 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-4"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            AI Team Performance
          </h3>
          <div className="space-y-0">
            <div className="flex items-center gap-3 pb-2 border-b border-border text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold">
              <span className="w-36">Agent</span>
              <span className="w-16 text-right">Status</span>
              <span className="flex-1 text-right">Task</span>
            </div>
            {agentList.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground/40">No agents configured</div>
            ) : (
              agentList.map((agent, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                  <span className="text-xs w-36 truncate flex items-center gap-1.5">
                    <span>{agent.avatar}</span>
                    <span>{agent.shortName || agent.name}</span>
                  </span>
                  <span className={cn(
                    'text-[10px] font-semibold w-16 text-right uppercase',
                    agent.status === 'working' ? 'text-emerald-400' :
                    agent.status === 'idle' ? 'text-muted-foreground/50' : 'text-amber'
                  )}>
                    {agent.status}
                  </span>
                  <span className="flex-1 text-[10px] text-muted-foreground/50 text-right truncate">
                    {agent.currentTask || '—'}
                  </span>
                </div>
              ))
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-4"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber" />
            AI Cost Breakdown
          </h3>
          <div className="space-y-0">
            <div className="flex items-center gap-3 pb-2 border-b border-border text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold">
              <span className="w-28">Provider</span>
              <span className="w-16 text-right">Cost</span>
              <span className="w-16 text-right">Tokens</span>
              <span className="flex-1" />
            </div>
            {providerEntries.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground/40">No LLM usage recorded</div>
            ) : (
              providerEntries.map(([provider, cost]) => (
                <div key={provider} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                  <span className="text-xs w-28 truncate capitalize">{provider}</span>
                  <span className="text-xs font-semibold text-amber w-16 text-right">${cost.toFixed(2)}</span>
                  <span className="text-xs text-muted-foreground w-16 text-right font-mono">
                    {formatTokens(llm?.tokens_by_provider?.[provider] ?? 0)}
                  </span>
                  <div className="flex-1">
                    <MiniBar
                      value={cost}
                      max={maxCost}
                      color={cost === maxCost ? 'bg-amber' : 'bg-blue-500'}
                    />
                  </div>
                </div>
              ))
            )}
            <div className="flex items-center justify-between pt-3 mt-1">
              <span className="text-xs font-semibold">Total</span>
              <span className="text-sm font-bold text-amber">
                ${(llm?.total_cost ?? 0).toFixed(2)}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Pipeline Overview */}
      {sdlc && sdlc.stages.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-4"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <GitPullRequest className="w-4 h-4 text-violet-400" />
            Delivery Overview
          </h3>
          <div className="flex gap-2">
            {sdlc.stages.map((s) => {
              const isComplete = s.status === 'completed';
              const isActive = s.status === 'active';
              const isPending = s.status === 'pending';
              return (
                <div
                  key={s.name}
                  className={cn(
                    'flex-1 rounded-lg border p-3 text-center transition-all',
                    isComplete && 'border-emerald-500/20 bg-emerald-500/[0.04]',
                    isActive && 'border-amber/20 bg-amber/[0.04]',
                    isPending && 'border-border bg-white/[0.01]',
                  )}
                >
                  <p className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider',
                    isComplete && 'text-emerald-400',
                    isActive && 'text-amber',
                    isPending && 'text-muted-foreground/30',
                  )}>
                    {s.name}
                  </p>
                  <div className="mt-2">
                    {s.gate_passed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 mx-auto" />
                    ) : isActive ? (
                      <Activity className="w-4 h-4 text-amber mx-auto animate-pulse" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border mx-auto" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </div>
  );
}
