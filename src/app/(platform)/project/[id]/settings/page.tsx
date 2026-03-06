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
  GitBranch, Globe, Copy, RefreshCw, Plus, Trash2, Send,
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

  // Git Integration state
  const [gitRepoOwner, setGitRepoOwner] = useState('');
  const [gitRepoName, setGitRepoName] = useState('');
  const [gitToken, setGitToken] = useState('');
  const [gitHasToken, setGitHasToken] = useState(false);
  const [gitSyncEnabled, setGitSyncEnabled] = useState(false);
  const [gitWebhookSecret, setGitWebhookSecret] = useState('');
  const [gitLastSyncAt, setGitLastSyncAt] = useState<string | null>(null);
  const [showGitToken, setShowGitToken] = useState(false);
  const [savingGit, setSavingGit] = useState(false);
  const [savedGit, setSavedGit] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Webhooks state
  const [webhookEndpoints, setWebhookEndpoints] = useState<any[]>([]);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [newWebhookUrl, setNewWebhookUrl] = useState('');
  const [newWebhookDesc, setNewWebhookDesc] = useState('');
  const [newWebhookSecret, setNewWebhookSecret] = useState<string | null>(null);
  const [addingWebhook, setAddingWebhook] = useState(false);
  const [testingWebhookId, setTestingWebhookId] = useState<string | null>(null);

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

  // Load git config on mount
  useEffect(() => {
    fetch(`/api/projects/${projectId}/git/config`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setGitRepoOwner(data.repoOwner ?? '');
          setGitRepoName(data.repoName ?? '');
          setGitHasToken(data.hasToken ?? false);
          setGitSyncEnabled(data.syncEnabled ?? false);
          setGitWebhookSecret(data.webhookSecret ?? '');
          setGitLastSyncAt(data.lastSyncAt ?? null);
        }
      })
      .catch(() => {});
  }, [projectId]);

  // Load webhook endpoints on mount
  useEffect(() => {
    fetch(`/api/projects/${projectId}/webhooks`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setWebhookEndpoints(data);
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

  // ── Git Integration Handlers ──────────────────────────────────────────

  const handleSaveGitConfig = async () => {
    setSavingGit(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/git/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: 'github',
          repoOwner: gitRepoOwner,
          repoName: gitRepoName,
          token: gitToken || undefined,
          syncEnabled: gitSyncEnabled,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setGitHasToken(data.hasToken ?? false);
        setGitWebhookSecret(data.webhookSecret ?? '');
        setGitLastSyncAt(data.lastSyncAt ?? null);
        setGitToken(''); // Clear token input after save
        setSavedGit(true);
        setTimeout(() => setSavedGit(false), 2000);
      }
    } catch { /* silently fail */ }
    finally { setSavingGit(false); }
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch(`/api/projects/${projectId}/git/sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage('Sync started! Data will update shortly.');
        setTimeout(() => setSyncMessage(''), 5000);
      } else {
        setSyncMessage(data.error ?? 'Sync failed');
      }
    } catch {
      setSyncMessage('Failed to trigger sync');
    }
    finally { setSyncing(false); }
  };

  const handleCopyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
  };

  // ── Webhook Handlers ──────────────────────────────────────────────────

  const handleAddWebhook = async () => {
    setAddingWebhook(true);
    setNewWebhookSecret(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newWebhookUrl,
          events: ['*'],
          description: newWebhookDesc,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setNewWebhookSecret(data.secret);
        setWebhookEndpoints(prev => [{ ...data, secret: '***', deliveries: [] }, ...prev]);
        setNewWebhookUrl('');
        setNewWebhookDesc('');
      }
    } catch { /* silently fail */ }
    finally { setAddingWebhook(false); }
  };

  const handleDeleteWebhook = async (endpointId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/webhooks?id=${endpointId}`, { method: 'DELETE' });
      setWebhookEndpoints(prev => prev.filter(ep => ep.id !== endpointId));
    } catch { /* silently fail */ }
  };

  const handleTestWebhook = async (endpointId: string) => {
    setTestingWebhookId(endpointId);
    try {
      const res = await fetch(`/api/projects/${projectId}/webhooks/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpointId }),
      });
      const data = await res.json();
      // Refresh endpoints to show new delivery
      const epRes = await fetch(`/api/projects/${projectId}/webhooks`);
      const epData = await epRes.json();
      if (Array.isArray(epData)) setWebhookEndpoints(epData);
    } catch { /* silently fail */ }
    finally { setTestingWebhookId(null); }
  };

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

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

        {/* ─── Section 4: Git Integration ───────────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.15 }}>
          <div className="rounded-xl border border-border bg-[var(--surface-raised)] p-6">
            <div className="flex items-center gap-2 mb-1">
              <GitBranch className="w-4 h-4 text-amber" />
              <h2 className="text-lg font-bold text-foreground">Git Integration</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Connect a GitHub repository to sync branches, PRs, and releases
            </p>

            {/* Repository Owner */}
            <div className="space-y-2 mb-5">
              <Label htmlFor="git-repo-owner" className="text-sm font-medium">Repository Owner</Label>
              <Input
                id="git-repo-owner"
                value={gitRepoOwner}
                onChange={e => setGitRepoOwner(e.target.value)}
                placeholder="acme-corp"
                className="bg-[var(--surface)] border-border"
              />
            </div>

            {/* Repository Name */}
            <div className="space-y-2 mb-5">
              <Label htmlFor="git-repo-name" className="text-sm font-medium">Repository Name</Label>
              <Input
                id="git-repo-name"
                value={gitRepoName}
                onChange={e => setGitRepoName(e.target.value)}
                placeholder="my-app"
                className="bg-[var(--surface)] border-border"
              />
            </div>

            {/* Personal Access Token */}
            <div className="space-y-2 mb-5">
              <Label htmlFor="git-token" className="text-sm font-medium">Personal Access Token</Label>
              <div className="relative">
                <Input
                  id="git-token"
                  type={showGitToken ? 'text' : 'password'}
                  value={gitToken}
                  onChange={e => setGitToken(e.target.value)}
                  placeholder={gitHasToken ? '••••••••••••••••' : 'ghp_...'}
                  className="bg-[var(--surface)] border-border pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowGitToken(!showGitToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showGitToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                {gitHasToken ? 'Token is saved. Enter a new one to update.' : 'Your token is encrypted at rest (AES-256-GCM)'}
              </p>
            </div>

            {/* Auto-Sync Toggle */}
            <div className="flex items-center justify-between px-1 py-3 mb-5">
              <div>
                <Label htmlFor="git-sync" className="text-sm font-medium">Auto-Sync</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Sync every 15 minutes automatically</p>
              </div>
              <Switch
                id="git-sync"
                checked={gitSyncEnabled}
                onCheckedChange={setGitSyncEnabled}
              />
            </div>

            {/* Webhook Info (read-only) */}
            {gitWebhookSecret && (
              <>
                <div className="border-t border-border my-5" />
                <div className="space-y-3">
                  <Label className="text-sm font-medium">GitHub Webhook Configuration</Label>
                  <p className="text-xs text-muted-foreground">
                    Configure a GitHub webhook to receive push/PR events in real-time
                  </p>

                  {/* Webhook URL */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={`${appUrl}/api/webhooks/github`}
                      readOnly
                      className="bg-[var(--surface)] border-border text-xs font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border shrink-0"
                      onClick={() => handleCopyToClipboard(`${appUrl}/api/webhooks/github`)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>

                  {/* Webhook Secret */}
                  <div className="flex items-center gap-2">
                    <Input
                      value={gitWebhookSecret}
                      readOnly
                      type="password"
                      className="bg-[var(--surface)] border-border text-xs font-mono"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="border-border shrink-0"
                      onClick={() => handleCopyToClipboard(gitWebhookSecret)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Sync Status */}
            {syncMessage && (
              <div className="flex items-center gap-2 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 my-4">
                <Info className="w-4 h-4 text-amber shrink-0" />
                <p className="text-sm text-amber">{syncMessage}</p>
              </div>
            )}

            {gitLastSyncAt && (
              <p className="text-xs text-muted-foreground mt-3">
                Last synced: {new Date(gitLastSyncAt).toLocaleString()}
              </p>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4">
              <Button
                onClick={handleSyncNow}
                disabled={syncing || !gitHasToken}
                variant="outline"
                className="border-border text-foreground hover:bg-white/5"
              >
                {syncing ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" /> Syncing...
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <RefreshCw className="w-4 h-4" /> Sync Now
                  </span>
                )}
              </Button>
              <Button
                onClick={handleSaveGitConfig}
                disabled={savingGit}
                className="bg-amber text-black hover:bg-amber/90 font-medium"
              >
                {savedGit ? (
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> Saved!
                  </span>
                ) : savingGit ? 'Saving...' : 'Save Configuration'}
              </Button>
            </div>
          </div>
        </motion.section>

        {/* ─── Section 5: Webhooks (Outbound) ──────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.17 }}>
          <div className="rounded-xl border border-border bg-[var(--surface-raised)] p-6">
            <div className="flex items-center gap-2 mb-1">
              <Globe className="w-4 h-4 text-amber" />
              <h2 className="text-lg font-bold text-foreground">Webhooks</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Forward project events to external endpoints
            </p>

            {/* Existing Endpoints */}
            {webhookEndpoints.length > 0 && (
              <div className="space-y-3 mb-5">
                {webhookEndpoints.map(ep => (
                  <div
                    key={ep.id}
                    className="rounded-xl border border-border bg-[var(--surface)] p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                          'w-2 h-2 rounded-full shrink-0',
                          ep.enabled ? 'bg-emerald-500' : 'bg-muted-foreground/30'
                        )} />
                        <span className="text-sm font-mono text-foreground truncate">{ep.url}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border text-xs h-7 px-2"
                          onClick={() => handleTestWebhook(ep.id)}
                          disabled={testingWebhookId === ep.id}
                        >
                          {testingWebhookId === ep.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Send className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-border text-xs h-7 px-2 text-red-400 hover:text-red-300"
                          onClick={() => handleDeleteWebhook(ep.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                    {ep.description && (
                      <p className="text-xs text-muted-foreground mb-2">{ep.description}</p>
                    )}
                    {/* Recent deliveries */}
                    {ep.deliveries && ep.deliveries.length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2">
                        {ep.deliveries.slice(0, 5).map((d: any) => (
                          <div
                            key={d.id}
                            title={`${d.eventType} — ${d.success ? d.statusCode : d.error} (${d.duration}ms)`}
                            className={cn(
                              'w-5 h-5 rounded text-[9px] font-bold flex items-center justify-center',
                              d.success
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-red-500/20 text-red-400'
                            )}
                          >
                            {d.success ? d.statusCode : '!'}
                          </div>
                        ))}
                        <span className="text-[10px] text-muted-foreground ml-1">recent deliveries</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Secret Banner (shown once after adding) */}
            {newWebhookSecret && (
              <div className="flex items-start gap-3 rounded-xl border border-amber/30 bg-amber/10 px-4 py-3 mb-5">
                <AlertTriangle className="w-4 h-4 text-amber mt-0.5 shrink-0" />
                <div>
                  <p className="text-sm text-amber font-medium mb-1">Copy your webhook secret — it will only be shown once</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono text-amber/80 bg-amber/5 px-2 py-1 rounded">
                      {newWebhookSecret}
                    </code>
                    <button
                      onClick={() => handleCopyToClipboard(newWebhookSecret)}
                      className="text-amber hover:text-amber/80"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Add Webhook Form */}
            {showAddWebhook ? (
              <div className="space-y-3 rounded-xl border border-border bg-[var(--surface)] p-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-url" className="text-sm font-medium">Endpoint URL</Label>
                  <Input
                    id="webhook-url"
                    value={newWebhookUrl}
                    onChange={e => setNewWebhookUrl(e.target.value)}
                    placeholder="https://example.com/webhooks"
                    className="bg-[var(--surface-raised)] border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="webhook-desc" className="text-sm font-medium">Description (optional)</Label>
                  <Input
                    id="webhook-desc"
                    value={newWebhookDesc}
                    onChange={e => setNewWebhookDesc(e.target.value)}
                    placeholder="Slack notifications, CI trigger, etc."
                    className="bg-[var(--surface-raised)] border-border"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    onClick={handleAddWebhook}
                    disabled={addingWebhook || !newWebhookUrl}
                    className="bg-amber text-black hover:bg-amber/90 font-medium text-sm"
                  >
                    {addingWebhook ? (
                      <span className="flex items-center gap-1.5">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Adding...
                      </span>
                    ) : 'Add Webhook'}
                  </Button>
                  <Button
                    variant="outline"
                    className="border-border text-sm"
                    onClick={() => { setShowAddWebhook(false); setNewWebhookSecret(null); }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                className="border-border text-foreground hover:bg-white/5"
                onClick={() => setShowAddWebhook(true)}
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add Webhook Endpoint
              </Button>
            )}
          </div>
        </motion.section>

        {/* ─── Section 6: Budget & Spending ─────────────────────────────── */}
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
