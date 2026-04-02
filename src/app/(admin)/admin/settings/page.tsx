'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Shield,
  Zap,
  ToggleLeft,
  Cpu,
  Check,
  Mail,
  Send,
  Loader2,
  CreditCard,
  AlertTriangle,
  CheckCircle2,
  Bot,
  X,
  Plus,
  ArrowUp,
  ArrowDown,
  Pencil,
  Save,
  GripVertical,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { fetchAdminSettings, saveAdminSettings } from '@/lib/api';

// ─── Animation variants ───
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

// ─── Section header component ───
function SectionHeader({
  icon,
  title,
  subtitle,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <div
        className="flex items-center justify-center w-9 h-9 rounded-full"
        style={{ backgroundColor: color + '15' }}
      >
        <div style={{ color }}>{icon}</div>
      </div>
      <div>
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
    </div>
  );
}

// ─── Settings field row ───
function SettingField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

// ─── Agent options for override dropdown ───
const AGENT_OPTIONS = [
  { shortName: 'BA', name: 'Business Analyst' },
  { shortName: 'SA', name: 'Solution Architect' },
  { shortName: 'UX', name: 'UI/UX Designer' },
  { shortName: 'PM', name: 'Product Manager' },
  { shortName: 'TL', name: 'Tech Lead' },
  { shortName: 'JD', name: 'Junior Developer' },
  { shortName: 'SD', name: 'Senior Developer' },
  { shortName: 'QA', name: 'QA Engineer' },
  { shortName: 'DO', name: 'DevOps Engineer' },
  { shortName: 'PE', name: 'Platform Engineer' },
  { shortName: 'AT', name: 'Automation Tester' },
  { shortName: 'PF', name: 'Performance Engineer' },
  { shortName: 'IE', name: 'Integration Engineer' },
  { shortName: 'SM', name: 'Secrets Manager' },
  { shortName: 'SR', name: 'Site Reliability' },
  { shortName: 'SEC', name: 'Security' },
  { shortName: 'ORC', name: 'Orchestrator' },
  { shortName: 'STC', name: 'State Controller' },
  { shortName: 'DEC', name: 'Decision Controller' },
  { shortName: 'AUD', name: 'Audit Gatekeeper' },
  { shortName: 'LLM', name: 'LLM Gateway Manager' },
  { shortName: 'PRE', name: 'Prompt Engineer' },
  { shortName: 'CA', name: 'Cost Analyst' },
];

export default function SettingsPage() {
  const [isLiveData, setIsLiveData] = useState(false);

  // ─── LLM Configuration state ───
  const [defaultProvider, setDefaultProvider] = useState('anthropic');
  const [defaultModel, setDefaultModel] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [llmApiKey, setLlmApiKey] = useState('');
  const [showLlmApiKey, setShowLlmApiKey] = useState(false);
  const [maxTokens, setMaxTokens] = useState('4096');
  const [temperature, setTemperature] = useState('0.7');
  const [testingLlm, setTestingLlm] = useState(false);
  const [testLlmStatus, setTestLlmStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [testLlmMessage, setTestLlmMessage] = useState('');
  const [loadingModels, setLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  // ─── Feature Flags state ───
  const [featureFlags, setFeatureFlags] = useState({
    agentChat: true,
    boardDragDrop: true,
    decisionApprovals: true,
    vsCodeIntegration: true,
    gitIntegration: false,
    webhooks: false,
  });

  // ─── Email Configuration state ───
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailMailjetApiKey, setEmailMailjetApiKey] = useState('');
  const [emailMailjetSecretKey, setEmailMailjetSecretKey] = useState('');
  const [emailFromAddress, setEmailFromAddress] = useState('noreply@yourdomain.com');
  const [emailFromName, setEmailFromName] = useState('Codanium');
  const [emailWebhookToken, setEmailWebhookToken] = useState('');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [registeringWebhooks, setRegisteringWebhooks] = useState(false);
  const [registerWebhookStatus, setRegisterWebhookStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [registerWebhookMessage, setRegisterWebhookMessage] = useState('');
  const [emailAnalytics, setEmailAnalytics] = useState<any>(null);

  // ─── Stripe Configuration state ───
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');

  // ─── Security state ───
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [ipAllowlist, setIpAllowlist] = useState(false);

  // ─── Ollama token rates state ───
  const [ollamaPromptRate, setOllamaPromptRate] = useState('0');
  const [ollamaCompletionRate, setOllamaCompletionRate] = useState('0');

  // ─── Billing state ───
  const [markupPercent, setMarkupPercent] = useState('15');
  const [freeCreditsAmount, setFreeCreditsAmount] = useState('5');
  const [freeCreditsExpiryDays, setFreeCreditsExpiryDays] = useState('14');

  // ─── LLM Fallback Chain state ───
  const [fallbackProviders, setFallbackProviders] = useState<Array<{ id?: string; provider: string; displayName: string; defaultModel: string; baseUrl: string; priority: number; isActive: boolean }>>([]);
  // Provider → default base URL mapping
  const PROVIDER_URLS: Record<string, string> = {
    openai: 'https://api.openai.com/v1',
    anthropic: '',
    ollama: 'http://localhost:11434',
    mistral: 'https://api.mistral.ai/v1',
    nvidia: 'https://integrate.api.nvidia.com/v1',
    groq: 'https://api.groq.com/openai/v1',
    together: 'https://api.together.xyz/v1',
    openrouter: 'https://openrouter.ai/api/v1',
    deepseek: 'https://api.deepseek.com/v1',
    byteplus: 'https://ark.ap-southeast.bytepluses.com/api/v3',
    custom: '',
  };

  const [showFallbackForm, setShowFallbackForm] = useState(false);
  const [newFallback, setNewFallback] = useState({ provider: 'anthropic', apiKey: '', baseUrl: '', defaultModel: '', priority: 1 });
  const [savingFallback, setSavingFallback] = useState(false);
  const [fbLoadingModels, setFbLoadingModels] = useState(false);
  const [fbAvailableModels, setFbAvailableModels] = useState<string[]>([]);
  const [fbShowApiKey, setFbShowApiKey] = useState(false);
  const [fbTestStatus, setFbTestStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [fbTestMessage, setFbTestMessage] = useState('');
  const [fbTestingLlm, setFbTestingLlm] = useState(false);
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<{ defaultModel: string; apiKey: string }>({ defaultModel: '', apiKey: '' });
  const [savingEdit, setSavingEdit] = useState(false);

  const moveProvider = async (index: number, direction: 'up' | 'down') => {
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= fallbackProviders.length) return;
    const updated = [...fallbackProviders];
    // Swap priorities
    const tempPriority = updated[index].priority;
    updated[index] = { ...updated[index], priority: updated[swapIndex].priority };
    updated[swapIndex] = { ...updated[swapIndex], priority: tempPriority };
    // Sort by priority
    updated.sort((a, b) => a.priority - b.priority);
    setFallbackProviders(updated);
    try {
      await fetch('/api/admin/llm-providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          updates: updated.map((p) => ({ id: p.id, priority: p.priority })),
        }),
      });
    } catch { /* silent */ }
  };

  const saveProviderEdit = async (fp: typeof fallbackProviders[0]) => {
    setSavingEdit(true);
    try {
      const res = await fetch('/api/admin/llm-providers', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: fp.id,
          defaultModel: editingValues.defaultModel,
          ...(editingValues.apiKey ? { apiKey: editingValues.apiKey } : {}),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFallbackProviders((prev) =>
          prev.map((p) => (p.id === fp.id ? { ...p, ...data } : p))
        );
        setEditingProviderId(null);
      }
    } catch { /* silent */ }
    setSavingEdit(false);
  };

  // ─── Agent Override state ───
  const [agentOverrides, setAgentOverrides] = useState<Array<{ id?: string; agentShortName: string; provider: string; model: string; baseUrl: string }>>([]);
  const [savingOverrides, setSavingOverrides] = useState(false);
  const [savedOverrides, setSavedOverrides] = useState(false);

  // ─── Save state ───
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // ─── Load settings from API on mount ───
  useEffect(() => {
    fetchAdminSettings()
      .then((settings) => {
        setIsLiveData(true);
        if (settings['llm.defaultProvider']) {
          setDefaultProvider(settings['llm.defaultProvider']);
        }
        if (settings['llm.maxTokens'] !== undefined) {
          setMaxTokens(String(settings['llm.maxTokens']));
        }
        if (settings['llm.temperature'] !== undefined) {
          setTemperature(String(settings['llm.temperature']));
        }
        if (settings['llm.defaultModel']) {
          setDefaultModel(settings['llm.defaultModel']);
        }
        if (settings['llm.baseUrl']) {
          setBaseUrl(settings['llm.baseUrl']);
        }
        if (settings['llm.apiKey']) {
          // Show masked version — actual key is encrypted in DB
          setLlmApiKey(settings['llm.apiKey']);
        }
        if (settings['featureFlags']) {
          const ff = settings['featureFlags'];
          setFeatureFlags((prev) => ({
            agentChat: ff.agentChat ?? prev.agentChat,
            boardDragDrop: ff.boardDragDrop ?? prev.boardDragDrop,
            decisionApprovals: ff.decisionApprovals ?? prev.decisionApprovals,
            vsCodeIntegration: ff.vsCodeIntegration ?? prev.vsCodeIntegration,
            gitIntegration: ff.gitIntegration ?? prev.gitIntegration,
            webhooks: ff.webhooks ?? prev.webhooks,
          }));
        }
        // Email settings
        if (settings['email.enabled'] !== undefined) {
          setEmailEnabled(settings['email.enabled']);
        }
        if (settings['email.mailjetApiKey']) {
          setEmailMailjetApiKey(settings['email.mailjetApiKey']);
        }
        if (settings['email.mailjetSecretKey']) {
          setEmailMailjetSecretKey(settings['email.mailjetSecretKey']);
        }
        if (settings['email.fromAddress']) {
          setEmailFromAddress(settings['email.fromAddress']);
        }
        if (settings['email.fromName']) {
          setEmailFromName(settings['email.fromName']);
        }
        if (settings['email.mailjetWebhookToken']) {
          setEmailWebhookToken(settings['email.mailjetWebhookToken']);
        }
        // Stripe settings
        if (settings['stripe.enabled'] !== undefined) {
          setStripeEnabled(settings['stripe.enabled']);
        }
        if (settings['stripe.secretKey']) {
          setStripeSecretKey(settings['stripe.secretKey']);
        }
        if (settings['stripe.webhookSecret']) {
          setStripeWebhookSecret(settings['stripe.webhookSecret']);
        }
        if (settings['security.twoFactorAuth'] !== undefined) {
          setTwoFactorAuth(settings['security.twoFactorAuth']);
        }
        if (settings['security.ipAllowlist'] !== undefined) {
          setIpAllowlist(settings['security.ipAllowlist']);
        }
        // Ollama token rates
        if (settings['llm.ollama.promptRatePer1KTokens'] !== undefined) {
          setOllamaPromptRate(String(settings['llm.ollama.promptRatePer1KTokens']));
        }
        if (settings['llm.ollama.completionRatePer1KTokens'] !== undefined) {
          setOllamaCompletionRate(String(settings['llm.ollama.completionRatePer1KTokens']));
        }
        // Billing settings
        if (settings['billing.markupPercent'] !== undefined) {
          setMarkupPercent(String(settings['billing.markupPercent']));
        }
        if (settings['billing.freeCreditsAmount'] !== undefined) {
          setFreeCreditsAmount(String(settings['billing.freeCreditsAmount']));
        }
        if (settings['billing.freeCreditsExpiryDays'] !== undefined) {
          setFreeCreditsExpiryDays(String(settings['billing.freeCreditsExpiryDays']));
        }
      })
      .catch(() => {/* keep defaults */});

    // Load agent overrides
    fetch('/api/admin/agent-llm-config')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setAgentOverrides(data); })
      .catch(() => {});

    // Load platform fallback providers
    fetch('/api/admin/llm-providers')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setFallbackProviders(data); })
      .catch(() => {});
  }, []);

  // Auto-fill base URL and reset models when provider changes
  const PROVIDER_DEFAULTS: Record<string, { baseUrl: string; placeholder: string }> = {
    anthropic: { baseUrl: '', placeholder: 'https://api.anthropic.com' },
    openai:    { baseUrl: '', placeholder: 'https://api.openai.com/v1' },
    ollama:    { baseUrl: 'http://host.docker.internal:11434', placeholder: 'http://localhost:11434' },
    mistral:   { baseUrl: 'https://api.mistral.ai/v1', placeholder: 'https://api.mistral.ai/v1' },
    nvidia:    { baseUrl: 'https://integrate.api.nvidia.com/v1', placeholder: 'https://integrate.api.nvidia.com/v1' },
    groq:      { baseUrl: 'https://api.groq.com/openai/v1', placeholder: 'https://api.groq.com/openai/v1' },
    together:  { baseUrl: 'https://api.together.xyz/v1', placeholder: 'https://api.together.xyz/v1' },
    custom:    { baseUrl: '', placeholder: 'https://your-endpoint.com/v1' },
  };

  useEffect(() => {
    setAvailableModels([]);
    setDefaultModel('');
    const defaults = PROVIDER_DEFAULTS[defaultProvider];
    if (defaults?.baseUrl) {
      setBaseUrl(defaults.baseUrl);
    }
  }, [defaultProvider]);

  const toggleFeature = (key: keyof typeof featureFlags) => {
    setFeatureFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Save handler ───
  const [saveError, setSaveError] = useState('');

  const handleSave = async () => {
    if (!isLiveData) {
      setSaveError('Cannot save — not authenticated. Please log in as admin first.');
      setSaveStatus('error');
      return;
    }
    setSaving(true);
    setSaveStatus('idle');
    setSaveError('');
    try {
      await saveAdminSettings({
        'llm.defaultProvider': defaultProvider,
        'llm.defaultModel': defaultModel,
        'llm.baseUrl': baseUrl,
        'llm.apiKey': llmApiKey,
        'llm.maxTokens': Number(maxTokens),
        'llm.temperature': Number(temperature),
        featureFlags,
        'email.enabled': emailEnabled,
        'email.mailjetApiKey': emailMailjetApiKey,
        'email.mailjetSecretKey': emailMailjetSecretKey,
        'email.fromAddress': emailFromAddress,
        'email.fromName': emailFromName,
        'stripe.enabled': stripeEnabled,
        'stripe.secretKey': stripeSecretKey,
        'stripe.webhookSecret': stripeWebhookSecret,
        'security.twoFactorAuth': twoFactorAuth,
        'security.ipAllowlist': ipAllowlist,
        'llm.ollama.promptRatePer1KTokens': Number(ollamaPromptRate),
        'llm.ollama.completionRatePer1KTokens': Number(ollamaCompletionRate),
        'billing.markupPercent': Number(markupPercent),
        'billing.freeCreditsAmount': Number(freeCreditsAmount),
        'billing.freeCreditsExpiryDays': Number(freeCreditsExpiryDays),
      });
      setSaveStatus('saved');
      setSaveError('');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (err: any) {
      setSaveStatus('error');
      setSaveError(err?.message?.includes('401') ? 'Session expired — please log in again' : 'Failed to save settings');
      setTimeout(() => setSaveStatus('idle'), 5000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-4xl"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Settings</h1>
          {!isLiveData && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
              Demo Data
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {isLiveData ? 'Platform configuration and preferences' : 'Showing sample data — log in as admin for live metrics'}
        </p>
      </motion.div>

      {/* LLM Configuration */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Cpu className="w-4 h-4" />}
          title="LLM Configuration"
          subtitle="Default model and parameter settings"
          color="#0d9488"
        />
        <div className="space-y-0">
          <SettingField label="Default Provider">
            <select
              value={defaultProvider}
              onChange={(e) => {
                const p = e.target.value;
                setDefaultProvider(p);
                setBaseUrl(PROVIDER_URLS[p] || '');
                setAvailableModels([]);
                setDefaultModel('');
              }}
              className="h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50 cursor-pointer"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="ollama">Ollama</option>
              <option value="mistral">Mistral</option>
              <option value="nvidia">NVIDIA NIM</option>
              <option value="groq">Groq</option>
              <option value="together">Together AI</option>
              <option value="openrouter">OpenRouter</option>
              <option value="deepseek">DeepSeek</option>
              <option value="byteplus">BytePlus ModelArk</option>
              <option value="custom">Custom</option>
            </select>
          </SettingField>
          {['ollama', 'mistral', 'nvidia', 'groq', 'together', 'custom', 'openai', 'anthropic'].includes(defaultProvider) && (
            <SettingField label="Base URL">
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder={PROVIDER_DEFAULTS[defaultProvider]?.placeholder || 'https://api.example.com/v1'}
                className="w-52 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
              />
            </SettingField>
          )}
          {defaultProvider !== 'ollama' && (
            <SettingField label="API Key">
              <div className="flex items-center gap-2">
                <input
                  type={showLlmApiKey ? 'text' : 'password'}
                  value={llmApiKey}
                  onChange={(e) => setLlmApiKey(e.target.value)}
                  placeholder={defaultProvider === 'openai' ? 'sk-...' : defaultProvider === 'anthropic' ? 'sk-ant-...' : 'API key'}
                  className="w-80 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50 font-mono"
                />
                <button
                  onClick={() => setShowLlmApiKey(!showLlmApiKey)}
                  className="h-8 px-2 rounded-md border border-border bg-background text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showLlmApiKey ? 'Hide' : 'Show'}
                </button>
              </div>
            </SettingField>
          )}
          <SettingField label="Default Model">
            <div className="flex items-center gap-2">
              {availableModels.length > 0 ? (
                <select
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className="w-64 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50 cursor-pointer"
                >
                  <option value="">Select a model...</option>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  placeholder="e.g. gpt-4o, claude-3-opus, codestral-22b"
                  className="w-64 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50 font-mono"
                />
              )}
              <Button
                variant="outline"
                size="sm"
                disabled={loadingModels || (!baseUrl.trim() && (defaultProvider === 'ollama' || defaultProvider === 'custom'))}
                onClick={async () => {
                  setLoadingModels(true);
                  setAvailableModels([]);
                  try {
                    const res = await fetch('/api/llm/test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        provider: defaultProvider,
                        apiKey: llmApiKey || undefined,
                        baseUrl: baseUrl || undefined,
                      }),
                    });
                    const data = await res.json();
                    if (res.ok && data.success && data.models?.length) {
                      setAvailableModels(data.models);
                      if (!defaultModel || !data.models.includes(defaultModel)) {
                        setDefaultModel(data.models[0]);
                      }
                    } else {
                      setTestLlmStatus('error');
                      setTestLlmMessage(data.message || 'Could not load models');
                      setTimeout(() => { setTestLlmStatus('idle'); setTestLlmMessage(''); }, 5000);
                    }
                  } catch {
                    setTestLlmStatus('error');
                    setTestLlmMessage('Network error loading models');
                    setTimeout(() => { setTestLlmStatus('idle'); setTestLlmMessage(''); }, 5000);
                  }
                  setLoadingModels(false);
                }}
                className="gap-1 shrink-0"
              >
                {loadingModels ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</>
                ) : (
                  <><Cpu className="w-3.5 h-3.5" /> Load Models</>
                )}
              </Button>
            </div>
          </SettingField>
          <SettingField label="Max Tokens per Request">
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              className="w-24 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
          <SettingField label="Temperature">
            <input
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              step="0.1"
              min="0"
              max="2"
              className="w-20 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
          {defaultProvider === 'ollama' && (
            <>
              <SettingField label="Ollama Prompt Rate (per 1K tokens, $)">
                <input
                  type="number"
                  value={ollamaPromptRate}
                  onChange={(e) => setOllamaPromptRate(e.target.value)}
                  step="0.0001"
                  min="0"
                  placeholder="0"
                  className="w-28 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
                />
              </SettingField>
              <SettingField label="Ollama Completion Rate (per 1K tokens, $)">
                <input
                  type="number"
                  value={ollamaCompletionRate}
                  onChange={(e) => setOllamaCompletionRate(e.target.value)}
                  step="0.0001"
                  min="0"
                  placeholder="0"
                  className="w-28 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
                />
              </SettingField>
            </>
          )}
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">Test Connection</span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={testingLlm || !defaultModel.trim()}
                onClick={async () => {
                  setTestingLlm(true);
                  setTestLlmStatus('idle');
                  setTestLlmMessage('');
                  try {
                    const res = await fetch('/api/llm/test', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        provider: defaultProvider,
                        apiKey: llmApiKey || undefined,
                        baseUrl: baseUrl || undefined,
                        defaultModel: defaultModel.trim(),
                      }),
                    });
                    const data = await res.json();
                    if (res.ok && data.success) {
                      setTestLlmStatus('success');
                      setTestLlmMessage(data.message || 'Connected!');
                    } else {
                      setTestLlmStatus('error');
                      setTestLlmMessage(data.message || 'Connection failed');
                    }
                  } catch {
                    setTestLlmStatus('error');
                    setTestLlmMessage('Network error');
                  }
                  setTestingLlm(false);
                  setTimeout(() => { setTestLlmStatus('idle'); setTestLlmMessage(''); }, 8000);
                }}
                className="gap-1.5"
                style={{
                  borderColor: testLlmStatus === 'success' ? '#10b981' : testLlmStatus === 'error' ? '#ef4444' : undefined,
                  color: testLlmStatus === 'success' ? '#10b981' : testLlmStatus === 'error' ? '#ef4444' : undefined,
                }}
              >
                {testingLlm ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing...</>
                ) : testLlmStatus === 'success' ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> Connected</>
                ) : testLlmStatus === 'error' ? (
                  <><AlertTriangle className="w-3.5 h-3.5" /> Failed</>
                ) : (
                  'Test Connection'
                )}
              </Button>
              {testLlmMessage && testLlmStatus !== 'idle' && (
                <span className={`text-[11px] max-w-[200px] truncate ${testLlmStatus === 'success' ? 'text-emerald-500' : 'text-red-400'}`}>
                  {testLlmMessage}
                </span>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* LLM Provider Fallback Chain */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Zap className="w-4 h-4" />}
          title="LLM Provider Fallback Chain"
          subtitle="Configure multi-provider fallback for high availability"
          color="#f97316"
        />
        <div className="space-y-3">
          {fallbackProviders.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border/30">
                    <th className="w-16 text-left py-2 pr-1 font-medium">Order</th>
                    <th className="text-left py-2 pr-2 font-medium">Provider</th>
                    <th className="text-left py-2 pr-2 font-medium">Model</th>
                    <th className="text-left py-2 pr-2 font-medium">Status</th>
                    <th className="w-24"></th>
                  </tr>
                </thead>
                <tbody>
                  {fallbackProviders.map((fp, idx) => (
                    <tr key={fp.id} className="border-b border-border/20 last:border-0 group">
                      <td className="py-2 pr-1">
                        <div className="flex items-center gap-0.5">
                          <div className="flex flex-col">
                            <button
                              onClick={() => moveProvider(idx, 'up')}
                              disabled={idx === 0}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                              title="Move up"
                            >
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => moveProvider(idx, 'down')}
                              disabled={idx === fallbackProviders.length - 1}
                              className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                              title="Move down"
                            >
                              <ArrowDown className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-500/10 text-orange-500 text-xs font-bold">
                            {fp.priority}
                          </span>
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        <div>
                          <span className="font-medium text-foreground">{fp.displayName || fp.provider}</span>
                          {fp.baseUrl && (
                            <span className="block text-xs text-muted-foreground truncate max-w-[200px]">{fp.baseUrl}</span>
                          )}
                        </div>
                      </td>
                      <td className="py-2 pr-2">
                        {editingProviderId === fp.id ? (
                          <div className="space-y-1">
                            <input
                              type="text"
                              value={editingValues.defaultModel}
                              onChange={(e) => setEditingValues((prev) => ({ ...prev, defaultModel: e.target.value }))}
                              className="w-48 h-7 px-2 rounded border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                              placeholder="Model name"
                            />
                            <input
                              type="password"
                              value={editingValues.apiKey}
                              onChange={(e) => setEditingValues((prev) => ({ ...prev, apiKey: e.target.value }))}
                              className="w-48 h-7 px-2 rounded border border-border bg-background text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                              placeholder="New API key (leave blank to keep)"
                            />
                          </div>
                        ) : (
                          <span className="font-mono text-xs bg-muted px-2 py-1 rounded">{fp.defaultModel}</span>
                        )}
                      </td>
                      <td className="py-2 pr-2">
                        <button
                          onClick={async () => {
                            const updated = fallbackProviders.map((p) =>
                              p.id === fp.id ? { ...p, isActive: !p.isActive } : p
                            );
                            setFallbackProviders(updated);
                            try {
                              await fetch('/api/admin/llm-providers', {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: fp.id, isActive: !fp.isActive }),
                              });
                            } catch { /* silent */ }
                          }}
                          className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                            fp.isActive
                              ? 'bg-emerald-500/10 text-emerald-500'
                              : 'bg-red-500/10 text-red-400'
                          }`}
                        >
                          {fp.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="py-2">
                        <div className="flex items-center gap-1">
                          {editingProviderId === fp.id ? (
                            <>
                              <button
                                onClick={() => saveProviderEdit(fp)}
                                disabled={savingEdit}
                                className="p-1 rounded hover:bg-emerald-500/10 text-muted-foreground hover:text-emerald-500 transition-colors"
                                title="Save changes"
                              >
                                {savingEdit ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => setEditingProviderId(null)}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setEditingProviderId(fp.id ?? null);
                                  setEditingValues({ defaultModel: fp.defaultModel, apiKey: '' });
                                }}
                                className="p-1 rounded hover:bg-orange-500/10 text-muted-foreground hover:text-orange-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="Edit model & API key"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={async () => {
                                  setFallbackProviders((prev) => prev.filter((p) => p.id !== fp.id));
                                  try {
                                    await fetch(`/api/admin/llm-providers?id=${fp.id}`, { method: 'DELETE' });
                                  } catch { /* silent */ }
                                }}
                                className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                                title="Remove provider"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {fallbackProviders.length === 0 && !showFallbackForm && (
            <p className="text-xs text-muted-foreground py-2">
              No fallback providers configured. The platform default (Admin Settings) will be used as the sole provider.
            </p>
          )}

          {showFallbackForm && (
            <div className="border border-border/50 rounded-lg p-4 space-y-0 bg-muted/20">
              <SettingField label="Provider">
                <select
                  value={newFallback.provider}
                  onChange={(e) => {
                    const p = e.target.value;
                    setNewFallback((prev) => ({ ...prev, provider: p, defaultModel: '', baseUrl: PROVIDER_URLS[p] || '' }));
                    setFbAvailableModels([]);
                  }}
                  className="h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50 cursor-pointer"
                >
                  <option value="anthropic">Anthropic</option>
                  <option value="openai">OpenAI</option>
                  <option value="ollama">Ollama</option>
                  <option value="mistral">Mistral</option>
                  <option value="nvidia">NVIDIA NIM</option>
                  <option value="groq">Groq</option>
                  <option value="together">Together AI</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="byteplus">BytePlus ModelArk</option>
                  <option value="custom">Custom</option>
                </select>
              </SettingField>
              <SettingField label="Base URL">
                <input
                  type="text"
                  value={newFallback.baseUrl}
                  onChange={(e) => setNewFallback((prev) => ({ ...prev, baseUrl: e.target.value }))}
                  placeholder="https://api.example.com/v1"
                  className="w-64 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
                />
              </SettingField>
              {newFallback.provider !== 'ollama' && (
                <SettingField label="API Key">
                  <div className="flex items-center gap-2">
                    <input
                      type={fbShowApiKey ? 'text' : 'password'}
                      value={newFallback.apiKey}
                      onChange={(e) => setNewFallback((prev) => ({ ...prev, apiKey: e.target.value }))}
                      placeholder="sk-..."
                      className="w-64 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
                    />
                    <Button variant="ghost" size="sm" onClick={() => setFbShowApiKey(!fbShowApiKey)}>
                      {fbShowApiKey ? 'Hide' : 'Show'}
                    </Button>
                  </div>
                </SettingField>
              )}
              <SettingField label="Default Model">
                <div className="flex items-center gap-2">
                  {fbAvailableModels.length > 0 ? (
                    <select
                      value={newFallback.defaultModel}
                      onChange={(e) => setNewFallback((prev) => ({ ...prev, defaultModel: e.target.value }))}
                      className="h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50 cursor-pointer"
                    >
                      {fbAvailableModels.map((m) => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">
                      {newFallback.defaultModel || 'No models loaded'}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={fbLoadingModels}
                    onClick={async () => {
                      setFbLoadingModels(true);
                      setFbAvailableModels([]);
                      try {
                        const res = await fetch('/api/llm/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            provider: newFallback.provider,
                            apiKey: newFallback.apiKey || undefined,
                            baseUrl: newFallback.baseUrl || undefined,
                          }),
                        });
                        const data = await res.json();
                        if (res.ok && data.success && data.models?.length) {
                          setFbAvailableModels(data.models);
                          if (!newFallback.defaultModel || !data.models.includes(newFallback.defaultModel)) {
                            setNewFallback((prev) => ({ ...prev, defaultModel: data.models[0] }));
                          }
                        } else {
                          setFbTestStatus('error');
                          setFbTestMessage(data.message || 'Could not load models');
                          setTimeout(() => { setFbTestStatus('idle'); setFbTestMessage(''); }, 5000);
                        }
                      } catch {
                        setFbTestStatus('error');
                        setFbTestMessage('Network error loading models');
                        setTimeout(() => { setFbTestStatus('idle'); setFbTestMessage(''); }, 5000);
                      }
                      setFbLoadingModels(false);
                    }}
                    className="gap-1 shrink-0"
                  >
                    {fbLoadingModels ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading...</>
                    ) : (
                      <><Cpu className="w-3.5 h-3.5" /> Load Models</>
                    )}
                  </Button>
                </div>
              </SettingField>
              <SettingField label="Priority">
                <input
                  type="number"
                  value={newFallback.priority}
                  onChange={(e) => setNewFallback((prev) => ({ ...prev, priority: parseInt(e.target.value) || 1 }))}
                  min="1"
                  className="w-20 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
                />
              </SettingField>
              <div className="flex items-center justify-between py-3">
                <span className="text-sm text-muted-foreground">Test Connection</span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={fbTestingLlm || !newFallback.defaultModel.trim()}
                    onClick={async () => {
                      setFbTestingLlm(true);
                      setFbTestStatus('idle');
                      setFbTestMessage('');
                      try {
                        const res = await fetch('/api/llm/test', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            provider: newFallback.provider,
                            apiKey: newFallback.apiKey || undefined,
                            baseUrl: newFallback.baseUrl || undefined,
                            defaultModel: newFallback.defaultModel.trim(),
                          }),
                        });
                        const data = await res.json();
                        if (res.ok && data.success) {
                          setFbTestStatus('success');
                          setFbTestMessage(data.message || 'Connected!');
                        } else {
                          setFbTestStatus('error');
                          setFbTestMessage(data.message || 'Connection failed');
                        }
                      } catch {
                        setFbTestStatus('error');
                        setFbTestMessage('Network error');
                      }
                      setFbTestingLlm(false);
                      setTimeout(() => { setFbTestStatus('idle'); setFbTestMessage(''); }, 8000);
                    }}
                    className="gap-1.5"
                    style={{
                      borderColor: fbTestStatus === 'success' ? '#10b981' : fbTestStatus === 'error' ? '#ef4444' : undefined,
                      color: fbTestStatus === 'success' ? '#10b981' : fbTestStatus === 'error' ? '#ef4444' : undefined,
                    }}
                  >
                    {fbTestingLlm ? (
                      <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Testing...</>
                    ) : fbTestStatus === 'success' ? (
                      <><CheckCircle2 className="w-3.5 h-3.5" /> Connected</>
                    ) : fbTestStatus === 'error' ? (
                      <><AlertTriangle className="w-3.5 h-3.5" /> Failed</>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                  {fbTestMessage && fbTestStatus !== 'idle' && (
                    <span className={`text-[11px] max-w-[200px] truncate ${fbTestStatus === 'success' ? 'text-emerald-500' : 'text-red-400'}`}>
                      {fbTestMessage}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-2 border-t border-border/30">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={savingFallback || !newFallback.defaultModel.trim()}
                  onClick={async () => {
                    setSavingFallback(true);
                    try {
                      const res = await fetch('/api/admin/llm-providers', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newFallback),
                      });
                      const data = await res.json();
                      if (res.ok && data.id) {
                        setFallbackProviders((prev) => [...prev, data].sort((a, b) => a.priority - b.priority));
                        setNewFallback({ provider: 'anthropic', apiKey: '', baseUrl: '', defaultModel: '', priority: fallbackProviders.length + 2 });
                        setFbAvailableModels([]);
                        setFbTestStatus('idle');
                        setFbTestMessage('');
                        setShowFallbackForm(false);
                      }
                    } catch { /* silent */ }
                    setSavingFallback(false);
                  }}
                  className="gap-1.5"
                >
                  {savingFallback ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
                  ) : (
                    <><Check className="w-3.5 h-3.5" /> Save Provider</>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setShowFallbackForm(false); setFbAvailableModels([]); setFbTestStatus('idle'); }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {!showFallbackForm && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setNewFallback({ provider: 'anthropic', apiKey: '', baseUrl: '', defaultModel: '', priority: fallbackProviders.length + 1 });
                setShowFallbackForm(true);
              }}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Fallback Provider
            </Button>
          )}

          <div className="text-xs text-muted-foreground pt-2 border-t border-border/30">
            Resolution order: User BYOK &rarr; Agent Override &rarr; Project Override &rarr; Fallback Chain (by priority) &rarr; Admin Default
          </div>
        </div>
      </motion.div>

      {/* Billing Configuration */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<CreditCard className="w-4 h-4" />}
          title="Billing Configuration"
          subtitle="Credit system, markup, and free trial settings"
          color="#8b5cf6"
        />
        <div className="space-y-0">
          <SettingField label="Platform Markup % (applied to token costs)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={markupPercent}
                onChange={(e) => setMarkupPercent(e.target.value)}
                step="1"
                min="0"
                max="100"
                className="w-20 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </SettingField>
          <SettingField label="Free Credits for New Users ($)">
            <input
              type="number"
              value={freeCreditsAmount}
              onChange={(e) => setFreeCreditsAmount(e.target.value)}
              step="1"
              min="0"
              className="w-24 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
          <SettingField label="Free Trial Duration (days)">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={freeCreditsExpiryDays}
                onChange={(e) => setFreeCreditsExpiryDays(e.target.value)}
                step="1"
                min="1"
                className="w-20 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
              />
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          </SettingField>
        </div>
      </motion.div>

      {/* Agent Model Overrides */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Bot className="w-4 h-4" />}
          title="Agent Model Overrides"
          subtitle="Override the default LLM for specific agents"
          color="#f59e0b"
        />
        <div className="space-y-3">
          {agentOverrides.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground border-b border-border/30">
                    <th className="text-left py-2 pr-2 font-medium">Agent</th>
                    <th className="text-left py-2 pr-2 font-medium">Provider</th>
                    <th className="text-left py-2 pr-2 font-medium">Model</th>
                    <th className="text-left py-2 pr-2 font-medium">Base URL</th>
                    <th className="w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {agentOverrides.map((override, idx) => {
                    const usedShortNames = agentOverrides
                      .filter((_, i) => i !== idx)
                      .map((o) => o.agentShortName);
                    const availableAgents = AGENT_OPTIONS.filter(
                      (a) => !usedShortNames.includes(a.shortName)
                    );
                    return (
                      <tr key={idx} className="border-b border-border/20 last:border-0">
                        <td className="py-2 pr-2">
                          <select
                            value={override.agentShortName}
                            onChange={(e) => {
                              const updated = [...agentOverrides];
                              updated[idx] = { ...updated[idx], agentShortName: e.target.value };
                              setAgentOverrides(updated);
                            }}
                            className="h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50 cursor-pointer w-full min-w-[140px]"
                          >
                            <option value="">Select agent...</option>
                            {availableAgents.map((a) => (
                              <option key={a.shortName} value={a.shortName}>
                                {a.shortName} - {a.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <select
                            value={override.provider}
                            onChange={(e) => {
                              const updated = [...agentOverrides];
                              updated[idx] = { ...updated[idx], provider: e.target.value };
                              setAgentOverrides(updated);
                            }}
                            className="h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50 cursor-pointer w-full min-w-[120px]"
                          >
                            <option value="anthropic">Anthropic</option>
                            <option value="openai">OpenAI</option>
                            <option value="ollama">Ollama</option>
                            <option value="mistral">Mistral</option>
                            <option value="nvidia">NVIDIA NIM</option>
                            <option value="groq">Groq</option>
                            <option value="together">Together AI</option>
                            <option value="openrouter">OpenRouter</option>
                            <option value="deepseek">DeepSeek</option>
                            <option value="byteplus">BytePlus ModelArk</option>
                            <option value="custom">Custom</option>
                          </select>
                        </td>
                        <td className="py-2 pr-2">
                          <input
                            type="text"
                            value={override.model}
                            onChange={(e) => {
                              const updated = [...agentOverrides];
                              updated[idx] = { ...updated[idx], model: e.target.value };
                              setAgentOverrides(updated);
                            }}
                            placeholder="e.g. gpt-4o"
                            className="w-full min-w-[140px] h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
                          />
                        </td>
                        <td className="py-2 pr-2">
                          {(override.provider === 'ollama' || override.provider === 'custom') ? (
                            <input
                              type="text"
                              value={override.baseUrl}
                              onChange={(e) => {
                                const updated = [...agentOverrides];
                                updated[idx] = { ...updated[idx], baseUrl: e.target.value };
                                setAgentOverrides(updated);
                              }}
                              placeholder={override.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com'}
                              className="w-full min-w-[160px] h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
                            />
                          ) : (
                            <span className="text-xs text-muted-foreground italic">N/A</span>
                          )}
                        </td>
                        <td className="py-2">
                          <button
                            onClick={() => {
                              const updated = agentOverrides.filter((_, i) => i !== idx);
                              setAgentOverrides(updated);
                            }}
                            className="p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
                            title="Remove override"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setAgentOverrides((prev) => [
                  ...prev,
                  { agentShortName: '', provider: 'anthropic', model: '', baseUrl: '' },
                ]);
              }}
              disabled={agentOverrides.length >= AGENT_OPTIONS.length}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add Agent Override
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={savingOverrides || agentOverrides.length === 0}
              onClick={async () => {
                setSavingOverrides(true);
                setSavedOverrides(false);
                try {
                  // Delete overrides that were removed
                  const currentRes = await fetch('/api/admin/agent-llm-config');
                  const currentData = await currentRes.json();
                  if (Array.isArray(currentData)) {
                    const currentShortNames = agentOverrides.map((o) => o.agentShortName).filter(Boolean);
                    for (const existing of currentData) {
                      if (!currentShortNames.includes(existing.agentShortName)) {
                        await fetch(`/api/admin/agent-llm-config?agentShortName=${existing.agentShortName}`, { method: 'DELETE' });
                      }
                    }
                  }
                  // Upsert each override
                  for (const override of agentOverrides) {
                    if (!override.agentShortName || !override.model) continue;
                    await fetch('/api/admin/agent-llm-config', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(override),
                    });
                  }
                  setSavedOverrides(true);
                  setTimeout(() => setSavedOverrides(false), 3000);
                } catch {
                  // silent fail
                }
                setSavingOverrides(false);
              }}
              className="gap-1.5"
              style={{
                borderColor: savedOverrides ? '#10b981' : undefined,
                color: savedOverrides ? '#10b981' : undefined,
              }}
            >
              {savingOverrides ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...</>
              ) : savedOverrides ? (
                <><Check className="w-3.5 h-3.5" /> Saved</>
              ) : (
                'Save Overrides'
              )}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground pt-2 border-t border-border/30">
            All other agents use: <span className="font-medium text-foreground">{defaultProvider}</span> / <span className="font-medium text-foreground">{defaultModel || 'not set'}</span>
          </div>
        </div>
      </motion.div>

      {/* Usage Limits */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Zap className="w-4 h-4" />}
          title="Usage Limits"
          subtitle="Platform-wide resource limits"
          color="#3b82f6"
        />
        <div className="space-y-0">
          <SettingField label="Max Projects per User">
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              10
            </span>
          </SettingField>
          <SettingField label="Max Agents per Project">
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              23
            </span>
          </SettingField>
          <SettingField label="Max API Keys per User">
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              2
            </span>
          </SettingField>
        </div>
      </motion.div>

      {/* Email Configuration */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Mail className="w-4 h-4" />}
          title="Email Configuration"
          subtitle="Mailjet transactional email & event tracking"
          color="#8b5cf6"
        />
        <div className="space-y-0">
          <div className="flex items-center justify-between py-3 border-b border-border/30">
            <Label
              htmlFor="emailEnabled"
              className="text-sm text-muted-foreground font-normal cursor-pointer"
            >
              Email Sending Enabled
            </Label>
            <Switch
              id="emailEnabled"
              checked={emailEnabled}
              onCheckedChange={setEmailEnabled}
            />
          </div>
          <SettingField label="Mailjet API Key">
            <input
              type="password"
              value={emailMailjetApiKey}
              onChange={(e) => setEmailMailjetApiKey(e.target.value)}
              placeholder="your-api-key"
              className="w-52 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
          <SettingField label="Mailjet Secret Key">
            <input
              type="password"
              value={emailMailjetSecretKey}
              onChange={(e) => setEmailMailjetSecretKey(e.target.value)}
              placeholder="your-secret-key"
              className="w-52 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
          <SettingField label="From Address">
            <input
              type="email"
              value={emailFromAddress}
              onChange={(e) => setEmailFromAddress(e.target.value)}
              placeholder="noreply@yourdomain.com"
              className="w-52 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
          <SettingField label="From Name">
            <input
              type="text"
              value={emailFromName}
              onChange={(e) => setEmailFromName(e.target.value)}
              placeholder="Codanium"
              className="w-52 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>

          {/* Webhook Token */}
          {emailWebhookToken && (
            <SettingField label="Webhook Token">
              <code className="text-xs text-muted-foreground bg-foreground/5 px-2 py-1 rounded font-mono">
                {emailWebhookToken.substring(0, 16)}...
              </code>
            </SettingField>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-3 py-3 border-t border-border/30 mt-1">
            {/* Send Test Email */}
            <Button
              variant="outline"
              size="sm"
              disabled={testingEmail}
              onClick={async () => {
                setTestingEmail(true);
                setTestEmailStatus('idle');
                try {
                  const res = await fetch('/api/admin/email/test', { method: 'POST' });
                  if (res.ok) {
                    setTestEmailStatus('success');
                  } else {
                    setTestEmailStatus('error');
                  }
                } catch {
                  setTestEmailStatus('error');
                }
                setTestingEmail(false);
                setTimeout(() => setTestEmailStatus('idle'), 5000);
              }}
              className="gap-1.5"
              style={{
                borderColor: testEmailStatus === 'success' ? '#10b981' : testEmailStatus === 'error' ? '#ef4444' : undefined,
                color: testEmailStatus === 'success' ? '#10b981' : testEmailStatus === 'error' ? '#ef4444' : undefined,
              }}
            >
              {testingEmail ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Sending...</>
              ) : testEmailStatus === 'success' ? (
                <><Check className="w-3.5 h-3.5" /> Sent!</>
              ) : testEmailStatus === 'error' ? (
                'Failed'
              ) : (
                <><Send className="w-3.5 h-3.5" /> Send Test</>
              )}
            </Button>

            {/* Register Webhooks */}
            <Button
              variant="outline"
              size="sm"
              disabled={registeringWebhooks || !emailMailjetApiKey || !emailMailjetSecretKey}
              onClick={async () => {
                setRegisteringWebhooks(true);
                setRegisterWebhookStatus('idle');
                setRegisterWebhookMessage('');
                try {
                  const res = await fetch('/api/admin/email/register-webhooks', { method: 'POST' });
                  const data = await res.json();
                  if (res.ok && data.success) {
                    setRegisterWebhookStatus('success');
                    setRegisterWebhookMessage(data.message);
                    // Reload settings to get the new webhook token
                    fetchAdminSettings().then((settings) => {
                      if (settings['email.mailjetWebhookToken']) {
                        setEmailWebhookToken(settings['email.mailjetWebhookToken']);
                      }
                    }).catch(() => {});
                  } else {
                    setRegisterWebhookStatus('error');
                    setRegisterWebhookMessage(data.error || 'Failed');
                  }
                } catch {
                  setRegisterWebhookStatus('error');
                  setRegisterWebhookMessage('Network error');
                }
                setRegisteringWebhooks(false);
                setTimeout(() => { setRegisterWebhookStatus('idle'); setRegisterWebhookMessage(''); }, 5000);
              }}
              className="gap-1.5"
              style={{
                borderColor: registerWebhookStatus === 'success' ? '#10b981' : registerWebhookStatus === 'error' ? '#ef4444' : undefined,
                color: registerWebhookStatus === 'success' ? '#10b981' : registerWebhookStatus === 'error' ? '#ef4444' : undefined,
              }}
            >
              {registeringWebhooks ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Registering...</>
              ) : registerWebhookStatus === 'success' ? (
                <><Check className="w-3.5 h-3.5" /> {registerWebhookMessage}</>
              ) : registerWebhookStatus === 'error' ? (
                registerWebhookMessage || 'Failed'
              ) : (
                'Register Webhooks'
              )}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Email Analytics */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Mail className="w-4 h-4" />}
          title="Email Delivery Analytics"
          subtitle="Real-time event tracking from Mailjet"
          color="#8b5cf6"
        />
        {!emailAnalytics ? (
          <div className="flex justify-center py-6">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch('/api/admin/email/analytics?days=30');
                  if (res.ok) {
                    const data = await res.json();
                    setEmailAnalytics(data);
                  }
                } catch {}
              }}
              className="gap-1.5"
            >
              Load Analytics
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary stats */}
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: 'Sent', key: 'SENT', color: '#10b981' },
                { label: 'Opened', key: 'OPEN', color: '#3b82f6' },
                { label: 'Clicked', key: 'CLICK', color: '#8b5cf6' },
                { label: 'Bounced', key: 'BOUNCE', color: '#ef4444' },
              ].map(({ label, key, color }) => (
                <div
                  key={key}
                  className="p-3 rounded-lg border border-border/30 bg-foreground/[0.02] text-center"
                >
                  <div className="text-2xl font-bold" style={{ color }}>
                    {emailAnalytics.summary[key] ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
                </div>
              ))}
            </div>

            {/* Additional stats row */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Spam', key: 'SPAM', color: '#f59e0b' },
                { label: 'Blocked', key: 'BLOCKED', color: '#ef4444' },
                { label: 'Unsub', key: 'UNSUB', color: '#6b7280' },
              ].map(({ label, key, color }) => (
                <div
                  key={key}
                  className="p-2.5 rounded-lg border border-border/30 bg-foreground/[0.02] text-center"
                >
                  <div className="text-lg font-bold" style={{ color }}>
                    {emailAnalytics.summary[key] ?? 0}
                  </div>
                  <div className="text-xs text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            {/* Recent events */}
            {emailAnalytics.recentEvents?.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs font-medium text-muted-foreground">Recent Events</h4>
                <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border/30 p-2">
                  {emailAnalytics.recentEvents.slice(0, 20).map((evt: any) => (
                    <div
                      key={evt.id}
                      className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-foreground/[0.02]"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                          style={{
                            backgroundColor:
                              evt.event === 'SENT' ? '#10b98120' :
                              evt.event === 'OPEN' ? '#3b82f620' :
                              evt.event === 'CLICK' ? '#8b5cf620' :
                              evt.event === 'BOUNCE' ? '#ef444420' :
                              evt.event === 'SPAM' ? '#f59e0b20' : '#6b728020',
                            color:
                              evt.event === 'SENT' ? '#10b981' :
                              evt.event === 'OPEN' ? '#3b82f6' :
                              evt.event === 'CLICK' ? '#8b5cf6' :
                              evt.event === 'BOUNCE' ? '#ef4444' :
                              evt.event === 'SPAM' ? '#f59e0b' : '#6b7280',
                          }}
                        >
                          {evt.event}
                        </span>
                        <span className="truncate text-muted-foreground">{evt.email}</span>
                        {evt.bounceError && (
                          <span className="text-red-400 truncate text-[10px]">{evt.bounceError}</span>
                        )}
                      </div>
                      <span className="text-muted-foreground/50 shrink-0 ml-2">
                        {new Date(evt.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Refresh button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  const res = await fetch('/api/admin/email/analytics?days=30');
                  if (res.ok) setEmailAnalytics(await res.json());
                } catch {}
              }}
              className="text-xs text-muted-foreground"
            >
              Refresh
            </Button>
          </div>
        )}
      </motion.div>

      {/* Stripe Billing */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<CreditCard className="w-4 h-4" />}
          title="Stripe Billing"
          subtitle="Payment processing and subscriptions"
          color="#6366f1"
        />
        <div className="space-y-0">
          <div className="flex items-center justify-between py-3 border-b border-border/30">
            <Label
              htmlFor="stripeEnabled"
              className="text-sm text-muted-foreground font-normal cursor-pointer"
            >
              Stripe Billing Enabled
            </Label>
            <div className="flex items-center gap-2">
              {stripeSecretKey && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                  stripeSecretKey.startsWith('sk_test_')
                    ? 'bg-amber-500/10 text-amber-600'
                    : 'bg-green-500/10 text-green-600'
                }`}>
                  {stripeSecretKey.startsWith('sk_test_') ? 'Test Mode' : 'Live Mode'}
                </span>
              )}
              <Switch
                id="stripeEnabled"
                checked={stripeEnabled}
                onCheckedChange={setStripeEnabled}
              />
            </div>
          </div>
          <SettingField label="Secret Key">
            <input
              type="password"
              value={stripeSecretKey}
              onChange={(e) => setStripeSecretKey(e.target.value)}
              placeholder="sk_test_..."
              className="w-52 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
          <SettingField label="Webhook Secret">
            <input
              type="password"
              value={stripeWebhookSecret}
              onChange={(e) => setStripeWebhookSecret(e.target.value)}
              placeholder="whsec_..."
              className="w-52 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
        </div>
      </motion.div>

      {/* Feature Flags */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<ToggleLeft className="w-4 h-4" />}
          title="Feature Flags"
          subtitle="Enable or disable platform features"
          color="#0d9488"
        />
        <div className="space-y-4">
          {([
            { key: 'agentChat' as const, label: 'Agent Chat (AI conversations)' },
            { key: 'boardDragDrop' as const, label: 'Board Card Management (drag & drop)' },
            { key: 'decisionApprovals' as const, label: 'Decision Approvals' },
            { key: 'vsCodeIntegration' as const, label: 'VS Code Integration' },
            { key: 'gitIntegration' as const, label: 'Git Integration (branches, PRs)' },
            { key: 'webhooks' as const, label: 'Webhooks (external notifications)' },
          ]).map((feature) => (
            <div
              key={feature.key}
              className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
            >
              <Label
                htmlFor={feature.key}
                className="text-sm text-muted-foreground font-normal cursor-pointer"
              >
                {feature.label}
              </Label>
              <Switch
                id={feature.key}
                checked={featureFlags[feature.key]}
                onCheckedChange={() => toggleFeature(feature.key)}
              />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Security */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Shield className="w-4 h-4" />}
          title="Security"
          subtitle="Authentication and access controls"
          color="#ef4444"
        />
        <div className="space-y-0">
          <SettingField label="Session Timeout">
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              24 hours
            </span>
          </SettingField>
          <div className="flex items-center justify-between py-3 border-b border-border/30">
            <Label
              htmlFor="twoFactor"
              className="text-sm text-muted-foreground font-normal cursor-pointer"
            >
              Two-Factor Authentication
            </Label>
            <Switch
              id="twoFactor"
              checked={twoFactorAuth}
              onCheckedChange={setTwoFactorAuth}
            />
          </div>
          <div className="flex items-center justify-between py-3">
            <Label
              htmlFor="ipAllowlist"
              className="text-sm text-muted-foreground font-normal cursor-pointer"
            >
              IP Allowlist
            </Label>
            <Switch
              id="ipAllowlist"
              checked={ipAllowlist}
              onCheckedChange={setIpAllowlist}
            />
          </div>
        </div>
      </motion.div>

      {/* Save Button */}
      <motion.div variants={itemVariants} className="flex items-center justify-end gap-4 pb-6">
        {saveError && (
          <span className="text-sm text-red-400 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            {saveError}
          </span>
        )}
        <Button
          onClick={handleSave}
          disabled={saving}
          className="px-6 gap-2"
          style={{
            backgroundColor:
              saveStatus === 'saved' ? '#10b981' : saveStatus === 'error' ? '#ef4444' : undefined,
          }}
        >
          {saving ? (
            'Saving...'
          ) : saveStatus === 'saved' ? (
            <>
              <Check className="w-4 h-4" />
              Saved
            </>
          ) : saveStatus === 'error' ? (
            'Save Failed'
          ) : (
            'Save Changes'
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
