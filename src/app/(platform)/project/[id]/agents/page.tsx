'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { mockAgents, mockCards } from '@/lib/mock-data';
import { Agent, AgentGroup, AgentStatus } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot, Activity, Cpu, Shield, Code2, Cloud, BrainCircuit,
  Circle, ChevronRight, Zap, Clock, Pause, AlertTriangle,
  Eye, BarChart3, GitPullRequest, FileText, Terminal
} from 'lucide-react';

const groupConfig: Record<AgentGroup, {
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  border: string;
}> = {
  governance: {
    label: 'Governance',
    description: 'Orchestration, state management, decisions, audit & security',
    icon: Shield,
    color: 'text-amber',
    bg: 'bg-amber/10',
    border: 'border-amber/20',
  },
  sdlc: {
    label: 'SDLC',
    description: 'Business analysis, architecture, design, planning & leadership',
    icon: Activity,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  engineering: {
    label: 'Engineering',
    description: 'Development, review, testing, automation & performance',
    icon: Code2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  platform: {
    label: 'Platform',
    description: 'Infrastructure, CI/CD, integrations, secrets & reliability',
    icon: Cloud,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  ai_cost: {
    label: 'AI & Cost',
    description: 'LLM gateway, prompt engineering & cost analytics',
    icon: BrainCircuit,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
  },
};

const statusConfig: Record<AgentStatus, {
  label: string;
  color: string;
  bg: string;
  dotColor: string;
  icon: React.ElementType;
}> = {
  working: {
    label: 'Working',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/15 border-emerald-500/20',
    dotColor: 'bg-emerald-500',
    icon: Zap,
  },
  waiting: {
    label: 'Waiting',
    color: 'text-amber',
    bg: 'bg-amber/15 border-amber/20',
    dotColor: 'bg-amber',
    icon: Clock,
  },
  idle: {
    label: 'Idle',
    color: 'text-zinc-500',
    bg: 'bg-zinc-500/10 border-zinc-500/20',
    dotColor: 'bg-zinc-600',
    icon: Pause,
  },
  blocked: {
    label: 'Blocked',
    color: 'text-red-400',
    bg: 'bg-red-500/15 border-red-500/20',
    dotColor: 'bg-red-500',
    icon: AlertTriangle,
  },
};

// Mock activity events for selected agent
const mockAgentEvents = [
  { time: '2 min ago', action: 'Started working on', target: 'TASK-016', type: 'task' },
  { time: '8 min ago', action: 'Completed review of', target: 'TASK-015', type: 'review' },
  { time: '15 min ago', action: 'Created pull request', target: 'PR #43', type: 'pr' },
  { time: '32 min ago', action: 'Updated artifact', target: 'sdd.md', type: 'artifact' },
  { time: '1h ago', action: 'Ran tests for', target: 'FEAT-006', type: 'test' },
  { time: '1h 20min ago', action: 'Committed code to', target: 'feature/decision-api', type: 'commit' },
];

const eventIcons: Record<string, React.ElementType> = {
  task: Terminal,
  review: Eye,
  pr: GitPullRequest,
  artifact: FileText,
  test: Activity,
  commit: Code2,
};

type FilterMode = 'all' | 'working' | 'idle';

export default function AgentsPage() {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(mockAgents.find(a => a.status === 'working') || null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const groups: AgentGroup[] = ['governance', 'sdlc', 'engineering', 'platform', 'ai_cost'];

  const workingCount = mockAgents.filter(a => a.status === 'working').length;
  const waitingCount = mockAgents.filter(a => a.status === 'waiting').length;
  const idleCount = mockAgents.filter(a => a.status === 'idle').length;

  const filteredAgents = filterMode === 'all'
    ? mockAgents
    : filterMode === 'working'
      ? mockAgents.filter(a => a.status === 'working' || a.status === 'waiting')
      : mockAgents.filter(a => a.status === 'idle');

  // Get cards assigned to selected agent
  const agentCards = selectedAgent
    ? mockCards.filter(c => c.owner_agent === selectedAgent.id)
    : [];

  return (
    <div className="flex h-full">
      {/* Agent List */}
      <div className="w-[420px] border-r border-border flex flex-col shrink-0">
        {/* Header */}
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
              <Bot className="w-5 h-5 text-amber" />
              Agents
            </h1>
            <div className="flex items-center gap-1.5">
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]">
                {workingCount} active
              </Badge>
              {waitingCount > 0 && (
                <Badge className="bg-amber/15 text-amber border-amber/20 text-[10px]">
                  {waitingCount} waiting
                </Badge>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
            {[
              { key: 'all' as FilterMode, label: `All (${mockAgents.length})` },
              { key: 'working' as FilterMode, label: `Active (${workingCount + waitingCount})` },
              { key: 'idle' as FilterMode, label: `Idle (${idleCount})` },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setFilterMode(tab.key)}
                className={cn(
                  'flex-1 text-[11px] font-medium py-1.5 rounded-md transition-all',
                  filterMode === tab.key
                    ? 'bg-white/[0.08] text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Agent Groups */}
        <div className="flex-1 overflow-y-auto">
          {groups.map((groupKey, groupIndex) => {
            const config = groupConfig[groupKey];
            const GroupIcon = config.icon;
            const agentsInGroup = filteredAgents.filter(a => a.group === groupKey);

            if (agentsInGroup.length === 0) return null;

            return (
              <motion.div
                key={groupKey}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: groupIndex * 0.08 }}
              >
                {/* Group Header */}
                <div className={cn(
                  'px-4 py-2 border-b border-border flex items-center gap-2',
                  config.bg
                )}>
                  <GroupIcon className={cn('w-3.5 h-3.5', config.color)} />
                  <span className={cn('text-[11px] font-semibold uppercase tracking-wider', config.color)}>
                    {config.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground/40 ml-auto">
                    {agentsInGroup.filter(a => a.status === 'working').length}/{agentsInGroup.length} active
                  </span>
                </div>

                {/* Agents in Group */}
                {agentsInGroup.map((agent, i) => {
                  const status = statusConfig[agent.status];
                  const StatusIcon = status.icon;
                  const isSelected = selectedAgent?.id === agent.id;

                  return (
                    <motion.button
                      key={agent.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: groupIndex * 0.08 + i * 0.03 }}
                      onClick={() => setSelectedAgent(agent)}
                      className={cn(
                        'w-full text-left px-4 py-3 border-b border-border transition-all',
                        isSelected
                          ? 'bg-amber/[0.06] border-l-2 border-l-amber'
                          : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {/* Avatar */}
                        <div className="relative">
                          <span className="text-xl">{agent.avatar}</span>
                          <div className={cn(
                            'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-background',
                            status.dotColor,
                            agent.status === 'working' && 'pulse-dot'
                          )} />
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{agent.name}</span>
                            <Badge variant="outline" className={cn(
                              'text-[9px] h-4 px-1.5', status.bg, status.color
                            )}>
                              <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                              {status.label}
                            </Badge>
                          </div>
                          {agent.currentTask ? (
                            <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">
                              {agent.currentTask}
                            </p>
                          ) : (
                            <p className="text-[11px] text-muted-foreground/30 mt-0.5 italic">
                              No active task
                            </p>
                          )}
                        </div>

                        {/* Arrow */}
                        <ChevronRight className={cn(
                          'w-3.5 h-3.5 text-muted-foreground/20 transition-all',
                          isSelected && 'text-amber'
                        )} />
                      </div>
                    </motion.button>
                  );
                })}
              </motion.div>
            );
          })}
        </div>

        {/* Footer Stats */}
        <div className="px-4 py-3 border-t border-border bg-white/[0.01]">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground/50">
            <span>{mockAgents.length} total agents</span>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" /> {workingCount}
              </span>
              <span className="flex items-center gap-1">
                <Circle className="w-2 h-2 fill-amber text-amber" /> {waitingCount}
              </span>
              <span className="flex items-center gap-1">
                <Circle className="w-2 h-2 fill-zinc-600 text-zinc-600" /> {idleCount}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Detail */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedAgent ? (
            <motion.div
              key={selectedAgent.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6 max-w-3xl"
            >
              {/* Agent Header */}
              <div className="mb-6">
                <div className="flex items-center gap-4 mb-3">
                  <div className="relative">
                    <div className={cn(
                      'w-14 h-14 rounded-2xl flex items-center justify-center text-3xl',
                      groupConfig[selectedAgent.group].bg,
                      'border',
                      groupConfig[selectedAgent.group].border,
                    )}>
                      {selectedAgent.avatar}
                    </div>
                    <div className={cn(
                      'absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-background flex items-center justify-center',
                      statusConfig[selectedAgent.status].dotColor,
                      selectedAgent.status === 'working' && 'pulse-dot'
                    )} />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">{selectedAgent.name}</h2>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant="outline" className={cn(
                        'text-[10px]',
                        statusConfig[selectedAgent.status].bg,
                        statusConfig[selectedAgent.status].color,
                      )}>
                        {statusConfig[selectedAgent.status].label}
                      </Badge>
                      <Badge variant="outline" className={cn(
                        'text-[10px]',
                        groupConfig[selectedAgent.group].bg,
                        groupConfig[selectedAgent.group].color,
                      )}>
                        {groupConfig[selectedAgent.group].label}
                      </Badge>
                      <span className="text-[10px] font-mono text-muted-foreground/40">
                        {selectedAgent.shortName}
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">
                  {groupConfig[selectedAgent.group].description}
                </p>
              </div>

              {/* Current Task */}
              {selectedAgent.currentTask && (
                <div className={cn(
                  'mb-6 rounded-xl border p-4',
                  selectedAgent.status === 'working'
                    ? 'border-emerald-500/20 bg-emerald-500/[0.04]'
                    : selectedAgent.status === 'waiting'
                      ? 'border-amber/20 bg-amber/[0.04]'
                      : 'border-border bg-[var(--surface)]'
                )}>
                  <div className="flex items-center gap-2 mb-2">
                    <Cpu className={cn(
                      'w-4 h-4',
                      selectedAgent.status === 'working' ? 'text-emerald-400' : 'text-amber'
                    )} />
                    <h3 className="text-sm font-semibold">Current Task</h3>
                    {selectedAgent.status === 'working' && (
                      <div className="ml-auto flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 pulse-dot" />
                        <span className="text-[10px] text-emerald-400">Live</span>
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{selectedAgent.currentTask}</p>
                </div>
              )}

              {/* Assigned Cards */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-blue-400" />
                  Assigned Cards
                  <Badge variant="outline" className="text-[9px] h-4 bg-white/[0.04]">
                    {agentCards.length}
                  </Badge>
                </h3>
                {agentCards.length > 0 ? (
                  <div className="space-y-2">
                    {agentCards.map((card, i) => (
                      <motion.div
                        key={card.card_id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-[var(--surface)] hover:bg-white/[0.02] transition-colors"
                      >
                        <div className={cn(
                          'w-1.5 h-8 rounded-full shrink-0',
                          card.state === 'In Progress' && 'bg-blue-500',
                          card.state === 'Under Review' && 'bg-violet-500',
                          card.state === 'Testing' && 'bg-amber',
                          card.state === 'Done' && 'bg-emerald-500',
                          card.state === 'Released' && 'bg-emerald-400',
                          card.state === 'Blocked' && 'bg-red-500',
                          card.state === 'Planned' && 'bg-zinc-600',
                        )} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-muted-foreground/50">{card.card_id}</span>
                            <Badge variant="outline" className="text-[9px] h-4 px-1 bg-white/[0.04]">
                              {card.type}
                            </Badge>
                            <Badge variant="outline" className={cn(
                              'text-[9px] h-4 px-1',
                              card.state === 'In Progress' && 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                              card.state === 'Under Review' && 'bg-violet-500/10 text-violet-400 border-violet-500/20',
                              card.state === 'Testing' && 'bg-amber/10 text-amber border-amber/20',
                              card.state === 'Done' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                              card.state === 'Released' && 'bg-emerald-400/10 text-emerald-300 border-emerald-400/20',
                              card.state === 'Blocked' && 'bg-red-500/10 text-red-400 border-red-500/20',
                              card.state === 'Planned' && 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                            )}>
                              {card.state}
                            </Badge>
                          </div>
                          <p className="text-xs font-medium mt-0.5 truncate">{card.title}</p>
                        </div>
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/20 shrink-0" />
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-muted-foreground/30 rounded-lg border border-dashed border-border">
                    No cards assigned
                  </div>
                )}
              </div>

              {/* Activity Timeline */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber" />
                  Recent Activity
                </h3>
                <div className="relative">
                  {/* Vertical line */}
                  <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

                  <div className="space-y-0">
                    {mockAgentEvents.map((event, i) => {
                      const EventIcon = eventIcons[event.type] || Activity;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 + i * 0.06 }}
                          className="flex items-start gap-3 py-2.5 relative"
                        >
                          <div className="w-6 h-6 rounded-full bg-[var(--surface)] border border-border flex items-center justify-center z-10 shrink-0">
                            <EventIcon className="w-3 h-3 text-muted-foreground/60" />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-xs text-muted-foreground">
                              {event.action}{' '}
                              <span className="font-semibold text-foreground">{event.target}</span>
                            </p>
                            <span className="text-[10px] text-muted-foreground/40">{event.time}</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Agent Capabilities */}
              <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
                <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Capabilities</h3>
                <div className="flex flex-wrap gap-1.5">
                  {getAgentCapabilities(selectedAgent.id).map((cap, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] bg-white/[0.03] font-mono">
                      {cap}
                    </Badge>
                  ))}
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground/40">
              Select an agent to view details
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function getAgentCapabilities(agentId: string): string[] {
  const caps: Record<string, string[]> = {
    'orchestrator': ['task.route', 'agent.assign', 'event.emit', 'priority.manage'],
    'state-controller': ['state.validate', 'transition.enforce', 'board.update', 'rollback.execute'],
    'decision-controller': ['decision.create', 'option.analyze', 'risk.score', 'approval.route'],
    'audit-gatekeeper': ['dod.validate', 'gate.check', 'compliance.verify', 'report.generate'],
    'security-compliance': ['security.scan', 'vulnerability.check', 'policy.enforce', 'secret.audit'],
    'business-analyst': ['brd.write', 'requirement.capture', 'stakeholder.interview', 'acceptance.define'],
    'solution-architect': ['sdd.write', 'architecture.design', 'pattern.select', 'tech.evaluate'],
    'ui-ux-designer': ['wireframe.create', 'prototype.build', 'ux.review', 'design-system.maintain'],
    'product-manager': ['epic.define', 'feature.prioritize', 'roadmap.plan', 'kpi.track'],
    'tech-lead': ['pr.review', 'code.approve', 'mentor.guide', 'standard.enforce'],
    'junior-developer': ['code.write', 'test.unit', 'pr.create', 'doc.update'],
    'senior-developer': ['code.review', 'refactor.execute', 'architecture.enforce', 'debug.complex'],
    'qa-engineer': ['test.plan', 'test.execute', 'bug.report', 'regression.verify'],
    'automation-test': ['test.automate', 'ci.integrate', 'coverage.analyze', 'e2e.write'],
    'performance-engineer': ['perf.profile', 'bottleneck.identify', 'optimize.execute', 'benchmark.run'],
    'platform-engineer': ['infra.provision', 'service.deploy', 'scale.configure', 'monitor.setup'],
    'devops-engineer': ['ci.pipeline', 'cd.deploy', 'container.manage', 'env.configure'],
    'integration-engineer': ['api.connect', 'webhook.setup', 'sync.configure', 'protocol.implement'],
    'secrets-manager': ['secret.store', 'key.rotate', 'access.control', 'vault.manage'],
    'sre': ['incident.respond', 'uptime.monitor', 'alert.configure', 'postmortem.write'],
    'llm-gateway': ['model.route', 'token.count', 'fallback.manage', 'provider.switch'],
    'prompt-engineer': ['prompt.craft', 'template.optimize', 'chain.design', 'eval.benchmark'],
    'cost-analyst': ['cost.track', 'budget.forecast', 'usage.report', 'optimization.recommend'],
  };
  return caps[agentId] || ['task.execute'];
}
