'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Settings, Palette, CheckCircle2,
  Loader2,
  GitBranch, Globe, Copy, RefreshCw, Plus, Trash2, Send,
  Eye, EyeOff, Save,
} from 'lucide-react';

// ─── Constants ─────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
  '#f59e0b', '#ef4444', '#3b82f6', '#10b981',
  '#8b5cf6', '#ec4899', '#06b6d4', '#f97316',
];

const fadeUp = { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } };

// ─── Component ─────────────────────────────────────────────────────────────

export default function ProjectSettingsPage() {
  const params = useParams();
  const projectId = params.id as string;

  // Project details state
  const [projectName, setProjectName] = useState('');
  const [projectDesc, setProjectDesc] = useState('');
  const [projectColor, setProjectColor] = useState(PROJECT_COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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

  // ─── Load Data ─────────────────────────────────────────────────────────

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

  useEffect(() => {
    fetch(`/api/projects/${projectId}/webhooks`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setWebhookEndpoints(data);
      })
      .catch(() => {});
  }, [projectId]);

  // ─── Handlers ──────────────────────────────────────────────────────────

  async function handleSaveProject() {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDesc.trim(),
          color: projectColor,
        }),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {}
    setSaving(false);
  }

  async function handleSaveGit() {
    setSavingGit(true);
    setSavedGit(false);
    try {
      const res = await fetch(`/api/projects/${projectId}/git/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoOwner: gitRepoOwner.trim(),
          repoName: gitRepoName.trim(),
          token: gitToken.trim() || undefined,
          syncEnabled: gitSyncEnabled,
          webhookSecret: gitWebhookSecret.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSavedGit(true);
        setGitToken('');
        setGitHasToken(true);
        setTimeout(() => setSavedGit(false), 3000);
      }
    } catch {}
    setSavingGit(false);
  }

  async function handleSyncNow() {
    setSyncing(true);
    setSyncMessage('');
    try {
      const res = await fetch(`/api/projects/${projectId}/git/sync`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setSyncMessage('Sync successful!');
        setGitLastSyncAt(new Date().toISOString());
      } else {
        setSyncMessage(data.error || 'Sync failed');
      }
    } catch {
      setSyncMessage('Network error');
    }
    setSyncing(false);
  }

  async function handleAddWebhook() {
    if (!newWebhookUrl.trim()) return;
    setAddingWebhook(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/webhooks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: newWebhookUrl.trim(),
          description: newWebhookDesc.trim() || undefined,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setWebhookEndpoints(prev => [...prev, data]);
        setNewWebhookSecret(data.secret || null);
        setNewWebhookUrl('');
        setNewWebhookDesc('');
      }
    } catch {}
    setAddingWebhook(false);
  }

  async function handleDeleteWebhook(id: string) {
    try {
      await fetch(`/api/projects/${projectId}/webhooks/${id}`, { method: 'DELETE' });
      setWebhookEndpoints(prev => prev.filter(w => w.id !== id));
    } catch {}
  }

  async function handleTestWebhook(id: string) {
    setTestingWebhookId(id);
    try {
      await fetch(`/api/projects/${projectId}/webhooks/${id}/test`, { method: 'POST' });
    } catch {}
    setTimeout(() => setTestingWebhookId(null), 1500);
  }

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-border px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center">
            <Settings className="w-5 h-5 text-amber" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Project Settings</h1>
            <p className="text-sm text-muted-foreground">
              Manage project details, Git integration, and webhooks
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {/* ─── Project Details ──────────────────────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.05 }} className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Palette className="w-5 h-5 text-amber" />
              <h2 className="text-base font-semibold">Project Details</h2>
            </div>
            <Button
              onClick={handleSaveProject}
              disabled={saving || !projectName.trim()}
              size="sm"
              className="gap-2 bg-amber text-background hover:bg-amber/90"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : saved ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</>
              ) : (
                <><Save className="w-3.5 h-3.5" /> Save</>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Project Name</label>
              <Input
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="My Awesome Project"
                className="h-10 bg-foreground/[0.03] border-border focus:border-amber/30"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Description</label>
              <Textarea
                value={projectDesc}
                onChange={e => setProjectDesc(e.target.value)}
                placeholder="What is this project about?"
                className="min-h-[80px] bg-foreground/[0.03] border-border focus:border-amber/30 resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Project Color</label>
              <div className="flex gap-2">
                {PROJECT_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setProjectColor(color)}
                    className={cn(
                      'w-8 h-8 rounded-full transition-all duration-150',
                      projectColor === color
                        ? 'ring-2 ring-offset-2 ring-offset-background ring-amber scale-110'
                        : 'hover:scale-105',
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        <div className="border-t border-border" />

        {/* ─── Git Integration ──────────────────────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.1 }} className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <GitBranch className="w-5 h-5 text-amber" />
              <h2 className="text-base font-semibold">Git Integration</h2>
              {gitHasToken && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 font-medium">
                  Connected
                </span>
              )}
            </div>
            <Button
              onClick={handleSaveGit}
              disabled={savingGit}
              size="sm"
              className="gap-2 bg-amber text-background hover:bg-amber/90"
            >
              {savingGit ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : savedGit ? (
                <><CheckCircle2 className="w-3.5 h-3.5" /> Saved</>
              ) : (
                <><Save className="w-3.5 h-3.5" /> Save</>
              )}
            </Button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Repository Owner</label>
                <Input
                  value={gitRepoOwner}
                  onChange={e => setGitRepoOwner(e.target.value)}
                  placeholder="github-username"
                  className="h-10 bg-foreground/[0.03] border-border focus:border-amber/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Repository Name</label>
                <Input
                  value={gitRepoName}
                  onChange={e => setGitRepoName(e.target.value)}
                  placeholder="my-project"
                  className="h-10 bg-foreground/[0.03] border-border focus:border-amber/30"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">
                GitHub Token {gitHasToken && <span className="text-emerald-500">(configured)</span>}
              </label>
              <div className="relative">
                <Input
                  type={showGitToken ? 'text' : 'password'}
                  value={gitToken}
                  onChange={e => setGitToken(e.target.value)}
                  placeholder={gitHasToken ? '••••••••••••' : 'ghp_xxxxxxxxxxxx'}
                  className="pr-10 h-10 bg-foreground/[0.03] border-border focus:border-amber/30"
                />
                <button
                  type="button"
                  onClick={() => setShowGitToken(!showGitToken)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                >
                  {showGitToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Webhook Secret (optional)</label>
              <Input
                value={gitWebhookSecret}
                onChange={e => setGitWebhookSecret(e.target.value)}
                placeholder="your-webhook-secret"
                className="h-10 bg-foreground/[0.03] border-border focus:border-amber/30"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg bg-surface-raised border border-border">
              <div>
                <p className="text-sm font-medium">Auto-sync</p>
                <p className="text-xs text-muted-foreground">Push changes to GitHub automatically</p>
              </div>
              <Switch
                checked={gitSyncEnabled}
                onCheckedChange={setGitSyncEnabled}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                onClick={handleSyncNow}
                disabled={syncing || !gitRepoOwner || !gitRepoName}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {syncing ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Syncing...</>
                ) : (
                  <><RefreshCw className="w-3.5 h-3.5" /> Sync Now</>
                )}
              </Button>
              {syncMessage && (
                <span className={cn(
                  'text-xs',
                  syncMessage.includes('successful') ? 'text-emerald-500' : 'text-red-400',
                )}>
                  {syncMessage}
                </span>
              )}
              {gitLastSyncAt && (
                <span className="text-[10px] text-muted-foreground/50">
                  Last sync: {new Date(gitLastSyncAt).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </motion.section>

        <div className="border-t border-border" />

        {/* ─── Webhooks ─────────────────────────────────────────────────── */}
        <motion.section {...fadeUp} transition={{ delay: 0.15 }} className="space-y-5 pb-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Globe className="w-5 h-5 text-amber" />
              <h2 className="text-base font-semibold">Webhooks</h2>
              {webhookEndpoints.length > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-foreground/[0.04] text-muted-foreground font-medium">
                  {webhookEndpoints.length} endpoint{webhookEndpoints.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <Button
              onClick={() => setShowAddWebhook(!showAddWebhook)}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Webhook
            </Button>
          </div>

          {/* Add webhook form */}
          {showAddWebhook && (
            <div className="p-4 rounded-xl border border-border bg-surface-raised space-y-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Endpoint URL</label>
                <Input
                  value={newWebhookUrl}
                  onChange={e => setNewWebhookUrl(e.target.value)}
                  placeholder="https://your-server.com/webhook"
                  className="h-10 bg-foreground/[0.03] border-border focus:border-amber/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">Description (optional)</label>
                <Input
                  value={newWebhookDesc}
                  onChange={e => setNewWebhookDesc(e.target.value)}
                  placeholder="e.g., Notify Slack on deployment"
                  className="h-10 bg-foreground/[0.03] border-border focus:border-amber/30"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAddWebhook}
                  disabled={addingWebhook || !newWebhookUrl.trim()}
                  size="sm"
                  className="gap-2 bg-amber text-background hover:bg-amber/90"
                >
                  {addingWebhook ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  Create
                </Button>
                <Button
                  onClick={() => {
                    setShowAddWebhook(false);
                    setNewWebhookUrl('');
                    setNewWebhookDesc('');
                    setNewWebhookSecret(null);
                  }}
                  variant="ghost"
                  size="sm"
                >
                  Cancel
                </Button>
              </div>
              {newWebhookSecret && (
                <div className="p-3 rounded-lg bg-amber/5 border border-amber/20">
                  <p className="text-xs font-medium text-amber mb-1.5">Signing Secret (save this — shown once):</p>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-background p-1.5 rounded flex-1 truncate">
                      {newWebhookSecret}
                    </code>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      onClick={() => navigator.clipboard.writeText(newWebhookSecret)}
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Webhook list */}
          {webhookEndpoints.length > 0 ? (
            <div className="space-y-2">
              {webhookEndpoints.map(wh => (
                <div
                  key={wh.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-surface-raised"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{wh.url}</p>
                    {wh.description && (
                      <p className="text-xs text-muted-foreground mt-0.5">{wh.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-3">
                    <Button
                      onClick={() => handleTestWebhook(wh.id)}
                      disabled={testingWebhookId === wh.id}
                      variant="ghost"
                      size="icon-xs"
                      title="Send test event"
                    >
                      {testingWebhookId === wh.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                    </Button>
                    <Button
                      onClick={() => handleDeleteWebhook(wh.id)}
                      variant="ghost"
                      size="icon-xs"
                      className="text-red-400 hover:text-red-300"
                      title="Delete webhook"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : !showAddWebhook && (
            <div className="text-center py-8 text-muted-foreground/50">
              <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No webhook endpoints configured</p>
              <p className="text-xs mt-1">Add a webhook to receive real-time notifications about project events</p>
            </div>
          )}
        </motion.section>
      </div>
    </div>
  );
}
