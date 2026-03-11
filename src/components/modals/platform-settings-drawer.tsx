'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import {
  Settings, DollarSign, Bell, Sparkles, CheckCircle2, Info,
  Key, Trash2, Plus, Copy, Check as CheckIcon2,
  Zap, Wrench, Eye, EyeOff, Loader2, AlertTriangle, Server,
  Shield, MessageSquare, Save, X,
} from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────────────────────

const PROVIDER_OPTIONS = [
  { id: 'openai', label: 'OpenAI', icon: Zap, description: 'GPT-4o, GPT-4, GPT-3.5 Turbo', defaultModel: 'gpt-4o' },
  { id: 'anthropic', label: 'Anthropic', icon: Sparkles, description: 'Claude Sonnet, Claude Haiku', defaultModel: 'claude-sonnet-4-20250514' },
  { id: 'ollama', label: 'Ollama', icon: Server, description: 'Run models locally — free', defaultModel: 'llama3' },
  { id: 'custom', label: 'Custom', icon: Wrench, description: 'Any OpenAI-compatible endpoint', defaultModel: '' },
] as const;

type ProviderType = typeof PROVIDER_OPTIONS[number]['id'];

const APPROVAL_OPTIONS = [
  { id: 'everything', label: 'Approve everything', description: 'Your AI team asks before every major decision', badge: 'Most control' },
  { id: 'big-stuff', label: 'Just the big stuff', description: 'Only critical decisions need your approval', badge: 'Recommended' },
  { id: 'autonomous', label: 'Let the team handle it', description: 'Your AI team makes most decisions autonomously', badge: 'Fastest' },
] as const;

const COMMUNICATION_OPTIONS = [
  { id: 'simple', label: 'Keep it simple', description: 'Plain language, no jargon' },
  { id: 'detailed', label: 'Give me details', description: 'Include technical info' },
] as const;

const NOTIFICATION_OPTIONS = [
  { id: 'approvals', label: 'Decisions that need my approval', defaultOn: true },
  { id: 'progress', label: 'Major progress updates', defaultOn: true },
  { id: 'attention', label: 'When something needs attention', defaultOn: true },
  { id: 'daily-summary', label: 'Daily summary email', defaultOn: false },
  { id: 'budget-alerts', label: 'Budget alerts', defaultOn: true },
];

const BUDGET_ALERT_OPTIONS = [50, 75, 90];

// ─── Component ─────────────────────────────────────────────────────────────

interface PlatformSettingsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlatformSettingsDrawer({ open, onOpenChange }: PlatformSettingsDrawerProps) {
  // AI Provider state
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

  const [loadingModels, setLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // Budget & Preferences state
  const [monthlyBudget, setMonthlyBudget] = useState(500);
  const [alertThreshold, setAlertThreshold] = useState(75);
  const [approvalLevel, setApprovalLevel] = useState('big-stuff');
  const [commStyle, setCommStyle] = useState('simple');
  const [notifications, setNotifications] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_OPTIONS.map(n => [n.id, n.defaultOn]))
  );
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [savedPrefs, setSavedPrefs] = useState(false);

  // API Keys state
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [apiKeyLimit, setApiKeyLimit] = useState(2);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  // ─── Load data when drawer opens ─────────────────────────────────────────

  useEffect(() => {
    if (!open) return;

    fetch('/api/user/api-keys')
      .then(r => r.json())
      .then(data => {
        if (data.keys) {
          setApiKeys(data.keys);
          setApiKeyLimit(data.limit || 2);
        }
      })
      .catch(() => {});

    fetch('/api/llm/config')
      .then(r => r.json())
      .then(configs => {
        if (Array.isArray(configs) && configs.length > 0) {
          const config = configs[0];
          setExistingConfig(config);
          setSelectedProvider(config.provider as ProviderType);
          setDefaultModel(config.defaultModel);
          setBaseUrl(config.baseUrl || '');
        }
      })
      .catch(() => {});

    fetch('/api/user/preferences')
      .then(r => r.json())
      .then(prefs => {
        if (prefs && !prefs.error) {
          setApprovalLevel(prefs.approvalLevel || 'big-stuff');
          setCommStyle(prefs.communicationStyle || 'simple');
          setMonthlyBudget(prefs.monthlyBudget ?? 500);
          setAlertThreshold(prefs.alertThreshold ?? 75);
          setNotifications({
            approvals: prefs.notifyApprovals ?? true,
            progress: prefs.notifyProgress ?? true,
            attention: prefs.notifyAttention ?? true,
            'daily-summary': prefs.notifyDailySummary ?? false,
            'budget-alerts': prefs.notifyBudgetAlerts ?? true,
          });
        }
      })
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!existingConfig || selectedProvider !== existingConfig.provider) {
      const provider = PROVIDER_OPTIONS.find(p => p.id === selectedProvider);
      if (provider) setDefaultModel(provider.defaultModel);
      setTestStatus('idle');
      setTestMessage('');
      setAvailableModels([]);
    }
  }, [selectedProvider, existingConfig]);

  // ─── Handlers ──────────────────────────────────────────────────────────

  async function testConnection() {
    setTestStatus('testing');
    setTestMessage('');
    try {
      const res = await fetch('/api/llm/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKey || undefined,
          baseUrl: baseUrl || undefined,
          defaultModel,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus('success');
        setTestMessage(data.message || 'Connection successful!');
      } else {
        setTestStatus('error');
        setTestMessage(data.message || data.error || 'Connection failed');
      }
    } catch {
      setTestStatus('error');
      setTestMessage('Network error');
    }
  }

  async function saveProvider() {
    setSavingProvider(true);
    setSavedProvider(false);
    try {
      if (existingConfig?.id) {
        await fetch(`/api/llm/config?id=${existingConfig.id}`, { method: 'DELETE' });
      }
      const res = await fetch('/api/llm/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKey.trim() || undefined,
          baseUrl: baseUrl.trim() || undefined,
          defaultModel: defaultModel.trim(),
        }),
      });
      if (res.ok) {
        const newConfig = await res.json();
        setExistingConfig(newConfig);
        setSavedProvider(true);
        setApiKey('');
        setTimeout(() => setSavedProvider(false), 3000);
      }
    } catch {} finally {
      setSavingProvider(false);
    }
  }

  async function savePreferences() {
    setSavingPrefs(true);
    setSavedPrefs(false);
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approvalLevel,
          communicationStyle: commStyle,
          monthlyBudget,
          alertThreshold,
          notifyApprovals: notifications.approvals,
          notifyProgress: notifications.progress,
          notifyAttention: notifications.attention,
          notifyDailySummary: notifications['daily-summary'],
          notifyBudgetAlerts: notifications['budget-alerts'],
        }),
      });
      if (res.ok) {
        setSavedPrefs(true);
        setTimeout(() => setSavedPrefs(false), 3000);
      }
    } catch {} finally {
      setSavingPrefs(false);
    }
  }

  async function generateApiKeyHandler() {
    setGeneratingKey(true);
    setNewRawKey(null);
    try {
      const res = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `VS Code — ${new Date().toLocaleDateString()}`, scopes: ['read', 'write'] }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewRawKey(data.rawKey);
        setApiKeys(prev => [{ id: data.id, name: data.name, keyPrefix: data.keyPrefix, scopes: data.scopes, createdAt: data.createdAt, lastUsedAt: null }, ...prev]);
      }
    } catch {} finally {
      setGeneratingKey(false);
    }
  }

  async function revokeApiKey(keyId: string) {
    setRevokingId(keyId);
    try {
      const res = await fetch(`/api/user/api-keys/${keyId}`, { method: 'DELETE' });
      if (res.ok) {
        setApiKeys(prev => prev.filter(k => k.id !== keyId));
      }
    } catch {} finally {
      setRevokingId(null);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-background border-l border-border shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 h-14 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center">
                  <Settings className="w-4 h-4 text-amber" />
                </div>
                <h2 className="text-base font-bold tracking-tight">Platform Settings</h2>
              </div>
              <button
                onClick={() => onOpenChange(false)}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content (scrollable) */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-7">

              {/* ─── AI Provider ──────────────────────────────────────────── */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber" />
                    <h3 className="text-sm font-semibold">AI Provider</h3>
                    {existingConfig && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                        {existingConfig.provider}
                      </span>
                    )}
                  </div>
                  <Button
                    onClick={saveProvider}
                    disabled={savingProvider}
                    size="sm"
                    className="gap-1.5 h-7 text-xs bg-amber text-background hover:bg-amber/90"
                  >
                    {savingProvider ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : savedProvider ? (
                      <><CheckCircle2 className="w-3 h-3" /> Saved</>
                    ) : (
                      <><Save className="w-3 h-3" /> Save</>
                    )}
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {PROVIDER_OPTIONS.map(({ id, label, icon: Icon, description }) => (
                    <button
                      key={id}
                      onClick={() => setSelectedProvider(id)}
                      className={cn(
                        'flex flex-col items-start gap-1.5 p-3 rounded-xl border text-left transition-all',
                        selectedProvider === id
                          ? 'border-amber bg-amber/10 shadow-sm shadow-amber/10'
                          : 'border-border bg-[var(--surface)] hover:border-amber/30',
                      )}
                    >
                      <div className="flex items-center gap-1.5">
                        <Icon className={cn('w-4 h-4', selectedProvider === id ? 'text-amber' : 'text-muted-foreground')} />
                        <span className={cn('text-xs font-semibold', selectedProvider === id ? 'text-amber' : '')}>{label}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground leading-tight">{description}</span>
                    </button>
                  ))}
                </div>

                {selectedProvider !== 'ollama' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">API Key</label>
                    <div className="relative">
                      <Input
                        type={showApiKey ? 'text' : 'password'}
                        placeholder={
                          existingConfig?.apiKey ? existingConfig.apiKey
                          : selectedProvider === 'openai' ? 'sk-...'
                          : selectedProvider === 'anthropic' ? 'sk-ant-...'
                          : 'Enter your API key'
                        }
                        value={apiKey}
                        onChange={(e) => setApiKey(e.target.value)}
                        className="pr-10 h-9 text-xs bg-foreground/[0.03] border-border focus:border-amber/30"
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                      >
                        {showApiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[9px] text-muted-foreground/50">Encrypted with AES-256-GCM at rest.</p>
                  </div>
                )}

                {(selectedProvider === 'ollama' || selectedProvider === 'custom') && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-muted-foreground">Base URL</label>
                    <Input
                      type="url"
                      placeholder={selectedProvider === 'ollama' ? 'http://localhost:11434' : 'https://your-endpoint.com/v1'}
                      value={baseUrl}
                      onChange={(e) => setBaseUrl(e.target.value)}
                      className="h-9 text-xs bg-foreground/[0.03] border-border focus:border-amber/30"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground">Model</label>
                  <div className="flex items-center gap-2">
                    {availableModels.length > 0 ? (
                      <select
                        value={defaultModel}
                        onChange={(e) => setDefaultModel(e.target.value)}
                        className="flex-1 h-9 px-3 text-xs rounded-md border border-border bg-foreground/[0.03] text-foreground focus:border-amber/30 focus:outline-none cursor-pointer"
                      >
                        <option value="">Select a model...</option>
                        {availableModels.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    ) : (
                      <span className="flex-1 h-9 flex items-center px-3 text-xs text-muted-foreground/50 rounded-md border border-border bg-foreground/[0.03] italic">
                        {defaultModel || 'Click Load Models →'}
                      </span>
                    )}
                    <Button
                      onClick={async () => {
                        setLoadingModels(true);
                        setAvailableModels([]);
                        try {
                          const res = await fetch('/api/llm/test', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              provider: selectedProvider,
                              apiKey: apiKey || undefined,
                              baseUrl: baseUrl || undefined,
                            }),
                          });
                          const data = await res.json();
                          if (res.ok && data.success && data.models?.length) {
                            setAvailableModels(data.models);
                            if (!defaultModel || !data.models.includes(defaultModel)) {
                              setDefaultModel(data.models[0]);
                            }
                            setTestStatus('success');
                            setTestMessage(`${data.models.length} model(s) loaded`);
                          } else {
                            setTestStatus('error');
                            setTestMessage(data.message || 'Could not load models');
                          }
                        } catch {
                          setTestStatus('error');
                          setTestMessage('Network error');
                        }
                        setLoadingModels(false);
                      }}
                      disabled={loadingModels || (!apiKey.trim() && selectedProvider !== 'ollama')}
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs shrink-0 gap-1.5"
                    >
                      {loadingModels ? (
                        <><Loader2 className="w-3 h-3 animate-spin" /> Loading...</>
                      ) : (
                        <><Server className="w-3 h-3" /> Load Models</>
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    onClick={testConnection}
                    disabled={testStatus === 'testing' || (!apiKey.trim() && selectedProvider !== 'ollama')}
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                  >
                    {testStatus === 'testing' ? (
                      <><Loader2 className="w-3 h-3 animate-spin mr-1.5" /> Testing...</>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                  {testStatus === 'success' && (
                    <span className="flex items-center gap-1 text-[11px] text-emerald-500">
                      <CheckCircle2 className="w-3 h-3" /> {testMessage}
                    </span>
                  )}
                  {testStatus === 'error' && (
                    <span className="flex items-center gap-1 text-[11px] text-red-400">
                      <AlertTriangle className="w-3 h-3" /> {testMessage}
                    </span>
                  )}
                </div>

                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    <span className="font-medium text-blue-400">No API key?</span>{' '}
                    Works in demo mode with simulated AI responses.
                  </p>
                </div>
              </section>

              <div className="border-t border-border" />

              {/* ─── Budget ───────────────────────────────────────────────── */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-amber" />
                    <h3 className="text-sm font-semibold">Budget & Spending</h3>
                  </div>
                  <Button
                    onClick={savePreferences}
                    disabled={savingPrefs}
                    size="sm"
                    className="gap-1.5 h-7 text-xs bg-amber text-background hover:bg-amber/90"
                  >
                    {savingPrefs ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : savedPrefs ? (
                      <><CheckCircle2 className="w-3 h-3" /> Saved</>
                    ) : (
                      <><Save className="w-3 h-3" /> Save Preferences</>
                    )}
                  </Button>
                </div>

                <div className="p-3.5 rounded-xl bg-[var(--surface)] border border-border space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Monthly Budget</span>
                    <span className="text-base font-bold text-amber">${monthlyBudget}</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={5000}
                    step={50}
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(Number(e.target.value))}
                    className="w-full h-1.5 bg-border rounded-full appearance-none cursor-pointer accent-amber"
                  />
                  <div className="flex justify-between text-[9px] text-muted-foreground/50">
                    <span>$100</span>
                    <span>$5,000</span>
                  </div>
                  <div className="flex items-center justify-between pt-2.5 border-t border-border">
                    <span className="text-[11px] text-muted-foreground">Alert me at</span>
                    <div className="flex gap-1">
                      {BUDGET_ALERT_OPTIONS.map(pct => (
                        <button
                          key={pct}
                          onClick={() => setAlertThreshold(pct)}
                          className={cn(
                            'px-2 py-0.5 rounded-md text-[11px] font-medium transition-all',
                            alertThreshold === pct
                              ? 'bg-amber text-background'
                              : 'bg-foreground/[0.04] text-muted-foreground hover:bg-foreground/[0.08]',
                          )}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <div className="border-t border-border" />

              {/* ─── Approval Level ────────────────────────────────────────── */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-amber" />
                  <h3 className="text-sm font-semibold">Approval Level</h3>
                </div>
                <div className="space-y-1.5">
                  {APPROVAL_OPTIONS.map(({ id, label, description, badge }) => (
                    <button
                      key={id}
                      onClick={() => setApprovalLevel(id)}
                      className={cn(
                        'w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all',
                        approvalLevel === id
                          ? 'border-amber bg-amber/10'
                          : 'border-border bg-[var(--surface)] hover:border-amber/20',
                      )}
                    >
                      <div>
                        <p className={cn('text-xs font-medium', approvalLevel === id && 'text-amber')}>{label}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
                      </div>
                      <span className={cn(
                        'text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ml-2',
                        approvalLevel === id ? 'bg-amber/20 text-amber' : 'bg-foreground/[0.04] text-muted-foreground/60',
                      )}>
                        {badge}
                      </span>
                    </button>
                  ))}
                </div>
              </section>

              <div className="border-t border-border" />

              {/* ─── Communication Style ───────────────────────────────────── */}
              <section className="space-y-3">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-amber" />
                  <h3 className="text-sm font-semibold">Communication Style</h3>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {COMMUNICATION_OPTIONS.map(({ id, label, description }) => (
                    <button
                      key={id}
                      onClick={() => setCommStyle(id)}
                      className={cn(
                        'p-3 rounded-xl border text-left transition-all',
                        commStyle === id
                          ? 'border-amber bg-amber/10'
                          : 'border-border bg-[var(--surface)] hover:border-amber/20',
                      )}
                    >
                      <p className={cn('text-xs font-medium', commStyle === id && 'text-amber')}>{label}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>
                    </button>
                  ))}
                </div>
              </section>

              <div className="border-t border-border" />

              {/* ─── Notifications ─────────────────────────────────────────── */}
              <section className="space-y-3 pb-4">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber" />
                  <h3 className="text-sm font-semibold">Email Notifications</h3>
                </div>
                <div className="space-y-0.5">
                  {NOTIFICATION_OPTIONS.map(({ id, label }) => (
                    <div
                      key={id}
                      className="flex items-center justify-between py-2 px-2.5 rounded-lg hover:bg-foreground/[0.02] transition-colors"
                    >
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <Switch
                        checked={notifications[id] ?? false}
                        onCheckedChange={(checked) =>
                          setNotifications(prev => ({ ...prev, [id]: checked }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </section>

              <div className="border-t border-border" />

              {/* ─── API Keys (VS Code & API Access) ─────────────────────── */}
              <section className="space-y-4 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber" />
                    <h3 className="text-sm font-semibold">VS Code & API Access</h3>
                  </div>
                  <Button
                    onClick={generateApiKeyHandler}
                    disabled={generatingKey || apiKeys.length >= apiKeyLimit}
                    size="sm"
                    className="gap-1.5 h-7 text-xs bg-amber text-background hover:bg-amber/90"
                  >
                    {generatingKey ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <><Plus className="w-3 h-3" /> Generate Key</>
                    )}
                  </Button>
                </div>

                <p className="text-[10px] text-muted-foreground/60">
                  API keys let you connect the VS Code extension or external tools to AI Team Studio.
                  {' '}{apiKeys.length}/{apiKeyLimit} keys used.
                </p>

                {/* Newly generated key (shown only once) */}
                {newRawKey && (
                  <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-medium text-emerald-400">API Key Generated</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Copy this key now — it won't be shown again.</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-[10px] bg-background/50 px-2.5 py-1.5 rounded-lg border border-border font-mono truncate">
                        {newRawKey}
                      </code>
                      <Button
                        onClick={() => copyToClipboard(newRawKey)}
                        size="sm"
                        variant="outline"
                        className="h-7 w-7 p-0 shrink-0"
                      >
                        {copiedKey ? <CheckIcon2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                )}

                {/* Existing keys */}
                <div className="space-y-1.5">
                  {apiKeys.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground/40">
                      <Key className="w-6 h-6 mx-auto mb-2 opacity-30" />
                      <p className="text-xs">No API keys yet</p>
                      <p className="text-[10px] mt-0.5">Generate one to connect VS Code</p>
                    </div>
                  ) : (
                    apiKeys.map(key => (
                      <div
                        key={key.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-[var(--surface)] border border-border"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium truncate">{key.name}</span>
                            <code className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/[0.04] text-muted-foreground font-mono">
                              {key.keyPrefix}...
                            </code>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground/50">
                            <span>Created {new Date(key.createdAt).toLocaleDateString()}</span>
                            {key.lastUsedAt && (
                              <>
                                <span>·</span>
                                <span>Last used {new Date(key.lastUsedAt).toLocaleDateString()}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => revokeApiKey(key.id)}
                          disabled={revokingId === key.id}
                          className="p-1.5 rounded-md text-muted-foreground/30 hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                          title="Revoke key"
                        >
                          {revokingId === key.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* VS Code quick connect */}
                <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/10">
                  <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                  <p className="text-[10px] text-muted-foreground leading-relaxed">
                    <span className="font-medium text-blue-400">Quick connect:</span>{' '}
                    Install the AI Team Studio VS Code extension, click "Login", and you'll be redirected here to auto-connect.
                  </p>
                </div>
              </section>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
