'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  BarChart3, TrendingUp, TrendingDown, Clock, Zap,
  DollarSign, CheckCircle2, AlertTriangle, Bot, Scale,
  GitPullRequest, ShieldCheck, Activity, Target
} from 'lucide-react';

interface KPIMetric {
  label: string;
  value: string;
  change: string;
  trend: 'up' | 'down' | 'neutral';
  icon: React.ElementType;
  color: string;
  bg: string;
}

const heroMetrics: KPIMetric[] = [
  { label: 'Cycle Time', value: '4.2d', change: '-18%', trend: 'up', icon: Clock, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  { label: 'Throughput', value: '12/wk', change: '+24%', trend: 'up', icon: Zap, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
  { label: 'LLM Costs', value: '$79.97', change: '+8%', trend: 'down', icon: DollarSign, color: 'text-amber', bg: 'bg-amber/10 border-amber/20' },
  { label: 'Quality Score', value: '94%', change: '+3%', trend: 'up', icon: ShieldCheck, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
];

const deliveryMetrics = [
  { label: 'Cards Created', value: '47', period: 'total' },
  { label: 'Cards Completed', value: '18', period: 'total' },
  { label: 'Cards In Progress', value: '8', period: 'now' },
  { label: 'Blocked Items', value: '2', period: 'now', alert: true },
  { label: 'Avg Resolution Time', value: '2.8d', period: 'avg' },
  { label: 'Defect Escape Rate', value: '2.1%', period: 'avg' },
];

const agentMetrics = [
  { agent: '🎯 Orchestrator', tasks: 142, avgTime: '0.3s', accuracy: '99.2%' },
  { agent: '💻 Junior Dev', tasks: 38, avgTime: '4.2h', accuracy: '91.5%' },
  { agent: '🔍 Senior Dev', tasks: 24, avgTime: '1.8h', accuracy: '97.8%' },
  { agent: '🧪 QA Engineer', tasks: 31, avgTime: '2.1h', accuracy: '95.3%' },
  { agent: '🏗️ Sol. Architect', tasks: 15, avgTime: '3.5h', accuracy: '98.1%' },
  { agent: '👑 Tech Lead', tasks: 22, avgTime: '1.2h', accuracy: '96.9%' },
];

const costBreakdown = [
  { category: 'Code Generation', cost: 32.15, tokens: '1.8M', provider: 'Anthropic' },
  { category: 'Code Review', cost: 18.40, tokens: '920K', provider: 'Anthropic' },
  { category: 'Architecture', cost: 12.82, tokens: '640K', provider: 'OpenAI' },
  { category: 'Testing', cost: 8.20, tokens: '410K', provider: 'OpenAI' },
  { category: 'Documentation', cost: 5.40, tokens: '890K', provider: 'Ollama' },
  { category: 'Orchestration', cost: 3.00, tokens: '150K', provider: 'OpenAI' },
];

// Simple bar visualization
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percent = (value / max) * 100;
  return (
    <div className="w-24 h-2 rounded-full bg-white/[0.06] overflow-hidden">
      <div className={cn('h-full rounded-full', color)} style={{ width: `${percent}%` }} />
    </div>
  );
}

// Sparkline-style activity chart (7 days)
function WeeklyChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  return (
    <div className="flex items-end gap-0.5 h-8">
      {data.map((val, i) => (
        <div
          key={i}
          className={cn('w-3 rounded-sm transition-all', color)}
          style={{
            height: `${(val / max) * 100}%`,
            opacity: 0.3 + (val / max) * 0.7,
          }}
        />
      ))}
    </div>
  );
}

export default function KPIPage() {
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
            KPI Dashboard
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Delivery metrics, agent performance, and cost analytics</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-[10px] bg-white/[0.04]">Last 30 days</Badge>
          <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
            <Activity className="w-2.5 h-2.5 mr-0.5" /> Live
          </Badge>
        </div>
      </motion.div>

      {/* Hero Metrics */}
      <div className="grid grid-cols-4 gap-3">
        {heroMetrics.map((metric, i) => {
          const Icon = metric.icon;
          const TrendIcon = metric.trend === 'up' ? TrendingUp : TrendingDown;
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
                  <div className="flex items-center gap-1 mt-1">
                    <TrendIcon className={cn(
                      'w-3 h-3',
                      metric.trend === 'up' ? 'text-emerald-400' : 'text-red-400'
                    )} />
                    <span className={cn(
                      'text-[11px] font-medium',
                      metric.trend === 'up' ? 'text-emerald-400' : 'text-red-400'
                    )}>
                      {metric.change}
                    </span>
                    <span className="text-[10px] text-muted-foreground/30">vs last month</span>
                  </div>
                </div>
                <Icon className={cn('w-5 h-5 opacity-40', metric.color)} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-2 gap-4">
        {/* Delivery Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              Delivery Metrics
            </h3>
            <WeeklyChart
              data={[3, 5, 4, 7, 6, 8, 5]}
              color="bg-blue-500"
            />
          </div>
          <div className="space-y-3">
            {deliveryMetrics.map((m, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  {m.alert && <AlertTriangle className="w-3 h-3 text-red-400" />}
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm font-semibold',
                    m.alert ? 'text-red-400' : 'text-foreground'
                  )}>
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

        {/* Decision Metrics */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-4"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber" />
              Decision & Governance
            </h3>
            <WeeklyChart
              data={[1, 0, 2, 1, 0, 1, 0]}
              color="bg-amber"
            />
          </div>
          <div className="space-y-3">
            {[
              { label: 'Decisions Made', value: '12', sub: 'total' },
              { label: 'Avg Decision Time', value: '3.2h', sub: 'avg' },
              { label: 'Pending Decisions', value: '1', sub: 'now', alert: true },
              { label: 'Approval Rate', value: '92%', sub: 'avg' },
              { label: 'Quality Gates Passed', value: '4/4', sub: 'current stage' },
              { label: 'Audit Compliance', value: '100%', sub: 'all stages' },
            ].map((m, i) => (
              <div key={i} className="flex items-center justify-between py-1.5 border-b border-border last:border-0">
                <div className="flex items-center gap-2">
                  {m.alert && <Clock className="w-3 h-3 text-amber" />}
                  <span className="text-xs text-muted-foreground">{m.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={cn(
                    'text-sm font-semibold',
                    m.alert ? 'text-amber' : 'text-foreground'
                  )}>
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
        {/* Agent Performance */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-4"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4 text-emerald-400" />
            Agent Performance
          </h3>
          <div className="space-y-0">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2 border-b border-border text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold">
              <span className="w-36">Agent</span>
              <span className="w-14 text-right">Tasks</span>
              <span className="w-14 text-right">Avg Time</span>
              <span className="w-14 text-right">Accuracy</span>
              <span className="flex-1" />
            </div>
            {agentMetrics.map((agent, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <span className="text-xs w-36 truncate">{agent.agent}</span>
                <span className="text-xs font-semibold w-14 text-right">{agent.tasks}</span>
                <span className="text-xs text-muted-foreground w-14 text-right">{agent.avgTime}</span>
                <span className={cn(
                  'text-xs font-semibold w-14 text-right',
                  parseFloat(agent.accuracy) >= 97 ? 'text-emerald-400' :
                  parseFloat(agent.accuracy) >= 95 ? 'text-blue-400' : 'text-amber'
                )}>
                  {agent.accuracy}
                </span>
                <div className="flex-1">
                  <MiniBar
                    value={agent.tasks}
                    max={142}
                    color={
                      parseFloat(agent.accuracy) >= 97 ? 'bg-emerald-500' :
                      parseFloat(agent.accuracy) >= 95 ? 'bg-blue-500' : 'bg-amber'
                    }
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Cost Breakdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-4"
        >
          <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-amber" />
            Cost Breakdown
          </h3>
          <div className="space-y-0">
            {/* Header */}
            <div className="flex items-center gap-3 pb-2 border-b border-border text-[9px] text-muted-foreground/40 uppercase tracking-wider font-semibold">
              <span className="w-32">Category</span>
              <span className="w-14 text-right">Cost</span>
              <span className="w-14 text-right">Tokens</span>
              <span className="w-20 text-right">Provider</span>
              <span className="flex-1" />
            </div>
            {costBreakdown.map((item, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border last:border-0">
                <span className="text-xs w-32 truncate">{item.category}</span>
                <span className="text-xs font-semibold text-amber w-14 text-right">${item.cost.toFixed(2)}</span>
                <span className="text-xs text-muted-foreground w-14 text-right font-mono">{item.tokens}</span>
                <span className="text-[10px] text-muted-foreground/50 w-20 text-right">{item.provider}</span>
                <div className="flex-1">
                  <MiniBar
                    value={item.cost}
                    max={32.15}
                    color={item.cost > 20 ? 'bg-amber' : item.cost > 10 ? 'bg-blue-500' : 'bg-emerald-500'}
                  />
                </div>
              </div>
            ))}
            <div className="flex items-center justify-between pt-3 mt-1">
              <span className="text-xs font-semibold">Total</span>
              <span className="text-sm font-bold text-amber">
                ${costBreakdown.reduce((a, c) => a + c.cost, 0).toFixed(2)}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* SDLC Stage Performance */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-xl border border-border bg-[var(--surface)] p-4"
      >
        <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <GitPullRequest className="w-4 h-4 text-violet-400" />
          Stage Performance
        </h3>
        <div className="flex gap-2">
          {[
            { stage: 'BA', time: '2d', quality: 98 },
            { stage: 'Arch', time: '3d', quality: 96 },
            { stage: 'UI/UX', time: '4d', quality: 94 },
            { stage: 'Plan', time: '1d', quality: 100 },
            { stage: 'Dev', time: '8d', quality: 91 },
            { stage: 'Review', time: '2d', quality: 97 },
            { stage: 'Test', time: '3d', quality: 95 },
            { stage: 'Release', time: '—', quality: 0 },
            { stage: 'Monitor', time: '—', quality: 0 },
            { stage: 'Iterate', time: '—', quality: 0 },
          ].map((s, i) => {
            const isActive = i >= 4 && i <= 6;
            const isComplete = i < 4;
            const isPending = i > 6;
            return (
              <div
                key={s.stage}
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
                  {s.stage}
                </p>
                <p className={cn(
                  'text-lg font-bold mt-1',
                  isComplete && 'text-emerald-400',
                  isActive && 'text-amber',
                  isPending && 'text-muted-foreground/15',
                )}>
                  {s.time}
                </p>
                {s.quality > 0 && (
                  <div className="mt-1.5">
                    <div className="h-1 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          s.quality >= 96 ? 'bg-emerald-500' : s.quality >= 94 ? 'bg-blue-500' : 'bg-amber'
                        )}
                        style={{ width: `${s.quality}%` }}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground/40 mt-0.5">{s.quality}%</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
