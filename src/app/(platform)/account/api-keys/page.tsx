'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Key, Plus, Trash2, Copy, Check, Loader2, ArrowLeft,
  Eye, EyeOff, AlertTriangle, Shield,
} from 'lucide-react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

interface ApiKeyInfo {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [limit, setLimit] = useState(2);
  const [used, setUsed] = useState(0);
  const [loading, setLoading] = useState(true);

  // Create key state
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);

  // Newly created key (shown once)
  const [newRawKey, setNewRawKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Revoke state
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const loadKeys = () => {
    fetch('/api/user/api-keys')
      .then((r) => r.json())
      .then((data) => {
        setKeys(data.keys ?? []);
        setLimit(data.limit ?? 2);
        setUsed(data.used ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(loadKeys, []);

  const handleCreate = async () => {
    if (!newKeyName.trim()) return;
    setCreating(true);
    try {
      const res = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newKeyName.trim(), scopes: ['read', 'write'] }),
      });
      const result = await res.json();
      if (res.ok && result.rawKey) {
        setNewRawKey(result.rawKey);
        setNewKeyName('');
        setShowCreate(false);
        loadKeys();
      }
    } catch {
      // handle error
    }
    setCreating(false);
  };

  const handleRevoke = async (keyId: string) => {
    setRevokingId(keyId);
    try {
      await fetch(`/api/user/api-keys/${keyId}`, { method: 'DELETE' });
      loadKeys();
    } catch {
      // handle error
    }
    setRevokingId(null);
  };

  const handleCopy = () => {
    if (newRawKey) {
      navigator.clipboard.writeText(newRawKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-3xl mx-auto space-y-6"
          >
            {/* Header */}
            <motion.div variants={itemVariants} className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/projects">
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <ArrowLeft className="w-4 h-4" />
                  </Button>
                </Link>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">API Keys</h1>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Manage API keys for external integrations
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-mono text-xs">
                  {used}/{limit} keys used
                </Badge>
                <Button
                  size="sm"
                  onClick={() => setShowCreate(true)}
                  disabled={used >= limit}
                  className="gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" /> Create Key
                </Button>
              </div>
            </motion.div>

            {/* Newly created key banner */}
            {newRawKey && (
              <motion.div
                variants={itemVariants}
                className="rounded-xl border border-amber-500/50 bg-amber-500/5 p-5"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground mb-1">
                      Your API key was created
                    </p>
                    <p className="text-xs text-muted-foreground mb-3">
                      Copy your key now. You won&apos;t be able to see it again.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 min-w-0 px-3 py-2 bg-background border border-border rounded-md text-xs font-mono text-foreground truncate">
                        {newRawKey}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopy}
                        className="shrink-0 gap-1.5"
                      >
                        {copied ? (
                          <><Check className="w-3.5 h-3.5" /> Copied</>
                        ) : (
                          <><Copy className="w-3.5 h-3.5" /> Copy</>
                        )}
                      </Button>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setNewRawKey(null)}
                    className="text-muted-foreground text-xs"
                  >
                    Dismiss
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Create key form */}
            {showCreate && (
              <motion.div
                variants={itemVariants}
                className="glass-card rounded-xl border border-border/50 p-5"
              >
                <h3 className="text-sm font-semibold text-foreground mb-3">Create new API key</h3>
                <div className="flex items-center gap-3">
                  <Input
                    placeholder="Key name (e.g., CI/CD Pipeline)"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={handleCreate}
                    disabled={creating || !newKeyName.trim()}
                    size="sm"
                    className="gap-1.5"
                  >
                    {creating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Key className="w-3.5 h-3.5" />
                    )}
                    Generate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setShowCreate(false); setNewKeyName(''); }}
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Keys list */}
            <motion.div
              variants={itemVariants}
              className="glass-card rounded-xl border border-border/50 p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Active Keys</h3>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : keys.length === 0 ? (
                <div className="text-center py-10">
                  <Key className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No API keys yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">
                    Create your first key to get started with the API
                  </p>
                </div>
              ) : (
                <div className="space-y-1">
                  {keys.map((key) => (
                    <div
                      key={key.id}
                      className="flex items-center justify-between py-3 border-b border-border/30 last:border-0"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                          <Key className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{key.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <code className="text-xs font-mono text-muted-foreground">
                              {key.keyPrefix}...
                            </code>
                            <span className="text-[10px] text-muted-foreground/60">
                              {key.scopes.join(', ')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {key.lastUsedAt
                              ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                              : 'Never used'}
                          </p>
                          <p className="text-[10px] text-muted-foreground/60">
                            Created {new Date(key.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive/60 hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRevoke(key.id)}
                          disabled={revokingId === key.id}
                        >
                          {revokingId === key.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>

            {/* Usage info */}
            <motion.div variants={itemVariants} className="text-xs text-muted-foreground/60 text-center pb-6">
              API keys authenticate requests using <code className="px-1 py-0.5 bg-muted rounded text-[10px]">Authorization: Bearer ats_sk_...</code> header.
              Keys are hashed using SHA-256 and cannot be recovered if lost.
            </motion.div>
          </motion.div>
        </main>
      </div>
    </div>
  );
}
