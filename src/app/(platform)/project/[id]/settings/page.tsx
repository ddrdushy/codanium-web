'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Settings, BrainCircuit, Key, Shield, Bell,
  Globe, Cpu, Zap, CheckCircle2, AlertTriangle,
  ChevronRight, Plus, Trash2, Edit3, ExternalLink,
  DollarSign, Gauge, ToggleLeft, ArrowRight,
  Lock, Clock, Database, Download, Mail, MessageSquare,
  Hash, VolumeX, Activity, Eye,
  RefreshCw, Archive, Info, Palette, Languages, MapPin,
  FileText, AlertOctagon, Copy, ShieldCheck,
  Router, Target, CircleDot
} from 'lucide-react';

interface LLMProvider {
  id: string;
  name: string;
  icon: string;
  status: 'connected' | 'disconnected' | 'error';
  models: string[];
  defaultModel: string;
  apiKeySet: boolean;
  tokenUsage: number;
  tokenLimit: number;
  costThisMonth: number;
}

const mockProviders: LLMProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🟢',
    status: 'connected',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-preview'],
    defaultModel: 'gpt-4o',
    apiKeySet: true,
    tokenUsage: 1_240_000,
    tokenLimit: 5_000_000,
    costThisMonth: 47.82,
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🟠',
    status: 'connected',
    models: ['claude-sonnet-4-20250514', 'claude-3.5-haiku', 'claude-opus-4-20250514'],
    defaultModel: 'claude-sonnet-4-20250514',
    apiKeySet: true,
    tokenUsage: 890_000,
    tokenLimit: 3_000_000,
    costThisMonth: 32.15,
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    icon: '🦙',
    status: 'connected',
    models: ['llama3.1:70b', 'codellama:34b', 'mistral:7b'],
    defaultModel: 'llama3.1:70b',
    apiKeySet: true,
    tokenUsage: 2_100_000,
    tokenLimit: 0,
    costThisMonth: 0,
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    icon: '🔧',
    status: 'disconnected',
    models: [],
    defaultModel: '',
    apiKeySet: false,
    tokenUsage: 0,
    tokenLimit: 0,
    costThisMonth: 0,
  },
];

// --- Agent Config mock data ---

interface AgentGroup {
  id: string;
  name: string;
  icon: string;
  can_do: string[];
  must_do: string[];
  must_never: string[];
}

const agentGroups: AgentGroup[] = [
  {
    id: 'governance',
    name: 'Governance',
    icon: '🏛️',
    can_do: ['Approve architecture decisions', 'Enforce coding standards', 'Review compliance'],
    must_do: ['Log every decision with rationale', 'Escalate budget overruns', 'Validate against policy'],
    must_never: ['Deploy to production directly', 'Override security flags', 'Skip audit trail'],
  },
  {
    id: 'sdlc',
    name: 'SDLC',
    icon: '🔄',
    can_do: ['Create tasks from requirements', 'Assign to engineering agents', 'Update sprint board'],
    must_do: ['Break epics into stories', 'Link PRs to cards', 'Track cycle time'],
    must_never: ['Skip acceptance criteria', 'Close cards without review', 'Merge without CI pass'],
  },
  {
    id: 'engineering',
    name: 'Engineering',
    icon: '⚙️',
    can_do: ['Write code', 'Create PRs', 'Run tests', 'Refactor modules'],
    must_do: ['Write unit tests for new code', 'Follow style guide', 'Document public APIs'],
    must_never: ['Push to main directly', 'Disable linters', 'Hardcode secrets'],
  },
  {
    id: 'platform',
    name: 'Platform',
    icon: '☁️',
    can_do: ['Provision infrastructure', 'Configure CI/CD', 'Monitor services'],
    must_do: ['Use IaC templates', 'Enable health checks', 'Set up alerting'],
    must_never: ['Expose internal ports', 'Disable firewalls', 'Use root credentials'],
  },
  {
    id: 'ai_cost',
    name: 'AI Cost',
    icon: '💰',
    can_do: ['Monitor token usage', 'Suggest model downgrades', 'Set budget alerts'],
    must_do: ['Report daily spend', 'Flag anomalies over 20%', 'Recommend optimizations'],
    must_never: ['Disable rate limits', 'Approve unlimited budgets', 'Bypass cost controls'],
  },
];

interface AgentBudget {
  agent: string;
  budget: number;
  spent: number;
}

const agentBudgets: AgentBudget[] = [
  { agent: 'Governance', budget: 500_000, spent: 120_000 },
  { agent: 'SDLC', budget: 800_000, spent: 540_000 },
  { agent: 'Engineering', budget: 2_000_000, spent: 1_640_000 },
  { agent: 'Platform', budget: 600_000, spent: 310_000 },
  { agent: 'AI Cost', budget: 200_000, spent: 45_000 },
];

const agentRoutingRules = [
  { taskType: 'Architecture Review', agent: 'Governance', priority: 'High' },
  { taskType: 'Feature Development', agent: 'Engineering', priority: 'High' },
  { taskType: 'Sprint Planning', agent: 'SDLC', priority: 'Medium' },
  { taskType: 'Infrastructure Change', agent: 'Platform', priority: 'High' },
  { taskType: 'Cost Optimization', agent: 'AI Cost', priority: 'Low' },
  { taskType: 'Code Review', agent: 'Engineering', priority: 'Medium' },
  { taskType: 'Compliance Check', agent: 'Governance', priority: 'High' },
  { taskType: 'Deployment', agent: 'Platform', priority: 'High' },
];

// --- Security mock data ---

interface ApiKeyEntry {
  id: string;
  name: string;
  prefix: string;
  created: string;
  lastUsed: string;
  status: 'active' | 'expired';
}

const mockApiKeys: ApiKeyEntry[] = [
  { id: '1', name: 'CI/CD Pipeline', prefix: 'ats_live_7k3x', created: '2025-11-12', lastUsed: '2 hours ago', status: 'active' },
  { id: '2', name: 'Monitoring Service', prefix: 'ats_live_m9qr', created: '2025-12-01', lastUsed: '5 min ago', status: 'active' },
  { id: '3', name: 'Legacy Integration', prefix: 'ats_test_old2', created: '2025-06-15', lastUsed: '90 days ago', status: 'expired' },
];

// --- Notification event types ---

interface NotificationEvent {
  id: string;
  label: string;
  description: string;
  defaultEnabled: boolean;
}

const notificationEvents: NotificationEvent[] = [
  { id: 'card_state', label: 'Card State Changes', description: 'When a card moves between columns', defaultEnabled: true },
  { id: 'decision_required', label: 'Decision Required', description: 'When an agent needs human approval', defaultEnabled: true },
  { id: 'agent_blocked', label: 'Agent Blocked', description: 'When an agent encounters an unresolvable issue', defaultEnabled: true },
  { id: 'build_failure', label: 'Build Failures', description: 'When CI/CD pipeline fails', defaultEnabled: true },
  { id: 'deployment', label: 'Deployment', description: 'When code is deployed to any environment', defaultEnabled: false },
  { id: 'security_alert', label: 'Security Alerts', description: 'Vulnerability detections and access anomalies', defaultEnabled: true },
];

type SettingsTab = 'llm' | 'agents' | 'security' | 'notifications' | 'general';

const tabs: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
  { key: 'llm', label: 'LLM Providers', icon: BrainCircuit },
  { key: 'agents', label: 'Agent Config', icon: Cpu },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'general', label: 'General', icon: Settings },
];

interface ProjectInfo {
  id: string;
  name: string;
  description: string | null;
  status: string;
  color: string;
  createdAt: string;
  updatedAt: string;
}

export default function SettingsPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState<SettingsTab>('llm');
  const [expandedProvider, setExpandedProvider] = useState<string | null>('openai');

  // Project info state
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [nameValue, setNameValue] = useState('');
  const [descValue, setDescValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then((data: ProjectInfo) => {
        setProject(data);
        setNameValue(data.name);
        setDescValue(data.description ?? '');
      })
      .catch(() => {});
  }, [projectId]);

  const handleSave = useCallback(async (field: 'name' | 'description') => {
    setSaving(true);
    try {
      const body = field === 'name' ? { name: nameValue } : { description: descValue };
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await res.json();
      setProject(prev => prev ? { ...prev, ...updated } : prev);
      if (field === 'name') setEditingName(false);
      else setEditingDesc(false);
    } catch { /* silently fail */ }
    finally { setSaving(false); }
  }, [projectId, nameValue, descValue]);

  const handleArchive = useCallback(async () => {
    setArchiving(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ARCHIVED' }),
      });
      router.push('/projects');
    } catch { setArchiving(false); }
  }, [projectId, router]);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed');
      router.push('/projects');
    } catch { setDeleting(false); setShowDeleteConfirm(false); }
  }, [projectId, router]);

  const totalCost = mockProviders.reduce((acc, p) => acc + p.costThisMonth, 0);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Configure LLM providers, agent behavior, and project settings</p>
      </motion.div>

      {/* Tabs */}
      <div className="flex gap-1 mt-6 mb-6 bg-white/[0.02] rounded-xl p-1 border border-border">
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-amber/10 text-amber border border-amber/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* LLM Providers Tab */}
      {activeTab === 'llm' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Budget Overview */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Monthly Spend', value: `$${totalCost.toFixed(2)}`, sub: 'across all providers', color: 'text-amber', icon: DollarSign, bg: 'bg-amber/10 border-amber/20' },
              { label: 'Total Tokens', value: '4.2M', sub: 'of 8M limit', color: 'text-blue-400', icon: Gauge, bg: 'bg-blue-500/10 border-blue-500/20' },
              { label: 'Active Providers', value: '3/4', sub: 'connected', color: 'text-emerald-400', icon: Zap, bg: 'bg-emerald-500/10 border-emerald-500/20' },
            ].map((stat, i) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn('rounded-xl border p-4', stat.bg)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">{stat.label}</p>
                      <p className={cn('text-2xl font-bold mt-1', stat.color)}>{stat.value}</p>
                      <p className="text-[11px] text-muted-foreground/40 mt-0.5">{stat.sub}</p>
                    </div>
                    <Icon className={cn('w-5 h-5 opacity-40', stat.color)} />
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Provider Cards */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">LLM Providers</h2>
              <Button size="sm" className="h-7 text-[11px] bg-amber/20 text-amber hover:bg-amber/30 border border-amber/20">
                <Plus className="w-3 h-3 mr-1" /> Add Provider
              </Button>
            </div>

            {mockProviders.map((provider, i) => {
              const isExpanded = expandedProvider === provider.id;
              const usagePercent = provider.tokenLimit > 0 ? (provider.tokenUsage / provider.tokenLimit) * 100 : 0;

              return (
                <motion.div
                  key={provider.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.05 }}
                  className="rounded-xl border border-border bg-[var(--surface)] overflow-hidden"
                >
                  {/* Provider Header */}
                  <button
                    onClick={() => setExpandedProvider(isExpanded ? null : provider.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors"
                  >
                    <span className="text-xl">{provider.icon}</span>
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{provider.name}</h3>
                        <Badge variant="outline" className={cn(
                          'text-[9px] h-4 px-1.5',
                          provider.status === 'connected' && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
                          provider.status === 'disconnected' && 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
                          provider.status === 'error' && 'bg-red-500/15 text-red-400 border-red-500/20',
                        )}>
                          {provider.status === 'connected' && <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />}
                          {provider.status === 'error' && <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />}
                          {provider.status}
                        </Badge>
                      </div>
                      {provider.models.length > 0 && (
                        <p className="text-[11px] text-muted-foreground/50 mt-0.5">
                          Default: <span className="font-mono text-foreground/60">{provider.defaultModel}</span>
                          {' · '}{provider.models.length} models
                        </p>
                      )}
                    </div>
                    {provider.costThisMonth > 0 && (
                      <span className="text-sm font-semibold text-amber">
                        ${provider.costThisMonth.toFixed(2)}
                      </span>
                    )}
                    <ChevronRight className={cn(
                      'w-4 h-4 text-muted-foreground/30 transition-transform',
                      isExpanded && 'rotate-90'
                    )} />
                  </button>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="border-t border-border px-4 py-4 space-y-4"
                    >
                      {/* API Key */}
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                          API Key
                        </label>
                        <div className="flex items-center gap-2 mt-1.5">
                          <div className="flex-1 bg-black/20 border border-border rounded-lg px-3 py-2 text-xs font-mono text-muted-foreground/50">
                            {provider.apiKeySet ? '••••••••••••••••••••••sk-****' : 'Not configured'}
                          </div>
                          <Button size="sm" variant="outline" className="h-8 text-[11px]">
                            <Edit3 className="w-3 h-3 mr-1" /> Update
                          </Button>
                        </div>
                      </div>

                      {/* Models */}
                      {provider.models.length > 0 && (
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                            Available Models
                          </label>
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {provider.models.map(model => (
                              <Badge
                                key={model}
                                variant="outline"
                                className={cn(
                                  'text-[10px] font-mono cursor-pointer transition-colors',
                                  model === provider.defaultModel
                                    ? 'bg-amber/10 text-amber border-amber/20'
                                    : 'bg-white/[0.03] hover:bg-white/[0.06]'
                                )}
                              >
                                {model}
                                {model === provider.defaultModel && (
                                  <span className="ml-1 text-[8px] opacity-60">default</span>
                                )}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Token Usage */}
                      {provider.tokenLimit > 0 && (
                        <div>
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                              Token Usage
                            </label>
                            <span className="text-[10px] text-muted-foreground/40">
                              {(provider.tokenUsage / 1_000_000).toFixed(1)}M / {(provider.tokenLimit / 1_000_000).toFixed(0)}M
                            </span>
                          </div>
                          <div className="mt-1.5 h-2 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber' : 'bg-emerald-500'
                              )}
                              style={{ width: `${usagePercent}%` }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 pt-2">
                        <Button size="sm" variant="outline" className="h-7 text-[11px]">
                          <ToggleLeft className="w-3 h-3 mr-1" /> Test Connection
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-[11px]">
                          <ExternalLink className="w-3 h-3 mr-1" /> Docs
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-[11px] text-red-400 hover:text-red-300 ml-auto">
                          <Trash2 className="w-3 h-3 mr-1" /> Remove
                        </Button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Model Routing */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              Model Routing Rules
            </h3>
            <div className="space-y-2">
              {[
                { scope: 'System Default', model: 'gpt-4o', provider: 'OpenAI', priority: 'Primary' },
                { scope: 'Code Generation', model: 'claude-sonnet-4-20250514', provider: 'Anthropic', priority: 'Primary' },
                { scope: 'Code Review', model: 'claude-sonnet-4-20250514', provider: 'Anthropic', priority: 'Primary' },
                { scope: 'Simple Tasks', model: 'gpt-4o-mini', provider: 'OpenAI', priority: 'Cost-optimized' },
                { scope: 'Local Fallback', model: 'llama3.1:70b', provider: 'Ollama', priority: 'Fallback' },
              ].map((rule, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors">
                  <span className="text-xs font-medium w-32 shrink-0">{rule.scope}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
                  <Badge variant="outline" className="text-[10px] font-mono bg-white/[0.03]">
                    {rule.model}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground/40">{rule.provider}</span>
                  <Badge variant="outline" className={cn(
                    'text-[9px] ml-auto',
                    rule.priority === 'Primary' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                    rule.priority === 'Fallback' && 'bg-amber/10 text-amber border-amber/20',
                    rule.priority === 'Cost-optimized' && 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                  )}>
                    {rule.priority}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Agent Config Tab */}
      {activeTab === 'agents' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Agent Authority Matrix */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-violet-400" />
              Agent Authority Matrix
            </h3>
            <div className="space-y-3">
              {agentGroups.map((group, i) => (
                <motion.div
                  key={group.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="rounded-xl border border-border bg-white/[0.02] p-4"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg">{group.icon}</span>
                    <h4 className="text-xs font-semibold">{group.name}</h4>
                    <Badge variant="outline" className="text-[9px] ml-auto bg-violet-500/10 text-violet-400 border-violet-500/20">
                      {group.can_do.length + group.must_do.length} rules
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-semibold text-emerald-400/80 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                        <CheckCircle2 className="w-2.5 h-2.5" /> Can Do
                      </label>
                      <div className="space-y-1">
                        {group.can_do.map((action, j) => (
                          <div key={j} className="text-[11px] text-muted-foreground/60 flex items-start gap-1.5">
                            <span className="text-emerald-500/50 mt-0.5 shrink-0">•</span>
                            {action}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-amber/80 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> Must Do
                      </label>
                      <div className="space-y-1">
                        {group.must_do.map((rule, j) => (
                          <div key={j} className="text-[11px] text-muted-foreground/60 flex items-start gap-1.5">
                            <span className="text-amber/50 mt-0.5 shrink-0">•</span>
                            {rule}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-[10px] font-semibold text-red-400/80 uppercase tracking-wider flex items-center gap-1 mb-1.5">
                        <AlertOctagon className="w-2.5 h-2.5" /> Must Never
                      </label>
                      <div className="space-y-1">
                        {group.must_never.map((constraint, j) => (
                          <div key={j} className="text-[11px] text-muted-foreground/60 flex items-start gap-1.5">
                            <span className="text-red-500/50 mt-0.5 shrink-0">•</span>
                            {constraint}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Token Budget Per Agent */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber" />
              Token Budget per Agent
            </h3>
            <div className="space-y-3">
              {agentBudgets.map((ab, i) => {
                const remaining = ab.budget - ab.spent;
                const usagePercent = (ab.spent / ab.budget) * 100;
                return (
                  <motion.div
                    key={ab.agent}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-4 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
                  >
                    <span className="text-xs font-semibold w-24 shrink-0">{ab.agent}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] text-muted-foreground/40">
                          {(ab.spent / 1_000).toFixed(0)}K / {(ab.budget / 1_000).toFixed(0)}K tokens
                        </span>
                        <span className={cn(
                          'text-[10px] font-medium',
                          usagePercent > 80 ? 'text-red-400' : usagePercent > 50 ? 'text-amber' : 'text-emerald-400'
                        )}>
                          {(remaining / 1_000).toFixed(0)}K remaining
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            usagePercent > 80 ? 'bg-red-500' : usagePercent > 50 ? 'bg-amber' : 'bg-emerald-500'
                          )}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                    </div>
                    <Badge variant="outline" className={cn(
                      'text-[9px] w-14 justify-center',
                      usagePercent > 80 ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      usagePercent > 50 ? 'bg-amber/10 text-amber border-amber/20' :
                      'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                    )}>
                      {usagePercent.toFixed(0)}%
                    </Badge>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Agent Routing Rules */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Router className="w-4 h-4 text-blue-400" />
                Agent Routing Rules
              </h3>
              <Button size="sm" className="h-7 text-[11px] bg-amber/20 text-amber hover:bg-amber/30 border border-amber/20">
                <Plus className="w-3 h-3 mr-1" /> Add Rule
              </Button>
            </div>
            <div className="space-y-2">
              {agentRoutingRules.map((rule, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + i * 0.03 }}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
                >
                  <Target className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                  <span className="text-xs font-medium w-40 shrink-0">{rule.taskType}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground/30" />
                  <Badge variant="outline" className="text-[10px] bg-white/[0.03]">
                    {rule.agent}
                  </Badge>
                  <Badge variant="outline" className={cn(
                    'text-[9px] ml-auto',
                    rule.priority === 'High' && 'bg-red-500/10 text-red-400 border-red-500/20',
                    rule.priority === 'Medium' && 'bg-amber/10 text-amber border-amber/20',
                    rule.priority === 'Low' && 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                  )}>
                    {rule.priority}
                  </Badge>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* Security Tab */}
      {activeTab === 'security' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Authentication Settings */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber" />
              Authentication
            </h3>
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
              >
                <div>
                  <p className="text-xs font-medium">Session Timeout</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">Automatically log out after inactivity</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-white/[0.03] font-mono">30 minutes</Badge>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]">
                    <Edit3 className="w-3 h-3 mr-1" /> Change
                  </Button>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
              >
                <div>
                  <p className="text-xs font-medium">Multi-Factor Authentication</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">Require MFA for all team members</p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                    <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Enabled
                  </Badge>
                  <Switch defaultChecked />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
              >
                <div>
                  <p className="text-xs font-medium">Password Policy</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">Minimum requirements for passwords</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-white/[0.03]">12+ chars, uppercase, number, symbol</Badge>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]">
                    <Edit3 className="w-3 h-3 mr-1" /> Edit
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>

          {/* API Access */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Key className="w-4 h-4 text-blue-400" />
                API Access
              </h3>
              <Button size="sm" className="h-7 text-[11px] bg-amber/20 text-amber hover:bg-amber/30 border border-amber/20">
                <Plus className="w-3 h-3 mr-1" /> Create Key
              </Button>
            </div>
            <div className="space-y-2 mb-4">
              {mockApiKeys.map((apiKey, i) => (
                <motion.div
                  key={apiKey.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
                >
                  <Key className="w-3 h-3 text-muted-foreground/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium">{apiKey.name}</span>
                      <Badge variant="outline" className={cn(
                        'text-[9px]',
                        apiKey.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20'
                          : 'bg-red-500/15 text-red-400 border-red-500/20'
                      )}>
                        {apiKey.status}
                      </Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5 font-mono">{apiKey.prefix}••••••••</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[10px] text-muted-foreground/40">Created {apiKey.created}</p>
                    <p className="text-[10px] text-muted-foreground/30">Last used {apiKey.lastUsed}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <Copy className="w-3 h-3 text-muted-foreground/50" />
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-400 hover:text-red-300">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Rate Limiting */}
            <div className="border-t border-border pt-4">
              <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                Rate Limiting
              </label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
                  <span className="text-[11px] text-muted-foreground/60">Requests per minute</span>
                  <Badge variant="outline" className="text-[10px] font-mono bg-white/[0.03]">60</Badge>
                </div>
                <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02]">
                  <span className="text-[11px] text-muted-foreground/60">Requests per day</span>
                  <Badge variant="outline" className="text-[10px] font-mono bg-white/[0.03]">10,000</Badge>
                </div>
              </div>
            </div>
          </div>

          {/* Audit Settings */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-violet-400" />
              Audit Settings
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02]"
              >
                <div>
                  <p className="text-xs font-medium">Retention Period</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">How long audit logs are stored</p>
                </div>
                <Badge variant="outline" className="text-[10px] font-mono bg-white/[0.03]">90 days</Badge>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02]"
              >
                <div>
                  <p className="text-xs font-medium">Export Format</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">Available export options</p>
                </div>
                <div className="flex gap-1.5">
                  <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">CSV</Badge>
                  <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">JSON</Badge>
                  <Badge variant="outline" className="text-[9px] bg-blue-500/10 text-blue-400 border-blue-500/20">PDF</Badge>
                </div>
              </motion.div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <Button size="sm" variant="outline" className="h-7 text-[11px]">
                <Download className="w-3 h-3 mr-1" /> Export Logs
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-[11px]">
                <Eye className="w-3 h-3 mr-1" /> View Logs
              </Button>
            </div>
          </div>

          {/* Data Protection */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              Data Protection
            </h3>
            <div className="space-y-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-emerald-400/60" />
                  <div>
                    <p className="text-xs font-medium">Encryption at Rest</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">AES-256-GCM encryption for stored data</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Active
                </Badge>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-emerald-400/60" />
                  <div>
                    <p className="text-xs font-medium">Encryption in Transit</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">TLS 1.3 for all connections</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-[9px] bg-emerald-500/15 text-emerald-400 border-emerald-500/20">
                  <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Active
                </Badge>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 text-blue-400/60" />
                  <div>
                    <p className="text-xs font-medium">Backup Frequency</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">Automated backups schedule</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono bg-white/[0.03]">Every 6 hours</Badge>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]">
                    <Edit3 className="w-3 h-3 mr-1" /> Change
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Notification Channels */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber" />
              Notification Channels
            </h3>
            <div className="space-y-3">
              {[
                { icon: Mail, label: 'Email', description: 'Receive notifications via email', value: 'team@acme.dev', enabled: true, color: 'text-blue-400' },
                { icon: MessageSquare, label: 'In-App', description: 'Push notifications within the platform', value: 'Active', enabled: true, color: 'text-emerald-400' },
                { icon: Hash, label: 'Slack Webhook', description: 'Post alerts to a Slack channel', value: '#eng-alerts', enabled: true, color: 'text-violet-400' },
              ].map((channel, i) => {
                const Icon = channel.icon;
                return (
                  <motion.div
                    key={channel.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
                  >
                    <Icon className={cn('w-4 h-4 shrink-0', channel.color)} />
                    <div className="flex-1">
                      <p className="text-xs font-medium">{channel.label}</p>
                      <p className="text-[10px] text-muted-foreground/40 mt-0.5">{channel.description}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-white/[0.03] font-mono">{channel.value}</Badge>
                    <Switch defaultChecked={channel.enabled} />
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Event Subscriptions */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-400" />
              Event Subscriptions
            </h3>
            <div className="space-y-2">
              {notificationEvents.map((event, i) => (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
                >
                  <CircleDot className={cn(
                    'w-3 h-3 shrink-0',
                    event.defaultEnabled ? 'text-emerald-400/60' : 'text-muted-foreground/20'
                  )} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs font-medium cursor-pointer">{event.label}</Label>
                      {event.id === 'security_alert' && (
                        <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-400 border-red-500/20">
                          Critical
                        </Badge>
                      )}
                      {event.id === 'decision_required' && (
                        <Badge variant="outline" className="text-[9px] bg-amber/10 text-amber border-amber/20">
                          Action needed
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">{event.description}</p>
                  </div>
                  <Switch defaultChecked={event.defaultEnabled} />
                </motion.div>
              ))}
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <VolumeX className="w-4 h-4 text-violet-400" />
              Quiet Hours
            </h3>
            <div className="space-y-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
              >
                <div>
                  <p className="text-xs font-medium">Enable Quiet Hours</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">Suppress non-critical notifications during off hours</p>
                </div>
                <Switch defaultChecked />
              </motion.div>
              <div className="grid grid-cols-2 gap-3">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02]"
                >
                  <span className="text-[11px] text-muted-foreground/60">Start Time</span>
                  <Badge variant="outline" className="text-[10px] font-mono bg-white/[0.03]">22:00</Badge>
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                  className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02]"
                >
                  <span className="text-[11px] text-muted-foreground/60">End Time</span>
                  <Badge variant="outline" className="text-[10px] font-mono bg-white/[0.03]">08:00</Badge>
                </motion.div>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02]"
              >
                <span className="text-[11px] text-muted-foreground/60">Override for critical alerts</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[9px] bg-red-500/10 text-red-400 border-red-500/20">
                    Security & Build failures always notify
                  </Badge>
                  <Switch defaultChecked />
                </div>
              </motion.div>
            </div>
          </div>

          {/* Notification History Summary */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400" />
              Notification History
            </h3>
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Sent (7d)', value: '142', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
                { label: 'Read', value: '128', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
                { label: 'Unread', value: '14', color: 'text-amber', bg: 'bg-amber/10 border-amber/20' },
                { label: 'Critical', value: '3', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn('rounded-xl border p-3 text-center', stat.bg)}
                >
                  <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider font-medium">{stat.label}</p>
                  <p className={cn('text-xl font-bold mt-1', stat.color)}>{stat.value}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      {/* General Tab */}
      {activeTab === 'general' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Project Info */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-400" />
              Project Information
            </h3>
            <div className="space-y-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  Project Name
                </label>
                <div className="flex items-center gap-2 mt-1.5">
                  {editingName ? (
                    <>
                      <input
                        value={nameValue}
                        onChange={e => setNameValue(e.target.value)}
                        className="flex-1 bg-black/20 border border-amber/30 rounded-lg px-3 py-2 text-xs font-medium outline-none focus:border-amber/50"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSave('name'); if (e.key === 'Escape') { setEditingName(false); setNameValue(project?.name ?? ''); } }}
                      />
                      <Button size="sm" disabled={saving} onClick={() => handleSave('name')} className="h-8 text-[11px] bg-amber/20 text-amber hover:bg-amber/30 border border-amber/20">
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setEditingName(false); setNameValue(project?.name ?? ''); }} className="h-8 text-[11px]">
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 bg-black/20 border border-border rounded-lg px-3 py-2 text-xs font-medium">
                        {project?.name ?? 'Loading...'}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setEditingName(true)} className="h-8 text-[11px]">
                        <Edit3 className="w-3 h-3 mr-1" /> Rename
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
              >
                <label className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
                  Description
                </label>
                <div className="flex items-center gap-2 mt-1.5">
                  {editingDesc ? (
                    <>
                      <textarea
                        value={descValue}
                        onChange={e => setDescValue(e.target.value)}
                        rows={2}
                        className="flex-1 bg-black/20 border border-amber/30 rounded-lg px-3 py-2 text-xs outline-none focus:border-amber/50 resize-none"
                        autoFocus
                        onKeyDown={e => { if (e.key === 'Escape') { setEditingDesc(false); setDescValue(project?.description ?? ''); } }}
                      />
                      <div className="flex flex-col gap-1">
                        <Button size="sm" disabled={saving} onClick={() => handleSave('description')} className="h-7 text-[11px] bg-amber/20 text-amber hover:bg-amber/30 border border-amber/20">
                          {saving ? '...' : 'Save'}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setEditingDesc(false); setDescValue(project?.description ?? ''); }} className="h-7 text-[11px]">
                          Cancel
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 bg-black/20 border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground/60">
                        {project?.description ?? 'No description'}
                      </div>
                      <Button size="sm" variant="outline" onClick={() => setEditingDesc(true)} className="h-8 text-[11px]">
                        <Edit3 className="w-3 h-3 mr-1" /> Edit
                      </Button>
                    </>
                  )}
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="grid grid-cols-3 gap-3"
              >
                <div className="px-3 py-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium">Created</p>
                  <p className="text-xs font-medium mt-1">{project ? new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '...'}</p>
                </div>
                <div className="px-3 py-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium">Last Updated</p>
                  <p className="text-xs font-medium mt-1">{project ? new Date(project.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '...'}</p>
                </div>
                <div className="px-3 py-2.5 rounded-lg bg-white/[0.02]">
                  <p className="text-[10px] text-muted-foreground/40 uppercase tracking-wider font-medium">Project ID</p>
                  <p className="text-xs font-mono text-muted-foreground/50 mt-1 truncate" title={project?.id}>{project?.id ?? '...'}</p>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Theme Preference */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Palette className="w-4 h-4 text-violet-400" />
              Theme Preference
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'System', description: 'Follow OS preference', active: false },
                { label: 'Light', description: 'Light appearance', active: false },
                { label: 'Dark', description: 'Dark appearance', active: true },
              ].map((theme, i) => (
                <motion.button
                  key={theme.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={cn(
                    'flex flex-col items-center gap-2 px-4 py-4 rounded-xl border transition-all text-center',
                    theme.active
                      ? 'bg-amber/10 border-amber/20 text-amber'
                      : 'bg-white/[0.02] border-border hover:border-border/60 text-muted-foreground'
                  )}
                >
                  <Palette className={cn('w-5 h-5', theme.active ? 'text-amber' : 'text-muted-foreground/30')} />
                  <div>
                    <p className="text-xs font-semibold">{theme.label}</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">{theme.description}</p>
                  </div>
                  {theme.active && (
                    <Badge variant="outline" className="text-[9px] bg-amber/10 text-amber border-amber/20">
                      <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Active
                    </Badge>
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Language & Timezone */}
          <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
            <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-400" />
              Language & Timezone
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Languages className="w-3.5 h-3.5 text-blue-400/60" />
                  <div>
                    <p className="text-xs font-medium">Language</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">Display language</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-white/[0.03]">English (US)</Badge>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]">
                    <Edit3 className="w-3 h-3" />
                  </Button>
                </div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-white/[0.02] border border-transparent hover:border-border transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-blue-400/60" />
                  <div>
                    <p className="text-xs font-medium">Timezone</p>
                    <p className="text-[10px] text-muted-foreground/40 mt-0.5">Time display format</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] bg-white/[0.03] font-mono">UTC-8 (PST)</Badge>
                  <Button size="sm" variant="outline" className="h-7 text-[11px]">
                    <Edit3 className="w-3 h-3" />
                  </Button>
                </div>
              </motion.div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-xl border border-red-500/20 bg-red-500/[0.03] p-4">
            <h3 className="text-sm font-semibold mb-1 flex items-center gap-2 text-red-400">
              <AlertOctagon className="w-4 h-4" />
              Danger Zone
            </h3>
            <p className="text-[10px] text-muted-foreground/40 mb-4">Irreversible actions that affect this project</p>
            <div className="space-y-3">
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="flex items-center justify-between px-3 py-3 rounded-lg bg-black/20 border border-red-500/10"
              >
                <div>
                  <p className="text-xs font-medium">Archive Project</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                    Disable the project and hide it from the dashboard. Can be restored later.
                  </p>
                </div>
                <Button size="sm" variant="outline" disabled={archiving} onClick={handleArchive} className="h-7 text-[11px] border-amber/20 text-amber hover:bg-amber/10">
                  <Archive className="w-3 h-3 mr-1" /> {archiving ? 'Archiving...' : 'Archive'}
                </Button>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center justify-between px-3 py-3 rounded-lg bg-black/20 border border-red-500/10"
              >
                <div>
                  <p className="text-xs font-medium">Delete Project</p>
                  <p className="text-[10px] text-muted-foreground/40 mt-0.5">
                    Permanently delete this project and all associated data. This action cannot be undone.
                  </p>
                </div>
                {showDeleteConfirm ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-red-400">Are you sure?</span>
                    <Button size="sm" variant="outline" disabled={deleting} onClick={handleDelete} className="h-7 text-[11px] border-red-500/30 text-red-400 bg-red-500/10 hover:bg-red-500/20">
                      {deleting ? 'Deleting...' : 'Confirm'}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(false)} className="h-7 text-[11px]">
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setShowDeleteConfirm(true)} className="h-7 text-[11px] border-red-500/20 text-red-400 hover:bg-red-500/10">
                    <Trash2 className="w-3 h-3 mr-1" /> Delete
                  </Button>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
