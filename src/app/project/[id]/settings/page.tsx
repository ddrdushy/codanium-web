'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Settings, BrainCircuit, Key, Shield, Bell, Users,
  Globe, Cpu, Zap, CheckCircle2, AlertTriangle,
  ChevronRight, Plus, Trash2, Edit3, ExternalLink,
  DollarSign, Gauge, ToggleLeft
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

type SettingsTab = 'llm' | 'agents' | 'security' | 'notifications' | 'general';

const tabs: { key: SettingsTab; label: string; icon: React.ElementType }[] = [
  { key: 'llm', label: 'LLM Providers', icon: BrainCircuit },
  { key: 'agents', label: 'Agent Config', icon: Cpu },
  { key: 'security', label: 'Security', icon: Shield },
  { key: 'notifications', label: 'Notifications', icon: Bell },
  { key: 'general', label: 'General', icon: Settings },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('llm');
  const [expandedProvider, setExpandedProvider] = useState<string | null>('openai');

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

      {/* Placeholder for other tabs */}
      {activeTab !== 'llm' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center justify-center py-20 text-sm text-muted-foreground/30"
        >
          {activeTab.charAt(0).toUpperCase() + activeTab.slice(1)} settings — coming soon
        </motion.div>
      )}
    </div>
  );
}

function ArrowRight(props: React.SVGProps<SVGSVGElement> & { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}
