'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  Shield,
  Zap,
  Key,
  Clock,
  ToggleLeft,
  Database,
  Cpu,
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

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
    agentAutoScaling: true,
    multiProjectSupport: true,
    realtimeCollaboration: true,
    advancedAnalytics: false,
    customAgentTraining: false,
    apiAccess: true,
  });

  // ─── Security state ───
  const [twoFactorAuth, setTwoFactorAuth] = useState(true);
  const [ipAllowlist, setIpAllowlist] = useState(false);

  const toggleFeature = (key: keyof typeof featureFlags) => {
    setFeatureFlags((prev) => ({ ...prev, [key]: !prev[key] }));
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
          color="#f59e0b"
        />
        <div className="space-y-0">
          <SettingField label="Default Provider">
            <select
              value={defaultProvider}
              onChange={(e) => setDefaultProvider(e.target.value)}
              className="h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 cursor-pointer"
            >
              <option value="anthropic">Anthropic</option>
              <option value="openai">OpenAI</option>
              <option value="google">Google</option>
            </select>
          </SettingField>
          <SettingField label="Default Model">
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              claude-sonnet-4-20250514
            </span>
          </SettingField>
          <SettingField label="Max Tokens per Request">
            <input
              type="number"
              value={maxTokens}
              onChange={(e) => setMaxTokens(e.target.value)}
              className="w-24 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-ring/50"
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
              className="w-20 h-8 px-2 rounded-md border border-border bg-background text-sm text-foreground text-right focus:outline-none focus:ring-2 focus:ring-ring/50"
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
          <SettingField label="Requests per minute (Starter)">
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              60
            </span>
          </SettingField>
          <SettingField label="Requests per minute (Pro)">
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              300
            </span>
          </SettingField>
          <SettingField label="Requests per minute (Enterprise)">
            <span className="font-mono text-xs bg-muted px-2 py-1 rounded">
              Unlimited
            </span>
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
          color="#8b5cf6"
        />
        <div className="space-y-4">
          {([
            { key: 'agentAutoScaling' as const, label: 'Agent Auto-scaling' },
            { key: 'multiProjectSupport' as const, label: 'Multi-project Support' },
            { key: 'realtimeCollaboration' as const, label: 'Real-time Collaboration' },
            { key: 'advancedAnalytics' as const, label: 'Advanced Analytics' },
            { key: 'customAgentTraining' as const, label: 'Custom Agent Training' },
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
        <Button className="px-6">
          Save Changes
        </Button>
      </motion.div>
    </motion.div>
  );
}
