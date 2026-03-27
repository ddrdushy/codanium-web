'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { fetchProject, fetchCards, fetchAgents, fetchDecisions } from '@/lib/api';
import { useProjectActivity } from '@/lib/hooks/use-project-activity';
import { useProjectStream } from '@/lib/hooks/use-project-stream';

import type { Project, Card, Agent, Decision } from '@/types';
import { Badge } from '@/components/ui/badge';
import { MetricSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  Kanban, Scale, Bot, GitBranch, BarChart3,
  ArrowRight, CheckCircle2, Clock, AlertTriangle,
  Zap, TrendingUp, Radio, CreditCard,
} from 'lucide-react';

function getStatCards(projectId: string, cards: Card[], agents: Agent[], decisions: Decision[]) {
  const inProgressCount = cards.filter(c => c.state === 'In Progress').length;
  const activeAgentCount = agents.filter(a => a.status === 'working').length;
  const pendingCount = decisions.filter(d => d.status === 'Awaiting Approval').length;
  const blockedCount = cards.filter(c => c.state === 'Blocked').length;

  return [
    {
      label: 'Total Tasks',
      value: String(cards.length),
      sub: `${inProgressCount} in progress`,
      icon: Kanban,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10 border-blue-500/20',
      href: `/project/${projectId}/board`,
    },
    {
      label: 'AI Team Active',
      value: String(activeAgentCount),
      sub: `of ${agents.length} specialists`,
      icon: Bot,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      href: `/project/${projectId}/agents`,
    },
    {
      label: 'Needs Your Approval',
      value: String(pendingCount),
      sub: 'waiting for you',
      icon: Scale,
      color: 'text-amber',
      bg: 'bg-amber/10 border-amber/20',
      href: `/project/${projectId}/decisions`,
    },
    {
      label: 'Items Needing Attention',
      value: String(blockedCount),
      sub: 'need attention',
      icon: AlertTriangle,
      color: 'text-red-400',
      bg: 'bg-red-500/10 border-red-500/20',
      href: `/project/${projectId}/board`,
    },
  ];
}

interface SDLCStage {
  name: string;
  status: string;
  gate_passed: boolean;
}

export default function ProjectDashboard() {
  const params = useParams();
  const projectId = params.id as string;

  const [project, setProject] = useState<Project | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [sdlcStages, setSdlcStages] = useState<SDLCStage[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live SSE streams
  const { events: activityEvents, connected: activityConnected } = useProjectActivity(projectId);
  const { isBackgroundStreaming, backgroundAgent } = useProjectStream(projectId);

  // Credit wallet warning
  const [creditWarning, setCreditWarning] = useState<'warn' | 'critical' | null>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  useEffect(() => {
    fetch('/api/account/credits')
      .then(r => r.json())
      .then(data => {
        setCreditWarning(data.warningLevel ?? null);
        setCreditBalance(data.balance ?? null);
      })
      .catch(() => {});
  }, []);

  const refreshCards = useCallback(() => {
    fetchCards(projectId).then(setCards).catch(() => {});
  }, [projectId]);

  const refreshAgents = useCallback(() => {
    fetchAgents(projectId).then(setAgents).catch(() => {});
  }, [projectId]);

  const refreshDecisions = useCallback(() => {
    fetchDecisions(projectId).then(setDecisions).catch(() => {});
  }, [projectId]);

  // Refresh relevant data when live events arrive — debounced 1s to batch rapid events
  useEffect(() => {
    if (activityEvents.length === 0) return;
    const latest = activityEvents[0];

    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      if (latest.category === 'task_update') refreshCards();
      if (latest.category === 'agent_status') refreshAgents();
      if (latest.category === 'task_update' || latest.category === 'member_activity') refreshDecisions();
    }, 1000);

    return () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [activityEvents, refreshCards, refreshAgents, refreshDecisions]);

  useEffect(() => {
    Promise.all([
      fetchProject(projectId).then((p) => { if (p) setProject(p); }),
      fetchCards(projectId).then(setCards).catch(() => {}),
      fetchAgents(projectId).then(setAgents).catch(() => {}),
      fetchDecisions(projectId).then(setDecisions).catch(() => {}),
      fetch(`/api/projects/${projectId}/sdlc`)
        .then(r => r.json())
        .then((data: any[]) => setSdlcStages(data.map(s => ({
          name: s.name,
          status: s.status.toLowerCase(),
          gate_passed: s.gatePassed,
        }))))
        .catch(() => {}),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [projectId]);

  const activeAgents = agents.filter(a => a.status === 'working');
  const completedStages = sdlcStages.filter(s => s.status === 'completed').length;
  const activeStage = sdlcStages.find(s => s.status === 'active');

  if (!project) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="animate-pulse space-y-3">
          <div className="h-8 w-64 rounded bg-white/[0.06]" />
          <div className="h-4 w-96 rounded bg-white/[0.06]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
          </div>
          <div className={cn(
            'flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border shrink-0',
            activityConnected
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-white/[0.04] border-white/10 text-muted-foreground/50'
          )}>
            <Radio className={cn('w-3 h-3', activityConnected && 'animate-pulse')} />
            {activityConnected ? 'Live' : 'Offline'}
          </div>
        </div>
      </motion.div>

      {/* Background Agent Banner */}
      {isBackgroundStreaming && backgroundAgent && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          className="rounded-xl border border-amber/20 bg-amber/5 px-4 py-3 flex items-center gap-3"
        >
          <Bot className="w-5 h-5 text-amber" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber">{backgroundAgent.name} is working</p>
            <p className="text-[11px] text-muted-foreground">Generating output in the background…</p>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-amber">
            <Zap className="w-3 h-3 animate-pulse" />
            Streaming
          </div>
        </motion.div>
      )}

      {/* Credit Warning Banners */}
      {creditWarning === 'critical' && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 flex items-center gap-3"
        >
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-red-400">No credits remaining — AI agents are paused</p>
            <p className="text-[11px] text-muted-foreground">Top up your balance or configure your own API key to continue.</p>
          </div>
          <a
            href="/account/billing"
            className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-red-400 hover:underline"
          >
            <CreditCard className="w-3.5 h-3.5" /> Top Up
          </a>
        </motion.div>
      )}
      {creditWarning === 'warn' && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber/20 bg-amber/5 px-4 py-3 flex items-center gap-3"
        >
          <AlertTriangle className="w-4 h-4 text-amber shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-amber">Credits running low — ${creditBalance?.toFixed(2)} remaining</p>
            <p className="text-[11px] text-muted-foreground">Top up soon to keep your AI team working uninterrupted.</p>
          </div>
          <a
            href="/account/billing"
            className="shrink-0 flex items-center gap-1 text-[11px] font-semibold text-amber hover:underline"
          >
            <CreditCard className="w-3.5 h-3.5" /> Top Up
          </a>
        </motion.div>
      )}

      {/* SDLC Progress */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="rounded-xl border border-border bg-[var(--surface)] p-4"
      >
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-4 h-4 text-amber" />
          <h2 className="text-sm font-semibold">Delivery Progress</h2>
          <Badge className="bg-amber/15 text-amber border-amber/20 text-[10px]">
            {activeStage ? activeStage.name : `${completedStages} of ${sdlcStages.length} complete`}
          </Badge>
        </div>
        {sdlcStages.length > 0 ? (
          <div className="flex items-center gap-1">
            {sdlcStages.map((stage) => (
              <div key={stage.name} className="flex-1 flex items-center gap-1">
                <div className="flex-1 flex flex-col items-center gap-1.5">
                  <div
                    className={cn(
                      'w-full h-2 rounded-full transition-all',
                      stage.status === 'completed' && 'bg-emerald-500',
                      stage.status === 'active' && 'bg-amber',
                      stage.status === 'pending' && 'bg-white/[0.06]',
                      stage.status === 'blocked' && 'bg-red-500',
                    )}
                  />
                  <span className={cn(
                    'text-[9px] font-medium whitespace-nowrap',
                    stage.status === 'completed' && 'text-emerald-400',
                    stage.status === 'active' && 'text-amber',
                    stage.status === 'pending' && 'text-muted-foreground/40',
                  )}>
                    {stage.name}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex-1 h-2 rounded-full bg-white/[0.06] animate-pulse" />
            ))}
          </div>
        )}
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {getStatCards(projectId, cards, agents, decisions).map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.05, duration: 0.3 }}
            >
              <Link
                href={stat.href}
                className={cn(
                  'block rounded-xl border p-4 transition-all hover:border-white/10 card-lift',
                  stat.bg
                )}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
                    <p className={cn('text-2xl font-bold mt-1', stat.color)}>{stat.value}</p>
                    <p className="text-[11px] text-muted-foreground/60 mt-0.5">{stat.sub}</p>
                  </div>
                  <Icon className={cn('w-5 h-5', stat.color, 'opacity-60')} />
                </div>
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* Recent Activity Feed */}
      {activityEvents.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
            <h3 className="text-sm font-semibold">Live Activity</h3>
            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">
              {activityEvents.length} events
            </Badge>
          </div>
          <div className="space-y-1.5 max-h-40 overflow-y-auto">
            {activityEvents.slice(0, 8).map((evt, i) => (
              <div key={i} className="flex items-start gap-2.5 text-[11px]">
                <span className={cn(
                  'mt-1 w-1.5 h-1.5 rounded-full shrink-0',
                  evt.category === 'task_update' && 'bg-blue-400',
                  evt.category === 'agent_status' && 'bg-emerald-400',
                  evt.category === 'member_activity' && 'bg-amber',
                  !evt.category && 'bg-white/20',
                )} />
                <span className="text-muted-foreground/70 shrink-0">{new Date(evt.timestamp ?? Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-muted-foreground truncate"><span className="text-white/60">{evt.actor}</span> — {String(evt.payload?.message ?? evt.type).replace(/_/g, ' ')}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Two-column: Active Agents + Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Active Agents */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.3 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Bot className="w-4 h-4 text-emerald-400" />
              AI Team at Work
            </h3>
            <Link href={`/project/${projectId}/agents`} className="text-[11px] text-amber hover:underline flex items-center gap-0.5">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {activeAgents.map(agent => (
              <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                <span className="text-lg">{agent.avatar}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">{agent.name}</span>
                    <Badge variant="outline" className="text-[9px] h-4 px-1 bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                      working
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{agent.currentTask}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Quick Links / Recent Decisions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Scale className="w-4 h-4 text-amber" />
              Recent Decisions
            </h3>
            <Link href={`/project/${projectId}/decisions`} className="text-[11px] text-amber hover:underline flex items-center gap-0.5">
              View all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {decisions.map(dec => (
              <div key={dec.decision_id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/[0.02] transition-colors">
                <div className={cn(
                  'mt-0.5 w-2 h-2 rounded-full shrink-0',
                  dec.status === 'Awaiting Approval' && 'bg-amber pulse-dot',
                  dec.status === 'Implemented' && 'bg-emerald-500',
                  dec.status === 'Verified' && 'bg-blue-500',
                )} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground/50">{dec.decision_id}</span>
                    <Badge variant="outline" className={cn(
                      'text-[9px] h-4 px-1',
                      dec.status === 'Awaiting Approval' && 'bg-amber/10 text-amber border-amber/20',
                      dec.status === 'Implemented' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      dec.status === 'Verified' && 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    )}>
                      {dec.status}
                    </Badge>
                  </div>
                  <p className="text-xs font-medium mt-0.5">{dec.trigger}</p>
                  <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{dec.recommendation}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
