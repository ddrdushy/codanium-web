'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  Shield,
  Clock,
  Eye,
  Fingerprint,
  Code2,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { fetchAdminSettings, saveAdminSettings } from '@/lib/api';

// ─── Animation variants (same as settings page) ───
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

// ─── Guardrail Config Type ───
interface GuardrailConfig {
  input: {
    enabled: boolean;
    maxLength: number;
    injectionDetection: boolean;
    piiDetection: boolean;
    rateLimiting: boolean;
  };
  output: {
    enabled: boolean;
    maxLength: number;
    unsafeCodeDetection: boolean;
    actionValidation: boolean;
    blockOnCritical: boolean;
  };
  rateLimit: {
    maxRequests: number;
    windowSeconds: number;
  };
  injectionPatterns: Array<{ label: string; pattern: string; enabled: boolean }>;
  piiPatterns: Array<{ label: string; pattern: string; replacement: string; enabled: boolean }>;
  unsafeCodePatterns: Array<{ label: string; pattern: string; enabled: boolean }>;
}

// ─── Defaults (mirrors guardrails.ts) ───
const DEFAULT_CONFIG: GuardrailConfig = {
  input: {
    enabled: true,
    maxLength: 50000,
    injectionDetection: true,
    piiDetection: true,
    rateLimiting: true,
  },
  output: {
    enabled: true,
    maxLength: 100000,
    unsafeCodeDetection: true,
    actionValidation: true,
    blockOnCritical: false,
  },
  rateLimit: {
    maxRequests: 20,
    windowSeconds: 60,
  },
  injectionPatterns: [
    { label: 'Ignore Previous Instructions', pattern: 'ignore\\s+(all\\s+)?previous\\s+(instructions|prompts|rules)', enabled: true },
    { label: 'Role Override Attempt', pattern: 'you\\s+are\\s+now\\s+(a|an|the)\\s+', enabled: true },
    { label: 'Jailbreak Keyword', pattern: '\\bjailbreak\\b', enabled: true },
    { label: 'DAN Mode Attempt', pattern: '\\bDAN\\b.*\\bmode\\b|\\bmode\\b.*\\bDAN\\b', enabled: true },
    { label: 'System Tag Injection', pattern: '<\\s*system\\s*>', enabled: true },
    { label: 'Memory Wipe Attempt', pattern: 'forget\\s+(everything|all|your)\\s+(you|instructions|rules|training)', enabled: true },
    { label: 'Identity Override', pattern: 'pretend\\s+(you\\s+)?(are|to\\s+be)\\s+(a|an|the)\\s+', enabled: true },
    { label: 'Safety Bypass Attempt', pattern: 'bypass\\s+(your\\s+)?(safety|content|ethical|guardrail|filter|restriction)', enabled: true },
    { label: 'Restriction Removal', pattern: '\\bact\\s+as\\s+(if|though)\\s+(you\\s+)?(have\\s+)?no\\s+(restrictions|limits|rules)', enabled: true },
  ],
  piiPatterns: [
    { label: 'US Social Security Number', pattern: '\\b\\d{3}[-\\s]?\\d{2}[-\\s]?\\d{4}\\b', replacement: '[REDACTED-SSN]', enabled: true },
    { label: 'Credit Card Number', pattern: '\\b(?:\\d{4}[-\\s]?){3,4}\\d{1,4}\\b', replacement: '[REDACTED-CC]', enabled: true },
    { label: 'US Passport Number', pattern: '\\b[A-Z]?\\d{8,9}\\b', replacement: '[REDACTED-PASSPORT]', enabled: true },
  ],
  unsafeCodePatterns: [
    { label: 'Destructive rm -rf', pattern: 'rm\\s+-rf\\s+\\/', enabled: true },
    { label: 'SQL DROP Statement', pattern: 'DROP\\s+(TABLE|DATABASE|SCHEMA)\\s+', enabled: true },
    { label: 'eval() Usage', pattern: '\\beval\\s*\\(', enabled: true },
    { label: 'exec() Usage', pattern: '\\bexec\\s*\\(', enabled: true },
    { label: 'Environment Variable Mutation', pattern: 'process\\.env\\.\\w+\\s*=\\s*', enabled: true },
    { label: 'Shell Execution', pattern: 'child_process|spawn\\s*\\(|execSync\\s*\\(', enabled: true },
  ],
};

// ─── Section header component (same as settings page) ───
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

// ─── Settings field row (same as settings page) ───
function SettingField({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border/30 last:border-0">
      <div className="flex-1 min-w-0 mr-4">
        <span className="text-sm text-muted-foreground">{label}</span>
        {description && (
          <p className="text-[11px] text-muted-foreground/60 mt-0.5">{description}</p>
        )}
      </div>
      <div className="text-sm font-medium text-foreground shrink-0">{children}</div>
    </div>
  );
}

// ─── Deep merge with defaults ───
function mergeWithDefaults(saved: Partial<GuardrailConfig>): GuardrailConfig {
  return {
    input: { ...DEFAULT_CONFIG.input, ...saved.input },
    output: { ...DEFAULT_CONFIG.output, ...saved.output },
    rateLimit: { ...DEFAULT_CONFIG.rateLimit, ...saved.rateLimit },
    injectionPatterns: saved.injectionPatterns ?? DEFAULT_CONFIG.injectionPatterns,
    piiPatterns: saved.piiPatterns ?? DEFAULT_CONFIG.piiPatterns,
    unsafeCodePatterns: saved.unsafeCodePatterns ?? DEFAULT_CONFIG.unsafeCodePatterns,
  };
}

export default function GuardrailsPage() {
  const [config, setConfig] = useState<GuardrailConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  // ─── Load on mount ───
  useEffect(() => {
    fetchAdminSettings()
      .then((settings) => {
        if (settings['guardrails.config']) {
          setConfig(mergeWithDefaults(settings['guardrails.config']));
        }
      })
      .catch(() => {/* keep defaults */});
  }, []);

  // ─── Update helpers ───
  const updateInput = (field: keyof GuardrailConfig['input'], value: boolean | number) => {
    setConfig((prev) => ({ ...prev, input: { ...prev.input, [field]: value } }));
  };

  const updateOutput = (field: keyof GuardrailConfig['output'], value: boolean | number) => {
    setConfig((prev) => ({ ...prev, output: { ...prev.output, [field]: value } }));
  };

  const updateRateLimit = (field: keyof GuardrailConfig['rateLimit'], value: number) => {
    setConfig((prev) => ({ ...prev, rateLimit: { ...prev.rateLimit, [field]: value } }));
  };

  const toggleInjectionPattern = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      injectionPatterns: prev.injectionPatterns.map((p, i) =>
        i === index ? { ...p, enabled: !p.enabled } : p
      ),
    }));
  };

  const togglePiiPattern = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      piiPatterns: prev.piiPatterns.map((p, i) =>
        i === index ? { ...p, enabled: !p.enabled } : p
      ),
    }));
  };

  const toggleUnsafeCodePattern = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      unsafeCodePatterns: prev.unsafeCodePatterns.map((p, i) =>
        i === index ? { ...p, enabled: !p.enabled } : p
      ),
    }));
  };

  // ─── Save handler ───
  const handleSave = async () => {
    setSaving(true);
    setSaveStatus('idle');
    try {
      await saveAdminSettings({ 'guardrails.config': config });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } finally {
      setSaving(false);
    }
  };

  // Count enabled/total for summary badges
  const injectionEnabled = config.injectionPatterns.filter((p) => p.enabled).length;
  const piiEnabled = config.piiPatterns.filter((p) => p.enabled).length;
  const unsafeEnabled = config.unsafeCodePatterns.filter((p) => p.enabled).length;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 max-w-4xl"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-foreground">AI Guardrails</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure safety guardrails for AI agent inputs and outputs
        </p>
      </motion.div>

      {/* ─── Section 1: Input Guardrails ─── */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<ShieldAlert className="w-4 h-4" />}
          title="Input Guardrails"
          subtitle="Validate and sanitize user messages before processing"
          color="#ef4444"
        />
        <div className="space-y-0">
          <SettingField
            label="Prompt Injection Detection"
            description="Block messages that attempt to override agent instructions"
          >
            <Switch
              checked={config.input.injectionDetection}
              onCheckedChange={(v) => updateInput('injectionDetection', v)}
            />
          </SettingField>
          <SettingField
            label="PII Detection & Redaction"
            description="Detect and redact sensitive information (SSN, credit cards, etc.)"
          >
            <Switch
              checked={config.input.piiDetection}
              onCheckedChange={(v) => updateInput('piiDetection', v)}
            />
          </SettingField>
          <SettingField
            label="Rate Limiting"
            description="Throttle requests per user to prevent abuse"
          >
            <Switch
              checked={config.input.rateLimiting}
              onCheckedChange={(v) => updateInput('rateLimiting', v)}
            />
          </SettingField>
          <SettingField label="Max Input Message Length">
            <input
              type="number"
              value={config.input.maxLength}
              onChange={(e) => updateInput('maxLength', Number(e.target.value) || 50000)}
              className="w-28 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
        </div>
      </motion.div>

      {/* ─── Section 2: Rate Limiting ─── */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Clock className="w-4 h-4" />}
          title="Rate Limiting"
          subtitle="Control request frequency per user"
          color="#f59e0b"
        />
        <div className="space-y-0">
          <SettingField
            label="Max Requests Per Window"
            description="Maximum number of messages a user can send within the time window"
          >
            <input
              type="number"
              value={config.rateLimit.maxRequests}
              onChange={(e) => updateRateLimit('maxRequests', Number(e.target.value) || 20)}
              min={1}
              max={1000}
              className="w-20 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
          <SettingField
            label="Window Duration (seconds)"
            description="Time window for rate limiting (e.g., 60 = 1 minute)"
          >
            <input
              type="number"
              value={config.rateLimit.windowSeconds}
              onChange={(e) => updateRateLimit('windowSeconds', Number(e.target.value) || 60)}
              min={10}
              max={3600}
              className="w-20 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
        </div>
      </motion.div>

      {/* ─── Section 3: Output Guardrails ─── */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Eye className="w-4 h-4" />}
          title="Output Guardrails"
          subtitle="Monitor and validate AI agent responses"
          color="#3b82f6"
        />
        <div className="space-y-0">
          <SettingField
            label="Unsafe Code Detection"
            description="Flag dangerous code patterns (rm -rf, DROP TABLE, eval, etc.)"
          >
            <Switch
              checked={config.output.unsafeCodeDetection}
              onCheckedChange={(v) => updateOutput('unsafeCodeDetection', v)}
            />
          </SettingField>
          <SettingField
            label="Action Validation"
            description="Validate required fields on agent actions (cards, decisions, etc.)"
          >
            <Switch
              checked={config.output.actionValidation}
              onCheckedChange={(v) => updateOutput('actionValidation', v)}
            />
          </SettingField>
          <SettingField
            label="Block on Critical Issues"
            description="Block responses with critical safety issues instead of just logging"
          >
            <Switch
              checked={config.output.blockOnCritical}
              onCheckedChange={(v) => updateOutput('blockOnCritical', v)}
            />
          </SettingField>
          <SettingField label="Max Output Response Length">
            <input
              type="number"
              value={config.output.maxLength}
              onChange={(e) => updateOutput('maxLength', Number(e.target.value) || 100000)}
              className="w-28 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/50"
            />
          </SettingField>
        </div>
      </motion.div>

      {/* ─── Section 4: Prompt Injection Patterns ─── */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Fingerprint className="w-4 h-4" />}
          title="Prompt Injection Patterns"
          subtitle={`${injectionEnabled} of ${config.injectionPatterns.length} patterns enabled`}
          color="#8b5cf6"
        />

        <div className="rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-foreground/[0.02] border-b border-border/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pattern Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Regex</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {config.injectionPatterns.map((p, i) => (
                <tr
                  key={p.label}
                  className="border-b border-border/20 last:border-0 hover:bg-foreground/[0.02] transition-colors"
                >
                  <td className="px-4 py-2.5 text-foreground font-medium">{p.label}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <code
                      className="text-[11px] font-mono text-muted-foreground bg-foreground/[0.04] px-1.5 py-0.5 rounded max-w-[300px] truncate block"
                      title={p.pattern}
                    >
                      {p.pattern}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={() => toggleInjectionPattern(i)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/15">
          <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-500/80">
            Disabling injection detection patterns reduces protection against prompt injection attacks. Proceed with caution.
          </p>
        </div>
      </motion.div>

      {/* ─── Section 5: PII Detection Patterns ─── */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Shield className="w-4 h-4" />}
          title="PII Detection Patterns"
          subtitle={`${piiEnabled} of ${config.piiPatterns.length} patterns enabled`}
          color="#0d9488"
        />

        <div className="rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-foreground/[0.02] border-b border-border/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pattern Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Replacement</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {config.piiPatterns.map((p, i) => (
                <tr
                  key={p.label}
                  className="border-b border-border/20 last:border-0 hover:bg-foreground/[0.02] transition-colors"
                >
                  <td className="px-4 py-2.5 text-foreground font-medium">{p.label}</td>
                  <td className="px-4 py-2.5">
                    <code className="text-[11px] font-mono text-teal-500 bg-teal-500/[0.06] px-1.5 py-0.5 rounded">
                      {p.replacement}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={() => togglePiiPattern(i)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* ─── Section 6: Unsafe Code Patterns ─── */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <SectionHeader
          icon={<Code2 className="w-4 h-4" />}
          title="Unsafe Code Patterns"
          subtitle={`${unsafeEnabled} of ${config.unsafeCodePatterns.length} patterns enabled`}
          color="#ef4444"
        />

        <div className="rounded-lg border border-border/40 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-foreground/[0.02] border-b border-border/30">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pattern Name</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Regex</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-24">Enabled</th>
              </tr>
            </thead>
            <tbody>
              {config.unsafeCodePatterns.map((p, i) => (
                <tr
                  key={p.label}
                  className="border-b border-border/20 last:border-0 hover:bg-foreground/[0.02] transition-colors"
                >
                  <td className="px-4 py-2.5 text-foreground font-medium">{p.label}</td>
                  <td className="px-4 py-2.5 hidden md:table-cell">
                    <code
                      className="text-[11px] font-mono text-muted-foreground bg-foreground/[0.04] px-1.5 py-0.5 rounded max-w-[300px] truncate block"
                      title={p.pattern}
                    >
                      {p.pattern}
                    </code>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <Switch
                      checked={p.enabled}
                      onCheckedChange={() => toggleUnsafeCodePattern(i)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-start gap-2 mt-4 p-3 rounded-lg bg-blue-500/5 border border-blue-500/15">
          <Eye className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
          <p className="text-xs text-blue-400/80">
            Unsafe code patterns are flagged for monitoring. Enable &quot;Block on Critical Issues&quot; in Output Guardrails to block responses containing these patterns.
          </p>
        </div>
      </motion.div>

      {/* ─── Save Button ─── */}
      <motion.div variants={itemVariants} className="flex justify-end pb-6">
        <Button
          onClick={handleSave}
          disabled={saving}
          className="px-6 gap-2"
          style={{
            backgroundColor:
              saveStatus === 'saved'
                ? '#10b981'
                : saveStatus === 'error'
                ? '#ef4444'
                : undefined,
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
