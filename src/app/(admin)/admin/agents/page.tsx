'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  Search,
  ToggleLeft,
  Thermometer,
  Eye,
  ChevronDown,
  ChevronRight,
  Shield,
  Layers,
  Code2,
  Server,
  Brain,
  Check,
  Loader2,
  Activity,
  Zap,
  Hash,
  Coins,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ─── Animation variants ───
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ─── Group icons ───
const GROUP_ICONS: Record<string, typeof Shield> = {
  GOVERNANCE: Shield,
  SDLC: Layers,
  ENGINEERING: Code2,
  PLATFORM: Server,
  AI_COST: Brain,
};

const GROUP_COLORS: Record<string, string> = {
  GOVERNANCE: '#ef4444',
  SDLC: '#3b82f6',
  ENGINEERING: '#10b981',
  PLATFORM: '#8b5cf6',
  AI_COST: '#f59e0b',
};

// ─── Types ───
interface AgentConfig {
  shortName: string;
  name: string;
  group: string;
  groupLabel: string;
  avatar: string;
  temperature: number;
  defaultTemperature: number;
  enabled: boolean;
  capabilities: string[];
  contextSources: string[];
  outputTypes: string[];
  authority: {
    canWrite: string[];
    canRead: string[];
    canNever: string[];
  };
  systemPromptPreview: string;
  systemPromptLength: number;
  activeInstances: number;
  totalInstances: number;
  usage30d: {
    totalTokens: number;
    totalCost: number;
    callCount: number;
  };
}

interface GroupInfo {
  key: string;
  label: string;
  agentCount: number;
  enabledCount: number;
}

// ─── Stat Card ───
function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: typeof Bot;
  color: string;
}) {
  return (
    <div className="glass-card rounded-xl border border-border/50 p-4">
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-full shrink-0"
          style={{ backgroundColor: color + '15' }}
        >
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Capability badge formatter ───
function formatCapability(cap: string): string {
  return cap
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Agent Row Component ───
function AgentRow({
  agent,
  onToggleEnabled,
  onTemperatureChange,
  saving,
}: {
  agent: AgentConfig;
  onToggleEnabled: (shortName: string, enabled: boolean) => void;
  onTemperatureChange: (shortName: string, temperature: number) => void;
  saving: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const isSaving = saving === agent.shortName;
  const groupColor = GROUP_COLORS[agent.group] ?? '#6b7280';

  return (
    <motion.div
      variants={itemVariants}
      className={cn(
        'glass-card rounded-xl border border-border/50 overflow-hidden transition-all',
        !agent.enabled && 'opacity-60',
      )}
    >
      {/* Main row */}
      <div className="flex items-center gap-4 p-4">
        {/* Avatar */}
        <div className="text-2xl w-10 h-10 flex items-center justify-center rounded-lg bg-[var(--surface-raised)] shrink-0">
          {agent.avatar}
        </div>

        {/* Name & Group */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{agent.name}</span>
            <span className="text-[10px] font-mono text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
              {agent.shortName}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-4 border-border/50"
              style={{ color: groupColor, borderColor: groupColor + '40' }}
            >
              {agent.groupLabel}
            </Badge>
            {agent.activeInstances > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-green-500">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {agent.activeInstances} active
              </span>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="hidden md:flex items-center gap-6 text-xs text-muted-foreground">
          <div className="text-center">
            <p className="font-mono text-foreground">{agent.usage30d.callCount}</p>
            <p className="text-[10px]">Calls (30d)</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-foreground">
              {agent.usage30d.totalTokens > 1000
                ? `${(agent.usage30d.totalTokens / 1000).toFixed(1)}k`
                : agent.usage30d.totalTokens}
            </p>
            <p className="text-[10px]">Tokens</p>
          </div>
          <div className="text-center">
            <p className="font-mono text-foreground">${agent.usage30d.totalCost.toFixed(2)}</p>
            <p className="text-[10px]">Cost</p>
          </div>
        </div>

        {/* Temperature */}
        <div className="hidden sm:flex items-center gap-2">
          <Thermometer className="w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="number"
            value={agent.temperature}
            onChange={(e) => {
              const val = Math.min(2, Math.max(0, Number(e.target.value)));
              onTemperatureChange(agent.shortName, val);
            }}
            step="0.1"
            min="0"
            max="2"
            className="w-16 h-7 px-2 rounded-md border border-border bg-background text-xs text-foreground text-center focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            disabled={isSaving}
          />
        </div>

        {/* Enable/Disable */}
        <div className="flex items-center gap-2">
          {isSaving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
          <Switch
            checked={agent.enabled}
            onCheckedChange={(checked) => onToggleEnabled(agent.shortName, checked)}
            disabled={isSaving}
          />
        </div>

        {/* Expand */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-[var(--surface-raised)] transition-colors"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 space-y-4 border-t border-border/30">
              {/* Mobile stats */}
              <div className="flex md:hidden items-center gap-4 pt-3 text-xs text-muted-foreground">
                <div>
                  <span className="font-mono text-foreground">{agent.usage30d.callCount}</span> calls
                </div>
                <div>
                  <span className="font-mono text-foreground">
                    {agent.usage30d.totalTokens > 1000
                      ? `${(agent.usage30d.totalTokens / 1000).toFixed(1)}k`
                      : agent.usage30d.totalTokens}
                  </span>{' '}
                  tokens
                </div>
                <div>
                  <span className="font-mono text-foreground">${agent.usage30d.totalCost.toFixed(2)}</span> cost
                </div>
              </div>

              {/* Capabilities */}
              <div className="pt-3">
                <p className="text-xs text-muted-foreground mb-2 font-medium">Capabilities</p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.capabilities.map((cap) => (
                    <Badge
                      key={cap}
                      variant="outline"
                      className="text-[10px] px-2 py-0.5 border-border/50 text-muted-foreground"
                    >
                      {formatCapability(cap)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Output Types */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">Output Types</p>
                <div className="flex flex-wrap gap-1.5">
                  {agent.outputTypes.map((type) => (
                    <Badge
                      key={type}
                      variant="outline"
                      className="text-[10px] px-2 py-0.5 border-[var(--admin-accent)]/30 text-[var(--admin-accent)]"
                    >
                      {formatCapability(type)}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Authority */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[10px] text-green-500 font-medium mb-1">Can Write</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.authority.canWrite.map((item) => (
                      <span
                        key={item}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-500"
                      >
                        {item.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-blue-400 font-medium mb-1">Can Read</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.authority.canRead.map((item) => (
                      <span
                        key={item}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400"
                      >
                        {item.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-red-400 font-medium mb-1">Cannot Access</p>
                  <div className="flex flex-wrap gap-1">
                    {agent.authority.canNever.map((item) => (
                      <span
                        key={item}
                        className="text-[10px] px-1.5 py-0.5 rounded bg-red-400/10 text-red-400"
                      >
                        {item.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* System Prompt Preview */}
              <div>
                <p className="text-xs text-muted-foreground mb-2 font-medium">
                  System Prompt
                  <span className="text-[10px] ml-2 text-muted-foreground/50">
                    ({agent.systemPromptLength.toLocaleString()} chars)
                  </span>
                </p>
                <div className="rounded-lg bg-[var(--surface-raised)] border border-border/30 p-3">
                  <p className="text-xs text-muted-foreground/80 leading-relaxed font-mono">
                    {agent.systemPromptPreview}
                  </p>
                </div>
              </div>

              {/* Instance info */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  <Hash className="w-3 h-3 inline mr-1" />
                  {agent.totalInstances} total instances across projects
                </span>
                {agent.defaultTemperature !== agent.temperature && (
                  <span className="text-amber-500">
                    Default temp: {agent.defaultTemperature} (overridden to {agent.temperature})
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ───
export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<AgentConfig[]>([]);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [search, setSearch] = useState('');
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [totalAgents, setTotalAgents] = useState(0);
  const [enabledAgents, setEnabledAgents] = useState(0);

  // Load agents
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/agents');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setAgents(data.agents);
      setGroups(data.groups);
      setTotalAgents(data.totalAgents);
      setEnabledAgents(data.enabledAgents);
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAgents();
  }, [fetchAgents]);

  // Save agent config
  const saveAgent = async (shortName: string, updates: { enabled?: boolean; temperature?: number }) => {
    setSaving(shortName);
    setSaveStatus('idle');
    try {
      const res = await fetch('/api/admin/agents', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shortName, ...updates }),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (err) {
      console.error('Failed to save agent config:', err);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(null);
    }
  };

  const handleToggleEnabled = (shortName: string, enabled: boolean) => {
    setAgents((prev) =>
      prev.map((a) => (a.shortName === shortName ? { ...a, enabled } : a)),
    );
    setEnabledAgents((prev) => prev + (enabled ? 1 : -1));
    saveAgent(shortName, { enabled });
  };

  const handleTemperatureChange = (shortName: string, temperature: number) => {
    setAgents((prev) =>
      prev.map((a) => (a.shortName === shortName ? { ...a, temperature } : a)),
    );
    // Debounce save — only save on blur or explicit action
  };

  const handleTemperatureSave = (shortName: string) => {
    const agent = agents.find((a) => a.shortName === shortName);
    if (agent && agent.temperature !== agent.defaultTemperature) {
      saveAgent(shortName, { temperature: agent.temperature });
    }
  };

  // Filtered agents
  const filteredAgents = agents.filter((a) => {
    const matchesSearch =
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.shortName.toLowerCase().includes(search.toLowerCase()) ||
      a.groupLabel.toLowerCase().includes(search.toLowerCase());
    const matchesGroup = !activeGroup || a.group === activeGroup;
    return matchesSearch && matchesGroup;
  });

  // Group the filtered agents
  const groupedAgents = groups
    .filter((g) => !activeGroup || g.key === activeGroup)
    .map((g) => ({
      ...g,
      agents: filteredAgents.filter((a) => a.group === g.key),
    }))
    .filter((g) => g.agents.length > 0);

  // Summary stats
  const totalCalls = agents.reduce((sum, a) => sum + a.usage30d.callCount, 0);
  const totalCost = agents.reduce((sum, a) => sum + a.usage30d.totalCost, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-5xl"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Bot className="w-6 h-6 text-[var(--admin-accent)]" />
              AI Agents
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure and monitor the {totalAgents} AI agents powering every project
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saveStatus === 'saved' && (
              <motion.span
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-1 text-xs text-green-500"
              >
                <Check className="w-3.5 h-3.5" />
                Saved
              </motion.span>
            )}
            {saveStatus === 'error' && (
              <span className="text-xs text-red-400">Save failed</span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Summary Stats */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total Agents" value={totalAgents} icon={Bot} color="#0d9488" />
        <StatCard label="Enabled" value={enabledAgents} icon={ToggleLeft} color="#10b981" />
        <StatCard label="API Calls (30d)" value={totalCalls.toLocaleString()} icon={Zap} color="#3b82f6" />
        <StatCard label="Total Cost (30d)" value={`$${totalCost.toFixed(2)}`} icon={Coins} color="#f59e0b" />
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search agents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-4 rounded-lg border border-border bg-[var(--surface-raised)] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
          />
        </div>

        {/* Group filter */}
        <div className="flex gap-1.5 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setActiveGroup(null)}
            className={cn(
              'text-xs h-9',
              !activeGroup && 'bg-[var(--admin-accent)]/10 border-[var(--admin-accent)]/30 text-[var(--admin-accent)]',
            )}
          >
            All
          </Button>
          {groups.map((g) => {
            const Icon = GROUP_ICONS[g.key] ?? Bot;
            const color = GROUP_COLORS[g.key] ?? '#6b7280';
            return (
              <Button
                key={g.key}
                variant="outline"
                size="sm"
                onClick={() => setActiveGroup(activeGroup === g.key ? null : g.key)}
                className={cn(
                  'text-xs h-9 gap-1.5',
                  activeGroup === g.key && 'border-[var(--admin-accent)]/30',
                )}
                style={
                  activeGroup === g.key
                    ? { backgroundColor: color + '15', color, borderColor: color + '40' }
                    : undefined
                }
              >
                <Icon className="w-3.5 h-3.5" />
                {g.label}
                <span className="text-[10px] text-muted-foreground ml-0.5">
                  {g.enabledCount}/{g.agentCount}
                </span>
              </Button>
            );
          })}
        </div>
      </motion.div>

      {/* Agent Groups */}
      {groupedAgents.map((group) => {
        const Icon = GROUP_ICONS[group.key] ?? Bot;
        const color = GROUP_COLORS[group.key] ?? '#6b7280';

        return (
          <motion.div key={group.key} variants={itemVariants} className="space-y-3">
            {/* Group header */}
            <div className="flex items-center gap-2">
              <div
                className="flex items-center justify-center w-7 h-7 rounded-full"
                style={{ backgroundColor: color + '15' }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color }} />
              </div>
              <h2 className="text-sm font-semibold text-foreground">{group.label}</h2>
              <span className="text-xs text-muted-foreground">
                {group.enabledCount}/{group.agentCount} enabled
              </span>
            </div>

            {/* Agent rows */}
            <div className="space-y-2">
              {group.agents.map((agent) => (
                <AgentRow
                  key={agent.shortName}
                  agent={agent}
                  onToggleEnabled={handleToggleEnabled}
                  onTemperatureChange={handleTemperatureChange}
                  saving={saving}
                />
              ))}
            </div>
          </motion.div>
        );
      })}

      {/* Empty state */}
      {filteredAgents.length === 0 && (
        <motion.div variants={itemVariants} className="text-center py-12">
          <Bot className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No agents match your search</p>
        </motion.div>
      )}
    </motion.div>
  );
}
