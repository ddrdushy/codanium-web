'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Timer, AlertTriangle, CheckCircle2, TrendingUp,
  RefreshCw, Bot, Zap,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, AreaChart, Area,
} from 'recharts';
import { StatCard } from '@/components/admin/stat-card';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LatencyDay {
  date: string;
  p50: number;
  p95: number;
  p99: number;
  avg_ms: number;
  total: number;
}

interface ErrorRateDay {
  date: string;
  success: number;
  failed: number;
  timeout: number;
  total: number;
}

interface AgentRow {
  agent: string;
  total_runs: number;
  completed: number;
  failed: number;
  avg_latency_ms: number;
  p95_latency_ms: number;
  avg_tokens: number;
}

interface TopError {
  error_message: string;
  count: number;
}

interface ObsData {
  latencyByDay: LatencyDay[];
  errorRateByDay: ErrorRateDay[];
  agentPerf: AgentRow[];
  topErrors: TopError[];
  summary: {
    totalRuns: number;
    completedRuns: number;
    failedRuns: number;
    successRate: number;
    avgLatencyMs: number;
    avgTokensPerRun: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtMs(ms: number): string {
  if (!ms || ms <= 0) return '—';
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms >= 1000)  return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function fmtDate(iso: string): string {
  const d = new Date(typeof iso === 'string' && iso.includes('T') ? iso : iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function successColor(rate: number): string {
  if (rate >= 95) return 'text-emerald-400';
  if (rate >= 80) return 'text-amber';
  return 'text-red-400';
}

// ---------------------------------------------------------------------------
// Chart tooltips
// ---------------------------------------------------------------------------

function LatencyTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((e: any) => (
        <div key={e.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: e.color }} />
          <span className="text-muted-foreground capitalize">{e.name}:</span>
          <span className="font-medium">{fmtMs(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

function ErrorTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg text-xs">
      <p className="font-semibold mb-2">{label}</p>
      {payload.map((e: any) => (
        <div key={e.dataKey} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: e.color }} />
          <span className="text-muted-foreground capitalize">{e.name}:</span>
          <span className="font-medium">{e.value}</span>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.07 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

export default function ObservabilityPage() {
  const [data,    setData]    = useState<ObsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/observability')
      .then(r => r.json())
      .then(d => { setData(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  // Chart data: latency by day
  const latencyData = useMemo(() => {
    if (!data?.latencyByDay.length) return [];
    return data.latencyByDay.map(d => ({
      ...d,
      label: fmtDate(d.date),
      p50:   Math.round(d.p50 ?? 0),
      p95:   Math.round(d.p95 ?? 0),
      p99:   Math.round(d.p99 ?? 0),
    }));
  }, [data]);

  // Chart data: error rates by day
  const errorData = useMemo(() => {
    if (!data?.errorRateByDay.length) return [];
    return data.errorRateByDay.map(d => ({
      ...d,
      label: fmtDate(d.date),
    }));
  }, [data]);

  const s = data?.summary;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div
        variants={itemVariants}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">Observability</h1>
          <p className="text-sm text-muted-foreground mt-1">
            LLM latency, error rates, agent performance — last 30 days
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border/50 transition-all"
        >
          <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
          Refresh
        </button>
      </motion.div>

      {/* Summary stat cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Success Rate"
          value={s ? `${s.successRate}%` : '—'}
          icon={<CheckCircle2 className="w-5 h-5" />}
          color={s ? (s.successRate >= 95 ? '#10b981' : s.successRate >= 80 ? '#f59e0b' : '#ef4444') : '#64748b'}
        />
        <StatCard
          title="Avg Latency"
          value={fmtMs(s?.avgLatencyMs ?? 0)}
          icon={<Timer className="w-5 h-5" />}
          color="#3b82f6"
        />
        <StatCard
          title="Total Runs"
          value={(s?.totalRuns ?? 0).toLocaleString()}
          icon={<TrendingUp className="w-5 h-5" />}
          color="#8b5cf6"
        />
        <StatCard
          title="Failed Runs"
          value={(s?.failedRuns ?? 0).toLocaleString()}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="#ef4444"
        />
      </motion.div>

      {/* Latency chart + Error rate chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Latency percentiles */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold mb-1">Latency Percentiles</h2>
          <p className="text-xs text-muted-foreground mb-5">p50 / p95 / p99 (ms) — last 30 days</p>
          <div className="h-[240px]">
            {latencyData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={latencyData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dy={6} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={fmtMs} dx={-4} />
                  <Tooltip content={<LatencyTooltip />} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
                  <Line type="monotone" dataKey="p50" name="p50" stroke="#10b981" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="p95" name="p95" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="p99" name="p99" stroke="#ef4444" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground/40 text-sm">
                No latency data yet
              </div>
            )}
          </div>
        </motion.div>

        {/* Error rate over time */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold mb-1">Error Rate</h2>
          <p className="text-xs text-muted-foreground mb-5">Success vs failed runs per day</p>
          <div className="h-[240px]">
            {errorData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={errorData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="successGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dy={6} />
                  <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dx={-4} />
                  <Tooltip content={<ErrorTooltip />} />
                  <Legend iconType="circle" iconSize={7} wrapperStyle={{ paddingTop: 10, fontSize: 11 }} />
                  <Area type="monotone" dataKey="success" name="Success" stroke="#10b981" fill="url(#successGrad)" strokeWidth={2} />
                  <Area type="monotone" dataKey="failed"  name="Failed"  stroke="#ef4444" fill="url(#failGrad)"    strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground/40 text-sm">
                No error data yet
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Agent performance table + Top errors */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Agent performance */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 glass-card rounded-xl border border-border/50 p-6"
        >
          <div className="flex items-center gap-2 mb-1">
            <Bot className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-base font-semibold">Agent Performance</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Latency, success rate, and token usage per agent</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border/50 text-muted-foreground">
                  <th className="text-left pb-3 pr-3 font-medium">Agent</th>
                  <th className="text-right pb-3 px-3 font-medium">Runs</th>
                  <th className="text-right pb-3 px-3 font-medium">Success</th>
                  <th className="text-right pb-3 px-3 font-medium">Avg Latency</th>
                  <th className="text-right pb-3 px-3 font-medium">p95</th>
                  <th className="text-right pb-3 pl-3 font-medium">Avg Tokens</th>
                </tr>
              </thead>
              <tbody>
                {(data?.agentPerf ?? []).length > 0 ? data!.agentPerf.map((row, i) => {
                  const rate = row.total_runs > 0
                    ? Math.round((row.completed / row.total_runs) * 100)
                    : 100;
                  return (
                    <motion.tr
                      key={row.agent}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="py-2.5 pr-3 font-medium">{row.agent || 'unknown'}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{row.total_runs}</td>
                      <td className={cn('py-2.5 px-3 text-right tabular-nums font-semibold', successColor(rate))}>{rate}%</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{fmtMs(row.avg_latency_ms)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-muted-foreground">{fmtMs(row.p95_latency_ms)}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums text-muted-foreground">{(row.avg_tokens ?? 0).toLocaleString()}</td>
                    </motion.tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground/40">
                      No agent data yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Top errors */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <h2 className="text-base font-semibold">Top Errors</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">Most frequent failures (last 7 days)</p>
          <div className="space-y-3">
            {(data?.topErrors ?? []).length > 0 ? data!.topErrors.map((e, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs text-foreground truncate flex-1">{e.error_message}</p>
                  <span className="shrink-0 text-[10px] font-bold bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">
                    ×{e.count}
                  </span>
                </div>
                <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-red-500/50"
                    style={{
                      width: `${Math.min(100, (e.count / (data!.topErrors[0]?.count || 1)) * 100)}%`,
                    }}
                  />
                </div>
              </motion.div>
            )) : (
              <div className="py-6 text-center text-muted-foreground/40 text-sm">
                <Zap className="w-6 h-6 mx-auto mb-1 opacity-30" />
                No errors in last 7 days
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
