'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { fetchProject, fetchCards, fetchAgents, fetchDecisions } from '@/lib/api';
import { mockProject, mockCards, mockAgents, mockDecisions } from '@/lib/mock-data';
import type { Project, Card, Agent, Decision } from '@/types';
import { Badge } from '@/components/ui/badge';
import { MetricSkeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import {
  Kanban, Scale, Bot, GitBranch, BarChart3,
  ArrowRight, CheckCircle2, Clock, AlertTriangle,
  Zap, TrendingUp
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

  const [project, setProject] = useState<Project>(mockProject);
  const [cards, setCards] = useState<Card[]>(mockCards);
  const [agents, setAgents] = useState<Agent[]>(mockAgents);
  const [decisions, setDecisions] = useState<Decision[]>(mockDecisions);
  const [sdlcStages, setSdlcStages] = useState<SDLCStage[]>([]);
  const [loading, setLoading] = useState(true);

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
      .catch(() => {/* keep mock data */})
      .finally(() => setLoading(false));
  }, [projectId]);

  const activeAgents = agents.filter(a => a.status === 'working');
  const completedStages = sdlcStages.filter(s => s.status === 'completed').length;
  const activeStage = sdlcStages.find(s => s.status === 'active');

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold tracking-tight">{project.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
      </motion.div>

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
