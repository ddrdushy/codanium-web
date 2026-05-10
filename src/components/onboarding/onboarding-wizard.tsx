'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { StepIndicator } from './step-indicator';
import {
  Sparkles, DollarSign, CheckCircle2, ArrowRight, ArrowLeft,
  Loader2, AlertTriangle,
  Settings, Bell, MessageSquare, Shield, Key, Eye, EyeOff,
  ExternalLink, Cpu,
} from 'lucide-react';
import { BYOK_PROVIDERS, getProvider } from '@/lib/ai/byok-providers';

// ─── Constants ─────────────────────────────────────────────────────────────

const TOTAL_STEPS = 4;

const STEP_LABELS = ['Welcome', 'AI Provider', 'Preferences', 'Done'];

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

const BUDGET_ALERT_OPTIONS = [50, 75, 90];

// Framer-motion variants for step transitions
const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

// ─── Component ─────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const router = useRouter();
  const { data: session, update } = useSession();
  const userName = session?.user?.name?.split(' ')[0] || 'there';

  // Step navigation
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [error, setError] = useState('');

  // Budget & Preferences state (Step 2)
  const [monthlyBudget, setMonthlyBudget] = useState(500);
  const [alertThreshold, setAlertThreshold] = useState(75);
  const [approvalLevel, setApprovalLevel] = useState('big-stuff');
  const [commStyle, setCommStyle] = useState('simple');
  const [notifications, setNotifications] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NOTIFICATION_OPTIONS.map(n => [n.id, n.defaultOn]))
  );

  // Submission state
  const [saving, setSaving] = useState(false);

  // ─── BYOK state (Step 2) ───────────────────────────────────────────────
  const [byokProvider, setByokProvider] = useState<string>('openai');
  const [byokModel, setByokModel] = useState<string>('gpt-4o');
  const [byokApiKey, setByokApiKey] = useState<string>('');
  const [byokBaseUrl, setByokBaseUrl] = useState<string>('');
  const [byokShowKey, setByokShowKey] = useState(false);
  const [byokSaving, setByokSaving] = useState(false);
  const [byokSaved, setByokSaved] = useState(false);
  const [byokRequired, setByokRequired] = useState(false);
  const [byokError, setByokError] = useState('');

  // Resume from last step on mount + load BYOK status (whether already set,
  // and whether the deployment requires it).
  useEffect(() => {
    fetch('/api/onboarding/status')
      .then(r => r.json())
      .then(data => {
        if (data.step && data.step > 0 && data.step < TOTAL_STEPS) {
          setStep(data.step + 1);
        }
      })
      .catch(() => {});

    fetch('/api/account/llm-config')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data) return;
        if (data.requireBYOK) setByokRequired(true);
        if (data.configured) {
          setByokSaved(true);
          if (data.provider) setByokProvider(data.provider);
          if (data.defaultModel) setByokModel(data.defaultModel);
          if (data.baseUrl) setByokBaseUrl(data.baseUrl);
        }
      })
      .catch(() => {});
  }, []);

  // Keep model in sync with provider — if the user changes provider,
  // pre-select the first model from that provider's list.
  useEffect(() => {
    const p = getProvider(byokProvider);
    if (p && !p.models.includes(byokModel)) {
      setByokModel(p.models[0]);
    }
    if (p?.defaultBaseUrl && !byokBaseUrl) {
      setByokBaseUrl(p.defaultBaseUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [byokProvider]);

  async function saveBYOK(): Promise<boolean> {
    const provider = getProvider(byokProvider);
    if (!provider) return false;
    if (!provider.apiKeyOptional && !byokApiKey && !byokSaved) {
      setByokError('Please paste your API key.');
      return false;
    }
    setByokSaving(true);
    setByokError('');
    try {
      const res = await fetch('/api/account/llm-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: byokProvider,
          // Empty string = keep existing key; new key replaces it.
          apiKey: byokApiKey,
          defaultModel: byokModel,
          baseUrl: byokBaseUrl || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setByokError(data.error || 'Failed to save provider config.');
        return false;
      }
      setByokSaved(true);
      setByokApiKey(''); // never keep the cleartext in component state after save
      return true;
    } catch {
      setByokError('Network error — please try again.');
      return false;
    } finally {
      setByokSaving(false);
    }
  }

  // ─── Handlers ──────────────────────────────────────────────────────────

  async function goNext() {
    setError('');

    // Step 2 → 3: save BYOK if a key was entered. If REQUIRE_USER_BYOK is on
    // and the user hasn't saved a config, refuse to advance until they do.
    if (step === 2) {
      const hasNewKey = byokApiKey.length > 0;
      const provider = getProvider(byokProvider);
      const needsKey = !provider?.apiKeyOptional;

      if (hasNewKey || (provider?.apiKeyOptional && !byokSaved)) {
        const ok = await saveBYOK();
        if (!ok) return;
      } else if (byokRequired && !byokSaved) {
        setByokError(
          needsKey
            ? 'This deployment requires you to bring your own API key. Paste a key to continue.'
            : 'Please save a provider config to continue.'
        );
        return;
      }
    }

    setDirection(1);

    // Persist step progress
    try {
      await fetch('/api/onboarding/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ step }),
      });
    } catch {}

    setStep(s => Math.min(s + 1, TOTAL_STEPS));
  }

  function goBack() {
    setError('');
    setDirection(-1);
    setStep(s => Math.max(s - 1, 1));
  }

  async function handleComplete() {
    setSaving(true);
    setError('');
    try {
      // 1. Save user preferences
      await fetch('/api/user/preferences', {
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

      // 2. Mark onboarding complete
      await fetch('/api/onboarding/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      });

      // 3. Refresh JWT so session contains updated onboardingCompleted
      await update();

      // 4. Hard redirect — forces full page load with fresh session cookie
      window.location.href = '/projects';
    } catch {
      setError('Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  async function handleSkip() {
    setSaving(true);
    try {
      await fetch('/api/onboarding/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      });
      await update();
      // Hard redirect — forces full page load with fresh session cookie
      window.location.href = '/projects';
    } catch {
      setError('Something went wrong. Please try again.');
      setSaving(false);
    }
  }

  // ─── Step Renderers ────────────────────────────────────────────────────

  function renderStep1() {
    return (
      <div className="text-center space-y-8">
        {/* Sparkle icon */}
        <motion.div
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, duration: 0.5, type: 'spring', stiffness: 200 }}
          className="w-16 h-16 rounded-2xl bg-amber/10 border border-amber/20 flex items-center justify-center mx-auto"
        >
          <Sparkles className="w-8 h-8 text-amber" />
        </motion.div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-amber via-orange-400 to-amber bg-clip-text text-transparent">
            Welcome, {userName}!
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Let&apos;s set up your preferences so your AI team can start building. This takes about a minute.
          </p>
        </div>

        {/* What we'll configure */}
        <div className="grid gap-3 text-left max-w-md mx-auto">
          {[
            { icon: Key, label: 'AI Provider', desc: 'Add your OpenAI, Anthropic, Ollama, or other API key' },
            { icon: DollarSign, label: 'Budget & Limits', desc: 'Set monthly spending limits and alerts' },
            { icon: Settings, label: 'Preferences', desc: 'Communication style, approval workflow, notifications' },
          ].map(({ icon: Icon, label, desc }) => (
            <div
              key={label}
              className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-raised border border-border"
            >
              <div className="w-9 h-9 rounded-lg bg-amber/10 flex items-center justify-center shrink-0 mt-0.5">
                <Icon className="w-4.5 h-4.5 text-amber" />
              </div>
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-3 max-w-md mx-auto">
          <Button
            onClick={goNext}
            className="w-full h-11 bg-amber text-background hover:bg-amber/90 font-semibold"
          >
            Get Started
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
          <button
            onClick={handleSkip}
            disabled={saving}
            className="w-full text-sm text-muted-foreground hover:text-amber transition-colors py-2 disabled:opacity-50"
          >
            {saving ? 'Setting up...' : 'Skip — set up later'}
          </button>
        </div>
      </div>
    );
  }

  function renderStep2() {
    const provider = getProvider(byokProvider);
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight">Add your AI provider</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {byokRequired
              ? 'This deployment runs on bring-your-own-key. Add a provider to start using your AI team.'
              : 'Use your own API key to skip platform credit charges. You can also add this later in Settings.'}
          </p>
        </div>

        {/* Provider grid */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-amber" />
            <span className="text-sm font-medium">Provider</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {BYOK_PROVIDERS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => { setByokProvider(p.id); setByokError(''); setByokSaved(false); }}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  byokProvider === p.id
                    ? 'border-amber bg-amber/10'
                    : 'border-border bg-surface-raised hover:border-amber/20',
                )}
              >
                <p className={cn('text-sm font-medium', byokProvider === p.id && 'text-amber')}>
                  {p.label}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {p.apiKeyOptional ? 'Local — no key needed' : `${p.models.length} models · BYOK`}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* API key */}
        {!provider?.apiKeyOptional && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-amber" />
                <span className="text-sm font-medium">API Key</span>
                {byokSaved && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-medium">
                    Saved
                  </span>
                )}
              </div>
              {provider?.keyDocsUrl && (
                <a
                  href={provider.keyDocsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-muted-foreground hover:text-amber inline-flex items-center gap-1 transition-colors"
                >
                  Get a key <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type={byokShowKey ? 'text' : 'password'}
                value={byokApiKey}
                onChange={(e) => { setByokApiKey(e.target.value); setByokError(''); }}
                placeholder={byokSaved ? '•••••••• (leave blank to keep existing key)' : 'Paste your API key'}
                autoComplete="off"
                spellCheck={false}
                className="w-full h-10 px-3 pr-9 rounded-lg bg-surface-raised border border-border text-sm font-mono focus:outline-none focus:border-amber/40"
              />
              <button
                type="button"
                onClick={() => setByokShowKey(s => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-foreground/[0.06] text-muted-foreground"
                aria-label={byokShowKey ? 'Hide key' : 'Show key'}
              >
                {byokShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Encrypted with AES-256-GCM at rest. Never sent anywhere except the provider you select.
            </p>
          </div>
        )}

        {/* Default model */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Default model</span>
          </div>
          <select
            value={byokModel}
            onChange={(e) => setByokModel(e.target.value)}
            className="w-full h-10 px-3 rounded-lg bg-surface-raised border border-border text-sm focus:outline-none focus:border-amber/40"
          >
            {provider?.models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Base URL — required for Ollama, optional for others */}
        {(provider?.apiKeyOptional || byokBaseUrl) && (
          <div className="space-y-2">
            <span className="text-sm font-medium">
              Base URL {provider?.apiKeyOptional ? '' : <span className="text-muted-foreground/60 font-normal">(optional)</span>}
            </span>
            <input
              type="text"
              value={byokBaseUrl}
              onChange={(e) => setByokBaseUrl(e.target.value)}
              placeholder={provider?.defaultBaseUrl || 'https://your-endpoint.example.com/v1'}
              className="w-full h-10 px-3 rounded-lg bg-surface-raised border border-border text-sm font-mono focus:outline-none focus:border-amber/40"
            />
          </div>
        )}

        {byokError && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-red-500/[0.06] border border-red-500/30 text-red-300">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span className="text-xs">{byokError}</span>
          </div>
        )}
      </div>
    );
  }

  function renderStep3() {
    return (
      <div className="space-y-6">
        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight">Budget & Preferences</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Set your spending limits and how you&apos;d like your AI team to work.
          </p>
        </div>

        {/* Monthly Budget */}
        <div className="space-y-3 p-4 rounded-xl bg-surface-raised border border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber" />
              <span className="text-sm font-medium">Monthly Budget</span>
            </div>
            <span className="text-lg font-bold text-amber">${monthlyBudget}</span>
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
          <div className="flex justify-between text-[10px] text-muted-foreground/50">
            <span>$100</span>
            <span>$5,000</span>
          </div>

          {/* Alert threshold */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <span className="text-xs text-muted-foreground">Alert me at</span>
            <div className="flex gap-1.5">
              {BUDGET_ALERT_OPTIONS.map(pct => (
                <button
                  key={pct}
                  onClick={() => setAlertThreshold(pct)}
                  className={cn(
                    'px-2.5 py-1 rounded-md text-xs font-medium transition-all',
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

        {/* Approval Level */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-amber" />
            <span className="text-sm font-medium">Approval Level</span>
          </div>
          <div className="space-y-2">
            {APPROVAL_OPTIONS.map(({ id, label, description, badge }) => (
              <button
                key={id}
                onClick={() => setApprovalLevel(id)}
                className={cn(
                  'w-full flex items-center justify-between p-3 rounded-lg border text-left transition-all',
                  approvalLevel === id
                    ? 'border-amber bg-amber/10'
                    : 'border-border bg-surface-raised hover:border-amber/20',
                )}
              >
                <div>
                  <p className={cn('text-sm font-medium', approvalLevel === id && 'text-amber')}>{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                </div>
                <span className={cn(
                  'text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ml-3',
                  approvalLevel === id ? 'bg-amber/20 text-amber' : 'bg-foreground/[0.04] text-muted-foreground/60',
                )}>
                  {badge}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Communication Style */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-amber" />
            <span className="text-sm font-medium">Communication Style</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {COMMUNICATION_OPTIONS.map(({ id, label, description }) => (
              <button
                key={id}
                onClick={() => setCommStyle(id)}
                className={cn(
                  'p-3 rounded-lg border text-left transition-all',
                  commStyle === id
                    ? 'border-amber bg-amber/10'
                    : 'border-border bg-surface-raised hover:border-amber/20',
                )}
              >
                <p className={cn('text-sm font-medium', commStyle === id && 'text-amber')}>{label}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-amber" />
            <span className="text-sm font-medium">Email Notifications</span>
          </div>
          <div className="space-y-1">
            {NOTIFICATION_OPTIONS.map(({ id, label }) => (
              <div
                key={id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-foreground/[0.02] transition-colors"
              >
                <span className="text-sm text-muted-foreground">{label}</span>
                <Switch
                  checked={notifications[id] ?? false}
                  onCheckedChange={(checked) =>
                    setNotifications(prev => ({ ...prev, [id]: checked }))
                  }
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderStep4() {
    const approvalLabel = APPROVAL_OPTIONS.find(a => a.id === approvalLevel)?.label || approvalLevel;
    const commLabel = COMMUNICATION_OPTIONS.find(c => c.id === commStyle)?.label || commStyle;
    const providerLabel = getProvider(byokProvider)?.label || byokProvider;

    return (
      <div className="text-center space-y-6">
        {/* Success icon */}
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.1, duration: 0.5, type: 'spring', stiffness: 200 }}
          className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto"
        >
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </motion.div>

        <div>
          <h2 className="text-xl font-bold tracking-tight">You&apos;re All Set!</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Here&apos;s a summary of your configuration. You can change any of these in Settings later.
          </p>
        </div>

        {/* Summary card */}
        <div className="text-left space-y-3 max-w-md mx-auto">
          <div className="p-4 rounded-xl bg-surface-raised border border-border space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">AI Provider</span>
              <span className="text-sm font-medium">
                {byokSaved ? `${providerLabel} · ${byokModel}` : <span className="text-muted-foreground italic">Not configured</span>}
              </span>
            </div>
            <div className="border-t border-border" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Monthly Budget</span>
              <span className="text-sm font-medium">${monthlyBudget}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Alert Threshold</span>
              <span className="text-sm font-medium">{alertThreshold}%</span>
            </div>
            <div className="border-t border-border" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Approval Level</span>
              <span className="text-sm font-medium">{approvalLabel}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Communication</span>
              <span className="text-sm font-medium">{commLabel}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="flex items-center justify-center gap-2 text-sm text-red-400">
            <AlertTriangle className="w-4 h-4" />
            {error}
          </div>
        )}

        <div className="max-w-md mx-auto">
          <Button
            onClick={handleComplete}
            disabled={saving}
            className="w-full h-11 bg-amber text-background hover:bg-amber/90 font-semibold"
          >
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Setting up...</>
            ) : (
              <>
                Start Building
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────

  const stepRenderers: Record<number, () => React.ReactNode> = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
  };

  return (
    <div className="space-y-8">
      {/* Step indicator */}
      <StepIndicator
        currentStep={step}
        totalSteps={TOTAL_STEPS}
        labels={STEP_LABELS}
      />

      {/* Step content with transitions */}
      <div className="min-h-[420px]">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: 'easeInOut' }}
          >
            {stepRenderers[step]?.()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigation buttons (steps 2 and 3) */}
      {(step === 2 || step === 3) && (
        <div className="flex items-center justify-between max-w-md mx-auto">
          <Button variant="ghost" onClick={goBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex items-center gap-2">
            {step === 2 && !byokRequired && !byokSaved && byokApiKey.length === 0 && (
              <Button
                variant="ghost"
                onClick={async () => {
                  setDirection(1);
                  setStep(3);
                }}
                className="text-xs text-muted-foreground hover:text-amber"
              >
                Skip — set up later
              </Button>
            )}
            <Button
              onClick={goNext}
              disabled={byokSaving}
              className="gap-2 bg-amber text-background hover:bg-amber/90"
            >
              {byokSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
              ) : step === 3 ? (
                <>Review <ArrowRight className="w-4 h-4" /></>
              ) : (
                <>Continue <ArrowRight className="w-4 h-4" /></>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Back button on final step */}
      {step === TOTAL_STEPS && (
        <div className="flex justify-center">
          <Button variant="ghost" onClick={goBack} className="gap-2 text-muted-foreground">
            <ArrowLeft className="w-4 h-4" />
            Go Back & Edit
          </Button>
        </div>
      )}
    </div>
  );
}
