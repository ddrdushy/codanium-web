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

export default function SettingsPage() {
  // ─── LLM Configuration state ───
  const [defaultProvider, setDefaultProvider] = useState('anthropic');
  const [maxTokens, setMaxTokens] = useState('4096');
  const [temperature, setTemperature] = useState('0.7');

  // ─── Feature Flags state ───
  const [featureFlags, setFeatureFlags] = useState({
    autoScaling: true,
    multiProject: true,
    realTimeCollab: true,
    advancedAnalytics: false,
    customTraining: false,
    apiAccess: true,
  });

  // ─── Email Configuration state ───
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [emailApiKey, setEmailApiKey] = useState('');
  const [emailFromAddress, setEmailFromAddress] = useState('noreply@yourdomain.com');
  const [emailFromName, setEmailFromName] = useState('AI Team Studio');
  const [testingEmail, setTestingEmail] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // ─── Stripe Configuration state ───
  const [stripeEnabled, setStripeEnabled] = useState(false);
  const [stripeSecretKey, setStripeSecretKey] = useState('');
  const [stripeWebhookSecret, setStripeWebhookSecret] = useState('');

  // ─── Security state ───
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [ipAllowlist, setIpAllowlist] = useState(false);

  // ─── Save state ───
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // ─── Load settings from API on mount ───
  useEffect(() => {
    fetchAdminSettings()
      .then((settings) => {
        if (settings['llm.defaultProvider']) {
          setDefaultProvider(settings['llm.defaultProvider']);
        }
        if (settings['llm.maxTokens'] !== undefined) {
          setMaxTokens(String(settings['llm.maxTokens']));
        }
        if (settings['llm.temperature'] !== undefined) {
          setTemperature(String(settings['llm.temperature']));
        }
        if (settings['featureFlags']) {
          const ff = settings['featureFlags'];
          setFeatureFlags((prev) => ({
            autoScaling: ff.autoScaling ?? prev.autoScaling,
            multiProject: ff.multiProject ?? prev.multiProject,
            realTimeCollab: ff.realTimeCollab ?? prev.realTimeCollab,
            advancedAnalytics: ff.advancedAnalytics ?? prev.advancedAnalytics,
            customTraining: ff.customTraining ?? prev.customTraining,
            apiAccess: ff.apiAccess ?? prev.apiAccess,
          }));
        }
        // Email settings
        if (settings['email.enabled'] !== undefined) {
          setEmailEnabled(settings['email.enabled']);
        }
        if (settings['email.apiKey']) {
          setEmailApiKey(settings['email.apiKey']);
        }
        if (settings['email.fromAddress']) {
          setEmailFromAddress(settings['email.fromAddress']);
        }
        if (settings['email.fromName']) {
          setEmailFromName(settings['email.fromName']);
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
      })
      .catch(() => {/* keep defaults */});
  }, []);

  const toggleFeature = (key: keyof typeof featureFlags) => {
    setFeatureFlags((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Save handler ───
  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await saveAdminSettings({
        'llm.defaultProvider': defaultProvider,
        'llm.maxTokens': Number(maxTokens),
        'llm.temperature': Number(temperature),
        featureFlags,
        'email.enabled': emailEnabled,
        'email.apiKey': emailApiKey,
        'email.fromAddress': emailFromAddress,
        'email.fromName': emailFromName,
        'stripe.enabled': stripeEnabled,
        'stripe.secretKey': stripeSecretKey,
        'stripe.webhookSecret': stripeWebhookSecret,
        'security.twoFactorAuth': twoFactorAuth,
        'security.ipAllowlist': ipAllowlist,
      });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
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
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Platform configuration and preferences
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
              onChange={(e) => setDefaultProvider(e.target.value)}
              className="h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50 cursor-pointer"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
            </select>
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
        </div>
      </motion.div>

      {/* Rate Limits */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Zap className="w-4 h-4" />}
          title="Rate Limits"
          subtitle="Request throttling per plan tier"
          color="#3b82f6"
        />
        <div className="space-y-0">
          <SettingField label="Starter">
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              60 RPM
            </span>
          </SettingField>
          <SettingField label="Pro">
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              300 RPM
            </span>
          </SettingField>
          <SettingField label="Enterprise">
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              Unlimited
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
          subtitle="SendGrid transactional email settings"
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
          <SettingField label="SendGrid API Key">
            <input
              type="password"
              value={emailApiKey}
              onChange={(e) => setEmailApiKey(e.target.value)}
              placeholder="SG.xxxxxxxxxxxx"
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
              placeholder="AI Team Studio"
              className="w-52 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
          <div className="flex items-center justify-between py-3">
            <span className="text-sm text-muted-foreground">Send Test Email</span>
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
          </div>
        </div>
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
            { key: 'autoScaling' as const, label: 'Agent Auto-scaling' },
            { key: 'multiProject' as const, label: 'Multi-project Support' },
            { key: 'realTimeCollab' as const, label: 'Real-time Collaboration' },
            { key: 'advancedAnalytics' as const, label: 'Advanced Analytics' },
            { key: 'customTraining' as const, label: 'Custom Agent Training' },
            { key: 'apiAccess' as const, label: 'API Access' },
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
      <motion.div variants={itemVariants} className="flex justify-end pb-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="px-6 gap-2"
          style={{
            backgroundColor:
              saveStatus === 'saved' ? '#10b981' : undefined,
          }}
        >
          {saving ? (
            'Saving...'
          ) : saveStatus === 'saved' ? (
            <>
              <Check className="w-4 h-4" />
              Saved
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </motion.div>
    </motion.div>
  );
}
