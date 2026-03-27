'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchAgents, fetchCards, type TeamDispatchResult } from '@/lib/api';
import { RunTeamModal } from '@/components/agents/run-team-modal';
import { useTeamStatus } from '@/lib/hooks/use-team-status';

import { Agent, Card, AgentGroup, AgentStatus } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bot, Activity, Cpu, Shield, Code2, Cloud, BrainCircuit,
  Circle, ChevronRight, Zap, Clock, Pause, AlertTriangle,
  Eye, BarChart3, GitPullRequest, FileText, Terminal, Users, CheckCircle2
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
    label: 'Management',
    description: 'Project coordination, quality checks, and decision management',
    icon: Shield,
    color: 'text-amber',
    bg: 'bg-amber/10',
    border: 'border-amber/20',
  },
  sdlc: {
    label: 'Planning & Design',
    description: 'Requirements, architecture, design, and project planning',
    icon: Activity,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
  },
  engineering: {
    label: 'Building & Testing',
    description: 'Writing code, reviewing quality, testing, and optimization',
    icon: Code2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
  },
  platform: {
    label: 'Infrastructure',
    description: 'Servers, deployment, integrations, and system reliability',
    icon: Cloud,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    border: 'border-violet-500/20',
  },
  ai_cost: {
    label: 'AI & Cost',
    description: 'AI model management and cost tracking',
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

// Activity events populated from agent's real current task (no mock data)
// Real events come from the agent status in the database

const eventIcons: Record<string, React.ElementType> = {
  task: Terminal,
  review: Eye,
  pr: GitPullRequest,
  artifact: FileText,
  test: Activity,
  commit: Code2,
};

const agentRoleDescriptions: Record<string, string> = {
  'orchestrator': 'I coordinate your entire AI team, making sure everyone is working on the right things at the right time.',
  'state-controller': 'I track the status of every task and make sure work progresses smoothly through each stage.',
  'decision-controller': 'I prepare important decisions for your review, analyze the options, and implement what you approve.',
  'audit-gatekeeper': 'I check quality at every milestone to make sure nothing gets past that isn\'t ready.',
  'security-compliance': 'I keep your project secure by scanning for vulnerabilities and enforcing security best practices.',
  'business-analyst': 'I help clarify exactly what you want built and turn your ideas into detailed requirements.',
  'solution-architect': 'I design the technical foundation of your project, choosing the right tools and approach.',
  'ui-ux-designer': 'I create the visual designs and user experience for your product.',
  'product-manager': 'I define what features to build, in what order, and track overall project progress.',
  'tech-lead': 'I oversee code quality and technical decisions, making sure everything is built to high standards.',
  'junior-developer': 'I write code for new features and create tests to make sure they work correctly.',
  'senior-developer': 'I handle the most complex technical challenges and improve existing code quality.',
  'qa-engineer': 'I thoroughly test your product to find and fix bugs before users see them.',
  'automation-test': 'I set up automated testing to continuously verify your product works correctly.',
  'performance-engineer': 'I make sure your product runs fast and handles traffic smoothly.',
  'platform-engineer': 'I set up and manage the servers and infrastructure your product runs on.',
  'devops-engineer': 'I automate the process of building, testing, and deploying your product.',
  'integration-engineer': 'I connect your product with external services and APIs.',
  'secrets-manager': 'I securely manage all passwords, keys, and sensitive credentials.',
  'sre': 'I monitor your product 24/7 and respond immediately if anything goes wrong.',
  'llm-gateway': 'I manage which AI models are used and optimize their performance.',
  'prompt-engineer': 'I craft and optimize the prompts that make our AI tools work effectively.',
  'cost-analyst': 'I track project spending and find ways to reduce costs without sacrificing quality.',
};

type FilterMode = 'all' | 'working' | 'idle';

export default function AgentsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [showRunTeam, setShowRunTeam] = useState(false);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);

  const { status: teamStatus } = useTeamStatus(projectId, activeTeamId);

  useEffect(() => {
    Promise.all([
      fetchAgents(projectId).then(setAgents).catch(() => setAgents([])),
      fetchCards(projectId).then(setCards).catch(() => setCards([])),
    ])
      .catch(() => {/* keep whatever was set */})
      .finally(() => setLoading(false));
  }, [projectId]);

  // Select first working agent once agents are loaded
  useEffect(() => {
    if (!selectedAgent && agents.length > 0) {
      setSelectedAgent(agents.find(a => a.status === 'working') || null);
    }
  }, [agents, selectedAgent]);

  const groups: AgentGroup[] = ['governance', 'sdlc', 'engineering', 'platform', 'ai_cost'];

  const workingCount = agents.filter(a => a.status === 'working').length;
  const waitingCount = agents.filter(a => a.status === 'waiting').length;
  const idleCount = agents.filter(a => a.status === 'idle').length;

  const filteredAgents = filterMode === 'all'
    ? agents
    : filterMode === 'working'
      ? agents.filter(a => a.status === 'working' || a.status === 'waiting')
      : agents.filter(a => a.status === 'idle');

  // Get cards assigned to selected agent
  const agentCards = selectedAgent
    ? cards.filter(c => c.owner_agent === selectedAgent.id)
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
              AI Team
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
              <button
                onClick={() => setShowRunTeam(true)}
                className="flex items-center gap-1 text-[10px] font-semibold bg-amber/10 border border-amber/20 text-amber hover:bg-amber/15 px-2 py-1 rounded-md transition-colors"
              >
                <Users className="w-3 h-3" />
                Run Team
              </button>
            </div>
          </div>

          {/* Active team status banner */}
          {teamStatus && teamStatus.overallStatus === 'running' && (
            <div className="mb-2 flex items-center gap-2 text-[11px] bg-amber/5 border border-amber/20 rounded-lg px-3 py-2">
              <Zap className="w-3 h-3 text-amber animate-pulse shrink-0" />
              <span className="text-amber font-medium">Team running</span>
              <span className="text-muted-foreground">— {teamStatus.completedCount}/{teamStatus.tasksCount} tasks complete</span>
            </div>
          )}
          {teamStatus && teamStatus.overallStatus !== 'running' && (
            <div className="mb-2 flex items-center gap-2 text-[11px] bg-emerald-500/5 border border-emerald-500/20 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
              <span className="text-emerald-400 font-medium">Team done</span>
              <span className="text-muted-foreground">— {teamStatus.completedCount} completed, {teamStatus.failedCount} failed</span>
              <button onClick={() => setActiveTeamId(null)} className="ml-auto text-muted-foreground/50 hover:text-muted-foreground">×</button>
            </div>
          )}

          {/* Filter tabs */}
          <div className="flex gap-1 bg-white/[0.03] rounded-lg p-0.5">
            {[
              { key: 'all' as FilterMode, label: `All (${agents.length})` },
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
            <span>{agents.length} team members</span>
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
                  {agentRoleDescriptions[selectedAgent.id] || groupConfig[selectedAgent.group].description}
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
                  Currently Working On
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

              {/* Activity Status */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber" />
                  Status
                </h3>
                {selectedAgent.currentTask ? (
                  <div className="flex items-start gap-3 py-2.5 relative">
                    <div className="w-6 h-6 rounded-full bg-[var(--surface)] border border-emerald-500/30 flex items-center justify-center z-10 shrink-0">
                      <Zap className="w-3 h-3 text-emerald-400" />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-xs text-muted-foreground">
                        Currently working on{' '}
                        <span className="font-semibold text-foreground">{selectedAgent.currentTask}</span>
                      </p>
                      <span className="text-[10px] text-muted-foreground/40">Active now</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-muted-foreground/30 rounded-lg border border-dashed border-border">
                    {selectedAgent.status === 'idle'
                      ? 'Idle — waiting for task assignment'
                      : selectedAgent.status === 'blocked'
                        ? 'Blocked — needs resolution'
                        : 'No recent activity'}
                  </div>
                )}
              </div>

              {/* Agent Capabilities */}
              <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
                <h3 className="text-sm font-semibold text-foreground mb-3">What I Do</h3>
                <div className="flex flex-wrap gap-1.5">
                  {getAgentCapabilities(selectedAgent.id).map((cap, i) => (
                    <Badge key={i} variant="outline" className="text-[10px] bg-white/[0.03]">
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

      {/* Run Team Modal */}
      <AnimatePresence>
        {showRunTeam && (
          <RunTeamModal
            projectId={projectId}
            agents={agents}
            onClose={() => setShowRunTeam(false)}
            onDispatched={(result) => {
              setActiveTeamId(result.teamId);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function getAgentCapabilities(agentId: string): string[] {
  const caps: Record<string, string[]> = {
    'orchestrator': ['Coordinates all team activity', 'Assigns tasks to the right specialist', 'Manages priorities and scheduling'],
    'state-controller': ['Tracks progress of every task', 'Ensures quality at each stage', 'Prevents incomplete work from advancing'],
    'decision-controller': ['Prepares decisions for your review', 'Analyzes options and risks', 'Implements your approved choices'],
    'audit-gatekeeper': ['Checks quality before each milestone', 'Ensures nothing is missed', 'Generates progress reports'],
    'security-compliance': ['Scans for security issues', 'Protects sensitive data', 'Ensures best practices'],
    'business-analyst': ['Clarifies your requirements', 'Writes detailed specifications', 'Defines what "done" looks like'],
    'solution-architect': ['Designs the technical approach', 'Chooses the right technologies', 'Plans the system structure'],
    'ui-ux-designer': ['Creates interface designs', 'Builds interactive prototypes', 'Ensures great user experience'],
    'product-manager': ['Defines features and priorities', 'Plans the development roadmap', 'Tracks key metrics'],
    'tech-lead': ['Reviews all code quality', 'Mentors the development team', 'Enforces coding standards'],
    'junior-developer': ['Writes new code and features', 'Creates automated tests', 'Updates documentation'],
    'senior-developer': ['Handles complex technical work', 'Refactors and improves code', 'Debugs difficult issues'],
    'qa-engineer': ['Plans testing strategy', 'Finds and reports bugs', 'Verifies fixes work correctly'],
    'automation-test': ['Automates repetitive testing', 'Sets up continuous testing', 'Monitors test coverage'],
    'performance-engineer': ['Optimizes speed and efficiency', 'Identifies bottlenecks', 'Ensures smooth performance'],
    'platform-engineer': ['Sets up servers and hosting', 'Configures deployment pipelines', 'Monitors system health'],
    'devops-engineer': ['Automates build and deploy', 'Manages environments', 'Ensures reliable releases'],
    'integration-engineer': ['Connects external services', 'Sets up APIs and webhooks', 'Ensures data flows correctly'],
    'secrets-manager': ['Protects passwords and keys', 'Manages access securely', 'Rotates credentials safely'],
    'sre': ['Monitors uptime and health', 'Responds to incidents', 'Prevents future outages'],
    'llm-gateway': ['Manages AI model access', 'Optimizes response quality', 'Handles provider switching'],
    'prompt-engineer': ['Crafts effective AI prompts', 'Optimizes AI interactions', 'Tests AI response quality'],
    'cost-analyst': ['Tracks spending and budgets', 'Forecasts project costs', 'Recommends cost savings'],
  };
  return caps[agentId] || ['Handles assigned tasks'];
}
