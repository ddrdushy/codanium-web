'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LayoutDashboard, KanbanSquare, Workflow, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

const tabs = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'board', label: 'Board', icon: KanbanSquare },
  { id: 'pipeline', label: 'Pipeline', icon: Workflow },
  { id: 'agents', label: 'Agents', icon: Bot },
] as const;

type TabId = (typeof tabs)[number]['id'];

/* ─── Dashboard Mockup ─── */
function DashboardMockup() {
  const stats = [
    { label: 'Cards', value: '47', color: 'text-blue-400' },
    { label: 'Agents', value: '8', color: 'text-emerald-400' },
    { label: 'Decisions', value: '1', color: 'text-purple-400' },
    { label: 'Progress', value: '48%', color: 'text-amber-400' },
  ];

  const agents = [
    { name: 'Business Analyst', status: 'Working', color: 'bg-emerald-400' },
    { name: 'System Architect', status: 'Reviewing', color: 'bg-blue-400' },
    { name: 'Frontend Dev', status: 'Idle', color: 'bg-zinc-500' },
  ];

  const decisions = [
    { title: 'Database Selection', status: 'Pending', color: 'text-amber-400 bg-amber-400/10' },
    { title: 'Auth Strategy', status: 'Approved', color: 'text-emerald-400 bg-emerald-400/10' },
  ];

  return (
    <div className="p-4 space-y-3">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-[var(--surface-raised)] p-2.5 text-center">
            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[9px] text-muted-foreground mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* SDLC Progress */}
      <div className="rounded-lg border border-border bg-[var(--surface-raised)] p-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-medium text-muted-foreground">SDLC Progress</span>
          <span className="text-[9px] text-amber font-semibold">Stage 5/10</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-[var(--surface-overlay)]">
          <div className="h-1.5 w-[48%] rounded-full bg-gradient-to-r from-amber-500 to-orange-500" />
        </div>
        <div className="flex justify-between mt-1">
          {['BA', 'SA', 'UX', 'FE', 'BE', 'DB', 'QA', 'SEC', 'DEP', 'MON'].map((stage, idx) => (
            <span
              key={stage}
              className={cn(
                'text-[7px]',
                idx < 5 ? 'text-emerald-400' : idx === 5 ? 'text-amber-400 font-bold' : 'text-muted-foreground/50'
              )}
            >
              {stage}
            </span>
          ))}
        </div>
      </div>

      {/* Two panels */}
      <div className="grid grid-cols-2 gap-2">
        {/* Active Agents */}
        <div className="rounded-lg border border-border bg-[var(--surface-raised)] p-3">
          <span className="text-[9px] font-medium text-muted-foreground mb-2 block">Active Agents</span>
          <div className="space-y-1.5">
            {agents.map((a) => (
              <div key={a.name} className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${a.color}`} />
                <span className="text-[9px] text-foreground truncate flex-1">{a.name}</span>
                <span className="text-[8px] text-muted-foreground">{a.status}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Decisions */}
        <div className="rounded-lg border border-border bg-[var(--surface-raised)] p-3">
          <span className="text-[9px] font-medium text-muted-foreground mb-2 block">Recent Decisions</span>
          <div className="space-y-1.5">
            {decisions.map((d) => (
              <div key={d.title} className="flex items-center justify-between">
                <span className="text-[9px] text-foreground">{d.title}</span>
                <span className={`text-[7px] font-medium px-1.5 py-0.5 rounded ${d.color}`}>{d.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Board Mockup ─── */
function BoardMockup() {
  const columns = [
    { name: 'Backlog', color: 'border-zinc-600', cards: ['User stories', 'API spec'] },
    { name: 'Todo', color: 'border-blue-500', cards: ['Auth flow', 'DB schema'] },
    { name: 'In Progress', color: 'border-amber-500', cards: ['Dashboard UI', 'REST API'] },
    { name: 'Review', color: 'border-purple-500', cards: ['Login page'] },
    { name: 'Testing', color: 'border-cyan-500', cards: ['Unit tests', 'E2E tests'] },
    { name: 'Done', color: 'border-emerald-500', cards: ['Setup', 'CI/CD', 'Wireframes'] },
    { name: 'Archived', color: 'border-zinc-700', cards: ['Old spec'] },
  ];

  return (
    <div className="p-4 overflow-x-auto">
      <div className="flex gap-2 min-w-[700px]">
        {columns.map((col) => (
          <div
            key={col.name}
            className={`flex-1 rounded-lg border-t-2 ${col.color} bg-[var(--surface-raised)] p-2`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[8px] font-semibold text-foreground">{col.name}</span>
              <span className="text-[7px] text-muted-foreground">{col.cards.length}</span>
            </div>
            <div className="space-y-1">
              {col.cards.map((card) => (
                <div
                  key={card}
                  className="rounded border border-border bg-[var(--surface)] px-2 py-1.5 text-[8px] text-foreground"
                >
                  {card}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Pipeline Mockup ─── */
function PipelineMockup() {
  const stages = [
    'Business Analysis',
    'System Architecture',
    'UX Design',
    'Frontend Dev',
    'Backend Dev',
    'Database',
    'QA Testing',
    'Security',
    'Deployment',
    'Monitoring',
  ];

  return (
    <div className="p-4">
      <div className="flex items-center gap-1">
        {stages.map((stage, idx) => {
          const isComplete = idx < 5;
          const isActive = idx === 5;
          const isPending = idx > 5;

          return (
            <div key={stage} className="flex-1 flex flex-col items-center">
              <div
                className={cn(
                  'w-full h-6 rounded-sm flex items-center justify-center text-[7px] font-semibold transition-colors',
                  isComplete && 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
                  isActive && 'bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse',
                  isPending && 'bg-[var(--surface-overlay)] text-muted-foreground/50 border border-border'
                )}
              >
                {idx + 1}
              </div>
              <span
                className={cn(
                  'text-[6px] mt-1 text-center leading-tight',
                  isComplete && 'text-emerald-400',
                  isActive && 'text-amber-400 font-bold',
                  isPending && 'text-muted-foreground/40'
                )}
              >
                {stage}
              </span>
            </div>
          );
        })}
      </div>
      {/* Progress bar */}
      <div className="mt-4 h-1.5 w-full rounded-full bg-[var(--surface-overlay)]">
        <div className="h-1.5 w-[55%] rounded-full bg-gradient-to-r from-emerald-500 via-amber-500 to-amber-500" />
      </div>
      <div className="mt-2 flex items-center justify-between text-[8px] text-muted-foreground">
        <span>5 of 10 stages complete</span>
        <span className="text-amber font-semibold">Database — Active</span>
      </div>
    </div>
  );
}

/* ─── Agents Mockup ─── */
function AgentsMockup() {
  const agents = [
    { name: 'Business Analyst', role: 'BA', status: 'Active', color: 'bg-emerald-400' },
    { name: 'System Architect', role: 'SA', status: 'Active', color: 'bg-blue-400' },
    { name: 'UX Designer', role: 'UX', status: 'Idle', color: 'bg-zinc-500' },
    { name: 'Frontend Dev', role: 'FE', status: 'Active', color: 'bg-purple-400' },
    { name: 'QA Engineer', role: 'QA', status: 'Standby', color: 'bg-amber-400' },
  ];

  const selectedAgent = agents[0];

  return (
    <div className="p-4 grid grid-cols-5 gap-3">
      {/* Agent list */}
      <div className="col-span-2 space-y-1">
        <span className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
          Agent Roster
        </span>
        {agents.map((a, idx) => (
          <div
            key={a.name}
            className={cn(
              'flex items-center gap-2 rounded-lg px-2 py-1.5 text-[9px] cursor-pointer transition-colors',
              idx === 0
                ? 'bg-amber/10 border border-amber/20 text-foreground'
                : 'text-muted-foreground hover:bg-[var(--surface-overlay)]'
            )}
          >
            <div className={`h-5 w-5 rounded-full ${a.color} flex items-center justify-center text-[7px] font-bold text-white`}>
              {a.role}
            </div>
            <div className="flex-1 truncate">{a.name}</div>
            <div className={`h-1.5 w-1.5 rounded-full ${a.color}`} />
          </div>
        ))}
      </div>

      {/* Agent detail */}
      <div className="col-span-3 rounded-lg border border-border bg-[var(--surface-raised)] p-3">
        <div className="flex items-center gap-2 mb-3">
          <div className={`h-8 w-8 rounded-full ${selectedAgent.color} flex items-center justify-center text-[10px] font-bold text-white`}>
            {selectedAgent.role}
          </div>
          <div>
            <div className="text-[10px] font-bold text-foreground">{selectedAgent.name}</div>
            <div className="text-[8px] text-emerald-400">Active</div>
          </div>
        </div>
        <div className="space-y-2">
          <div className="rounded border border-border bg-[var(--surface)] p-2">
            <span className="text-[7px] text-muted-foreground">Current Task</span>
            <div className="text-[9px] text-foreground mt-0.5">Writing Business Requirements Document</div>
          </div>
          <div className="rounded border border-border bg-[var(--surface)] p-2">
            <span className="text-[7px] text-muted-foreground">Skills</span>
            <div className="flex flex-wrap gap-1 mt-1">
              {['Requirements', 'Analysis', 'Documentation', 'Stakeholder Mgmt'].map((s) => (
                <span key={s} className="text-[7px] px-1.5 py-0.5 rounded bg-amber/10 text-amber border border-amber/20">
                  {s}
                </span>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div className="rounded border border-border bg-[var(--surface)] p-1.5 text-center">
              <div className="text-[10px] font-bold text-foreground">12</div>
              <div className="text-[7px] text-muted-foreground">Tasks Done</div>
            </div>
            <div className="rounded border border-border bg-[var(--surface)] p-1.5 text-center">
              <div className="text-[10px] font-bold text-foreground">98%</div>
              <div className="text-[7px] text-muted-foreground">Quality</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Tab Content Map ─── */
const tabContent: Record<TabId, React.ComponentType> = {
  dashboard: DashboardMockup,
  board: BoardMockup,
  pipeline: PipelineMockup,
  agents: AgentsMockup,
};

export function ScreenshotsSection() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const ActiveContent = tabContent[activeTab];

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-7xl px-6">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center mb-14"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-amber">
            Product Preview
          </span>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            See It In Action
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Explore the platform that 23 AI agents call home.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all',
                activeTab === tab.id
                  ? 'bg-amber/10 text-amber border border-amber/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[var(--surface-raised)]'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Mockup container */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-4xl"
        >
          <div className="animate-float-slow rounded-2xl border border-border bg-[var(--surface)] overflow-hidden shadow-2xl">
            {/* Window chrome */}
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5 bg-[var(--surface-raised)]">
              <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-amber-500/60" />
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500/60" />
              <div className="ml-4 flex-1 rounded bg-[var(--surface-overlay)] px-3 py-1 text-center text-[9px] text-muted-foreground">
                app.aiteamstudio.com/{activeTab}
              </div>
            </div>

            {/* Content */}
            <div className="min-h-[320px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  <ActiveContent />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* Glow */}
          <div className="absolute inset-x-0 -z-10 mx-auto h-64 w-3/4 -translate-y-32 rounded-full bg-amber/5 blur-3xl" />
        </motion.div>
      </div>
    </section>
  );
}
