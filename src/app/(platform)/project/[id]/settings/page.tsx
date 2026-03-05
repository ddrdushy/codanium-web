'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Settings, DollarSign, Bell, Palette, Sparkles, CheckCircle2, Info,
  Zap, Wrench, Eye, EyeOff, Loader2, AlertTriangle, Server, XCircle,
} from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
  '#f59e0b', '#ef4444', '#3b82f6', '#10b981',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

const APPROVAL_OPTIONS = [
  { id: 'everything', label: 'Approve everything', description: 'Your AI team will ask before every major decision', badge: 'Most control' },
  { id: 'big-stuff', label: 'Just the big stuff', description: 'Only critical decisions need your approval', badge: 'Recommended' },
  { id: 'autonomous', label: 'Let the team handle it', description: 'Your AI team makes most decisions autonomously', badge: 'Fastest' },
] as const;

const COMMUNICATION_OPTIONS = [
  { id: 'simple', label: 'Keep it simple', description: 'Explanations in plain language, no technical jargon' },
  { id: 'detailed', label: 'Give me the details', description: 'Include technical information when relevant' },
] as const;

const NOTIFICATION_OPTIONS = [
  { id: 'approvals', label: 'Decisions that need my approval', defaultOn: true },
  { id: 'progress', label: 'Major progress updates', defaultOn: true },
  { id: 'attention', label: 'When something needs attention', defaultOn: true },
  { id: 'daily-summary', label: 'Daily summary email', defaultOn: false },
  { id: 'budget-alerts', label: 'Budget alerts', defaultOn: true },
];

const SPENDING_CATEGORIES = [
  { label: 'Planning', amount: 42, color: 'bg-blue-500' },
  { label: 'Building', amount: 128, color: 'bg-emerald-500' },
  { label: 'Testing', amount: 36, color: 'bg-violet-500' },
  { label: 'Infrastructure', amount: 19, color: 'bg-amber' },
];

const BUDGET_ALERT_OPTIONS = ['50%', '75%', '90%'];

const PROVIDER_OPTIONS = [
  { id: 'openai', label: 'OpenAI', icon: Zap, description: 'GPT-4o, GPT-4, GPT-3.5 Turbo', defaultModel: 'gpt-4o' },
  { id: 'anthropic', label: 'Anthropic', icon: Sparkles, description: 'Claude Sonnet, Claude Haiku', defaultModel: 'claude-sonnet-4-20250514' },
  { id: 'ollama', label: 'Ollama', icon: Server, description: 'Run models locally — free', defaultModel: 'llama3' },
  { id: 'custom', label: 'Custom', icon: Wrench, description: 'Any OpenAI-compatible endpoint', defaultModel: '' },
] as const;

type ProviderType = typeof PROVIDER_OPTIONS[number]['id'];

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

export default function SettingsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectColor, setProjectColor] = useState(PROJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [approvalLevel, setApprovalLevel] = useState<string>('big-stuff');
  const [commStyle, setCommStyle] = useState<string>('simple');
  const [monthlyBudget, setMonthlyBudget] = useState(500);
  const [alertThreshold, setAlertThreshold] = useState('75%');
  const currentSpend = SPENDING_CATEGORIES.reduce((s, c) => s + c.amount, 0);
  const spendPercent = Math.min((currentSpend / monthlyBudget) * 100, 100);
  const [notifications, setNotifications] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_OPTIONS.map(n => [n.id, n.defaultOn]))
  );

  // AI Provider (BYOM) state
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('openai');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [defaultModel, setDefaultModel] = useState('gpt-4o');
  const [showApiKey, setShowApiKey] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [existingConfig, setExistingConfig] = useState<any | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);
  const [savedProvider, setSavedProvider] = useState(false);

  useEffect(() => {
    fetch(`/api/projects/${projectId}`)
      .then(r => r.json())
      .then(data => {
        setProjectName(data.name ?? '');
        setProjectDesc(data.description ?? '');
        if (data.color) setProjectColor(data.color);
      })
      .catch(() => {});
  }, [projectId]);

  // Load existing LLM config on mount
  useEffect(() => {
    fetch(`/api/projects/${projectId}/llm/config`)
      .then(r => r.json())
      .then(data => {
        if (data && data.provider) {
          setExistingConfig(data);
          setSelectedProvider(data.provider);
          setApiKey(data.apiKey ?? '');
          setBaseUrl(data.baseUrl ?? '');
          setDefaultModel(data.model ?? '');
        }
      })
      .catch(() => {});
  }, [projectId]);

  const handleProviderChange = (provider: ProviderType) => {
    setSelectedProvider(provider);
    setTestStatus('idle');
    setTestMessage('');
    const option = PROVIDER_OPTIONS.find(p => p.id === provider);
    setDefaultModel(option?.defaultModel ?? '');
    if (provider === 'ollama') {
      setBaseUrl('http://localhost:11434');
      setApiKey('');
    } else if (provider === 'custom') {
      setBaseUrl('');
    } else {
      setBaseUrl('');
    }
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const res = await fetch('/api/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey,
          baseUrl,
          model: defaultModel,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus('success');
        setTestMessage(data.modelsCount ? `Connected! ${data.modelsCount} models available.` : 'Connected!');
      } else {
        setTestStatus('error');
        setTestMessage(data.error ?? 'Connection failed. Check your configuration.');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Connection failed. Check your configuration.');
    }
  };

  const handleSaveProviderConfig = async () => {
    setSavingProvider(true);
    try {
      await fetch(`/api/projects/${projectId}/llm/config`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey,
          baseUrl,
          model: defaultModel,
        }),
      });
      setSavedProvider(true);
      setTimeout(() => setSavedProvider(false), 2000);
    } catch { /* silently fail */ }
    finally { setSavingProvider(false); }
  };

  const showApiKeyInput = selectedProvider !== 'ollama';
  const showBaseUrlInput = selectedProvider === 'ollama' || selectedProvider === 'custom';

  const handleSaveProject = async () => {
    setSaving(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description: projectDesc,
          color: projectColor,
        }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch { /* silently fail */ }
    finally { setSaving(false); }
  };

  const toggleNotification = (id: string) =>
    setNotifications(prev => ({ ...prev, [id]: !prev[id] }));

  return (
    <div className="p-6 max-w-3xl mx-auto pb-20">
      {/* Page Header */}
      <motion.div {...fadeUp}>
        <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="w-5 h-5 text-amber" />
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your project details, preferences, and notifications
        </p>
      </motion.div>

      <div className="mt-8 space-y-8">
        {/* ─── Section 1: Project Details ──────────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.05 }}>
          <div className="rounded-xl border border-border bg-[var(--surface-raised)] p-6">
            <div className="flex items-center gap-2 mb-1">
              <Info className="w-4 h-4 text-amber" />
              <h2 className="text-lg font-bold text-foreground">Project Details</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Basic information about your project</p>

            <div className="space-y-5">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="project-name" className="text-sm font-medium">Project Name</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={e => setProjectName(e.target.value)}
                  placeholder="My awesome project"
                  className="bg-[var(--surface)] border-border"
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="project-desc" className="text-sm font-medium">Description</Label>
                <Textarea
                  id="project-desc"
                  value={projectDesc}
                  onChange={e => setProjectDesc(e.target.value)}
                  placeholder="What is this project about?"
                  rows={3}
                  className="bg-[var(--surface)] border-border resize-none"
                />
              </div>

              {/* Color Picker */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                  Project Color
                </Label>
                <div className="flex items-center gap-2.5">
                  {PROJECT_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setProjectColor(color)}
                      className={cn(
                        'w-8 h-8 rounded-full transition-all border-2',
                        projectColor === color
                          ? 'border-white scale-110 shadow-lg'
                          : 'border-transparent hover:scale-105'
                      )}
                      style={{ backgroundColor: color }}
                      aria-label={`Select color ${color}`}
                    />
                  ))}
                </div>
              </div>

              {/* Save */}
              <div className="pt-2">
                <Button
                  onClick={handleSaveProject}
                  disabled={saving}
                  className="bg-amber text-black hover:bg-amber/90 font-medium"
                >
                  {saved ? (
                    <span className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Saved!
                    </span>
                  ) : saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ─── Section 2: Your Preferences ─────────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.1 }}>
          <div className="rounded-xl border border-border bg-[var(--surface-raised)] p-6">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-amber" />
              <h2 className="text-lg font-bold text-foreground">Your Preferences</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Control how your AI team works and communicates with you
            </p>

            {/* Approval Level */}
            <div className="mb-6">
              <Label className="text-sm font-medium mb-3 block">Approval Level</Label>
              <div className="space-y-2.5">
                {APPROVAL_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setApprovalLevel(option.id)}
                    className={cn(
                      'w-full text-left rounded-xl border px-4 py-3.5 transition-all',
                      approvalLevel === option.id
                        ? 'border-amber/40 bg-amber/5'
                        : 'border-border bg-[var(--surface)] hover:border-border/80'
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                          approvalLevel === option.id
                            ? 'border-amber'
                            : 'border-muted-foreground/30'
                        )}>
                          {approvalLevel === option.id && (
                            <div className="w-2 h-2 rounded-full bg-amber" />
                          )}
                        </div>
                        <div>
                          <p className={cn(
                            'text-sm font-medium',
                            approvalLevel === option.id ? 'text-foreground' : 'text-muted-foreground'
                          )}>
                            {option.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                        </div>
                      </div>
                      {option.badge === 'Recommended' && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber/15 text-amber border border-amber/20">
                          {option.badge}
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border my-6" />

            {/* Communication Style */}
            <div>
              <Label className="text-sm font-medium mb-3 block">Communication Style</Label>
              <div className="grid grid-cols-2 gap-3">
                {COMMUNICATION_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    onClick={() => setCommStyle(option.id)}
                    className={cn(
                      'text-left rounded-xl border px-4 py-3.5 transition-all',
                      commStyle === option.id
                        ? 'border-amber/40 bg-amber/5'
                        : 'border-border bg-[var(--surface)] hover:border-border/80'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                        commStyle === option.id
                          ? 'border-amber'
                          : 'border-muted-foreground/30'
                      )}>
                        {commStyle === option.id && (
                          <div className="w-2 h-2 rounded-full bg-amber" />
                        )}
                      </div>
                      <div>
                        <p className={cn(
                          'text-sm font-medium',
                          commStyle === option.id ? 'text-foreground' : 'text-muted-foreground'
                        )}>
                          {option.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* ─── Section 3: AI Provider (BYOM) ──────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.12 }}>
          <div className="rounded-xl border border-border bg-[var(--surface-raised)] p-6">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-amber" />
              <h2 className="text-lg font-bold text-foreground">AI Provider</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Connect your own model provider to power your AI team
            </p>

            {/* Demo Mode Banner */}
            {!existingConfig && (
              <div className="flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 mb-6">
                <AlertTriangle className="w-4 h-4 text-amber mt-0.5 shrink-0" />
                <p className="text-sm text-amber">
                  Your AI team is running in demo mode. Connect a model provider to get real AI responses.
                </p>
              </div>
            )}

            {/* Provider Selection */}
            <div className="mb-6">
              <Label className="text-sm font-medium mb-3 block">Provider</Label>
              <div className="grid grid-cols-2 gap-3">
                {PROVIDER_OPTIONS.map(option => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.id}
                      onClick={() => handleProviderChange(option.id)}
                      className={cn(
                        'text-left rounded-xl border px-4 py-3.5 transition-all',
                        selectedProvider === option.id
                          ? 'border-amber/40 bg-amber/5'
                          : 'border-border bg-[var(--surface)] hover:border-border/80'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors',
                          selectedProvider === option.id
                            ? 'border-amber'
                            : 'border-muted-foreground/30'
                        )}>
                          {selectedProvider === option.id && (
                            <div className="w-2 h-2 rounded-full bg-amber" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Icon className={cn(
                            'w-4 h-4',
                            selectedProvider === option.id ? 'text-amber' : 'text-muted-foreground'
                          )} />
                          <div>
                            <p className={cn(
                              'text-sm font-medium',
                              selectedProvider === option.id ? 'text-foreground' : 'text-muted-foreground'
                            )}>
                              {option.label}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border my-6" />

            {/* API Key */}
            {showApiKeyInput && (
              <div className="space-y-2 mb-5">
                <Label htmlFor="api-key" className="text-sm font-medium">API Key</Label>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showApiKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={e => setApiKey(e.target.value)}
                    placeholder={selectedProvider === 'openai' ? 'sk-...' : selectedProvider === 'anthropic' ? 'sk-ant-...' : 'Your API key'}
                    className="bg-[var(--surface)] border-border pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">Your key is stored encrypted and never shared</p>
              </div>
            )}

            {/* Base URL */}
            {showBaseUrlInput && (
              <div className="space-y-2 mb-5">
                <Label htmlFor="base-url" className="text-sm font-medium">Base URL</Label>
                <Input
                  id="base-url"
                  value={baseUrl}
                  onChange={e => setBaseUrl(e.target.value)}
                  placeholder={selectedProvider === 'ollama' ? 'http://localhost:11434' : 'https://your-endpoint.com/v1'}
                  className="bg-[var(--surface)] border-border"
                />
              </div>
            )}

            {/* Model Selector */}
            <div className="space-y-2 mb-6">
              <Label htmlFor="default-model" className="text-sm font-medium">Model</Label>
              <Input
                id="default-model"
                value={defaultModel}
                onChange={e => setDefaultModel(e.target.value)}
                placeholder={selectedProvider === 'custom' ? 'Enter model name' : undefined}
                className="bg-[var(--surface)] border-border"
              />
            </div>

            {/* Test Connection Result */}
            {testStatus === 'success' && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 mb-5">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-sm text-emerald-400">{testMessage}</p>
              </div>
            )}
            {testStatus === 'error' && (
              <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 mb-5">
                <XCircle className="w-4 h-4 text-red-500 shrink-0" />
                <p className="text-sm text-red-400">{testMessage}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-2">
              <Button
                onClick={handleTestConnection}
                disabled={testStatus === 'testing'}
                variant="outline"
                className="border-border text-foreground hover:bg-white/5"
              >
                {testStatus === 'testing' ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" /> Testing...
                  </span>
                ) : 'Test Connection'}
              </Button>
              <Button
                onClick={handleSaveProviderConfig}
                disabled={savingProvider}
                className="bg-amber text-black hover:bg-amber/90 font-medium"
              >
                {savedProvider ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Saved!
                  </span>
                ) : savingProvider ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </motion.section>

        {/* ─── Section 4: Budget & Spending ─────────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.18 }}>
          <div className="rounded-xl border border-border bg-[var(--surface-raised)] p-6">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-amber" />
              <h2 className="text-lg font-bold text-foreground">Budget & Spending</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Track costs and set spending limits</p>

            <div className="space-y-6">
              {/* Monthly Budget */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Monthly Budget</Label>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min={100}
                    max={5000}
                    step={50}
                    value={monthlyBudget}
                    onChange={e => setMonthlyBudget(Number(e.target.value))}
                    className="flex-1 accent-amber-500 h-2 bg-white/10 rounded-full cursor-pointer"
                  />
                  <div className="bg-[var(--surface)] border border-border rounded-lg px-3 py-1.5 min-w-[80px] text-center">
                    <span className="text-sm font-bold text-foreground">${monthlyBudget}</span>
                    <span className="text-xs text-muted-foreground">/mo</span>
                  </div>
                </div>
              </div>

              {/* Current Spending */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Current Spending This Month</Label>
                  <span className="text-sm font-semibold text-foreground">
                    ${currentSpend} <span className="text-muted-foreground font-normal">of ${monthlyBudget}</span>
                  </span>
                </div>
                <div className="h-3 bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      spendPercent > 90 ? 'bg-red-500' : spendPercent > 70 ? 'bg-amber' : 'bg-emerald-500'
                    )}
                    style={{ width: `${spendPercent}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{spendPercent.toFixed(0)}% of monthly budget used</p>
              </div>

              {/* Alert Threshold */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium">Notify me when spending reaches</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Get an alert before hitting your limit</p>
                </div>
                <div className="flex items-center gap-1.5">
                  {BUDGET_ALERT_OPTIONS.map(opt => (
                    <button
                      key={opt}
                      onClick={() => setAlertThreshold(opt)}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-xs font-medium transition-all border',
                        alertThreshold === opt
                          ? 'bg-amber/15 text-amber border-amber/30'
                          : 'bg-[var(--surface)] text-muted-foreground border-border hover:border-border/80'
                      )}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div className="border-t border-border" />

              {/* Cost Breakdown */}
              <div>
                <Label className="text-sm font-medium mb-3 block">Cost Breakdown</Label>
                <div className="space-y-3">
                  {SPENDING_CATEGORIES.map(cat => {
                    const catPercent = monthlyBudget > 0 ? (cat.amount / monthlyBudget) * 100 : 0;
                    return (
                      <div key={cat.label} className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-24">{cat.label}</span>
                        <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full transition-all', cat.color)}
                            style={{ width: `${catPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium text-foreground w-14 text-right">${cat.amount}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ─── Section 5: Notifications ─────────────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.24 }}>
          <div className="rounded-xl border border-border bg-[var(--surface-raised)] p-6">
            <div className="flex items-center gap-2 mb-1">
              <Bell className="w-4 h-4 text-amber" />
              <h2 className="text-lg font-bold text-foreground">Notifications</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Choose what updates you want to receive
            </p>

            <div className="space-y-1">
              {NOTIFICATION_OPTIONS.map((option, i) => (
                <motion.div
                  key={option.id}
                  {...fadeUp}
                  transition={{ delay: 0.22 + i * 0.03 }}
                  className="flex items-center justify-between px-4 py-3.5 rounded-xl hover:bg-white/[0.02] transition-colors"
                >
                  <Label
                    htmlFor={`notif-${option.id}`}
                    className="text-sm font-medium cursor-pointer flex-1"
                  >
                    {option.label}
                  </Label>
                  <Switch
                    id={`notif-${option.id}`}
                    checked={notifications[option.id]}
                    onCheckedChange={() => toggleNotification(option.id)}
                  />
                </motion.div>
              ))}
            </div>
          </div>
        </motion.section>
      </div>
    </div>
  );
}
