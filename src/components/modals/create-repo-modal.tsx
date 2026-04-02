'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Github,
  Key,
  Loader2,
  CheckCircle2,
  XCircle,
  Lock,
  Globe,
  Building2,
  User,
  ExternalLink,
  FileText,
  Rocket,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreateRepoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  artifactCount: number;
  onRepoCreated?: (repo: { fullName: string; htmlUrl: string }) => void;
}

type Step = 'token' | 'details' | 'creating' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateRepoModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  artifactCount,
  onRepoCreated,
}: CreateRepoModalProps) {
  // Step state
  const [step, setStep] = useState<Step>('token');

  // Token step
  const [token, setToken] = useState('');
  const [validatingToken, setValidatingToken] = useState(false);
  const [tokenError, setTokenError] = useState('');

  // User/org info (loaded after token validation)
  const [githubLogin, setGithubLogin] = useState('');
  const [githubOrgs, setGithubOrgs] = useState<string[]>([]);

  // Details step
  const [repoName, setRepoName] = useState('');
  const [description, setDescription] = useState('');
  const [owner, setOwner] = useState('');  // github login or org name
  const [isPrivate, setIsPrivate] = useState(true);
  const [pushArtifacts, setPushArtifacts] = useState(false);

  // Result
  const [result, setResult] = useState<{ fullName: string; htmlUrl: string } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Reset when opened
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setStep('token');
      setToken('');
      setValidatingToken(false);
      setTokenError('');
      setGithubLogin('');
      setGithubOrgs([]);
      // Generate repo name from project name
      const slug = projectName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      setRepoName(slug || 'my-project');
      setDescription('');
      setOwner('');
      setIsPrivate(true);
      setPushArtifacts(artifactCount > 0);
      setResult(null);
      setErrorMessage('');
    }
    onOpenChange(v);
  };

  // Set default owner when login is loaded
  useEffect(() => {
    if (githubLogin && !owner) {
      setOwner(githubLogin);
    }
  }, [githubLogin, owner]);

  // Validate token and get user/orgs
  const handleValidateToken = async () => {
    setValidatingToken(true);
    setTokenError('');

    try {
      const res = await fetch('/api/git/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setTokenError(data.error ?? 'Token validation failed');
        setValidatingToken(false);
        return;
      }

      setGithubLogin(data.login);
      setGithubOrgs(data.orgs ?? []);
      setOwner(data.login);
      setStep('details');
    } catch {
      setTokenError('Network error. Please try again.');
    }
    setValidatingToken(false);
  };

  // Create repository
  const handleCreate = async () => {
    setStep('creating');
    setErrorMessage('');

    try {
      const body: Record<string, unknown> = {
        token: token.trim(),
        repoName: repoName.trim(),
        description: description.trim() || undefined,
        isPrivate,
        pushArtifacts,
      };

      // If owner is an org (not the user's login), pass as org
      if (owner && owner !== githubLogin) {
        body.org = owner;
      }

      const res = await fetch(`/api/projects/${projectId}/git/create-repo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        setStep('error');
        setErrorMessage(data.error ?? 'Failed to create repository');
        return;
      }

      setResult({
        fullName: data.repo.fullName,
        htmlUrl: data.repo.htmlUrl,
      });
      setStep('success');
      onRepoCreated?.(data.repo);
    } catch {
      setStep('error');
      setErrorMessage('Network error. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[var(--surface)] border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Github className="w-5 h-5 text-amber" />
            Create GitHub Repository
          </DialogTitle>
          <DialogDescription>
            Create a new GitHub repository for your project
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* ── Step 1: Token ── */}
          {step === 'token' && (
            <motion.div
              key="token"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 py-2"
            >
              <div className="rounded-lg border border-border bg-white/[0.02] p-3">
                <p className="text-xs text-muted-foreground/70">
                  Enter a GitHub Personal Access Token (classic) with <strong>repo</strong> scope.
                  This token will be encrypted and stored securely.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="gh-token" className="text-xs font-medium">
                  Personal Access Token
                </Label>
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  <Input
                    id="gh-token"
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                    className="font-mono text-xs"
                  />
                </div>
                {tokenError && (
                  <p className="text-[11px] text-red-400 flex items-center gap-1 mt-1">
                    <XCircle className="w-3 h-3" /> {tokenError}
                  </p>
                )}
              </div>

              <a
                href="https://github.com/settings/tokens/new?scopes=repo&description=AI+Team+Studio"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-[11px] text-amber hover:text-amber/80 transition-colors"
              >
                Generate a token on GitHub
                <ExternalLink className="w-3 h-3" />
              </a>
            </motion.div>
          )}

          {/* ── Step 2: Details ── */}
          {step === 'details' && (
            <motion.div
              key="details"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 py-2"
            >
              {/* Logged in as */}
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20 p-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-xs text-emerald-400">
                  Authenticated as <strong>{githubLogin}</strong>
                </span>
              </div>

              {/* Owner selector */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Repository Owner</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setOwner(githubLogin)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                      owner === githubLogin
                        ? 'bg-amber/10 text-amber border-amber/20'
                        : 'bg-white/[0.02] text-muted-foreground border-border hover:border-white/10'
                    )}
                  >
                    <User className="w-3 h-3" />
                    {githubLogin}
                  </button>
                  {githubOrgs.map((org) => (
                    <button
                      key={org}
                      onClick={() => setOwner(org)}
                      className={cn(
                        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all',
                        owner === org
                          ? 'bg-amber/10 text-amber border-amber/20'
                          : 'bg-white/[0.02] text-muted-foreground border-border hover:border-white/10'
                      )}
                    >
                      <Building2 className="w-3 h-3" />
                      {org}
                    </button>
                  ))}
                </div>
              </div>

              {/* Repo name */}
              <div className="space-y-1.5">
                <Label htmlFor="repo-name" className="text-xs font-medium">
                  Repository Name
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground/50 font-mono shrink-0">
                    {owner}/
                  </span>
                  <Input
                    id="repo-name"
                    value={repoName}
                    onChange={(e) => setRepoName(e.target.value.replace(/[^a-zA-Z0-9._-]/g, ''))}
                    placeholder="my-project"
                    className="font-mono text-xs"
                  />
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="repo-desc" className="text-xs font-medium">
                  Description <span className="text-muted-foreground/40">(optional)</span>
                </Label>
                <Input
                  id="repo-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Built by Codanium"
                  className="text-xs"
                />
              </div>

              {/* Visibility toggle */}
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsPrivate(true)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all flex-1',
                    isPrivate
                      ? 'bg-amber/10 text-amber border-amber/20'
                      : 'bg-white/[0.02] text-muted-foreground border-border hover:border-white/10'
                  )}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Private
                </button>
                <button
                  onClick={() => setIsPrivate(false)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all flex-1',
                    !isPrivate
                      ? 'bg-amber/10 text-amber border-amber/20'
                      : 'bg-white/[0.02] text-muted-foreground border-border hover:border-white/10'
                  )}
                >
                  <Globe className="w-3.5 h-3.5" />
                  Public
                </button>
              </div>

              {/* Push artifacts toggle */}
              {artifactCount > 0 && (
                <label
                  className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
                >
                  <div>
                    <p className="text-xs font-medium flex items-center gap-1.5">
                      <Rocket className="w-3.5 h-3.5 text-amber" />
                      Push existing code
                    </p>
                    <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                      Push {artifactCount} file{artifactCount !== 1 ? 's' : ''} as the initial delivery
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={pushArtifacts}
                    onChange={(e) => setPushArtifacts(e.target.checked)}
                    className="w-4 h-4 accent-amber"
                  />
                </label>
              )}
            </motion.div>
          )}

          {/* ── Creating ── */}
          {step === 'creating' && (
            <motion.div
              key="creating"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-10 flex flex-col items-center gap-3"
            >
              <Loader2 className="w-8 h-8 text-amber animate-spin" />
              <p className="text-sm font-medium">Creating repository...</p>
              <p className="text-xs text-muted-foreground/50">
                {owner}/{repoName}
                {pushArtifacts ? ' + pushing initial code' : ''}
              </p>
            </motion.div>
          )}

          {/* ── Success ── */}
          {step === 'success' && result && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-8 flex flex-col items-center gap-3"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <p className="text-sm font-semibold">Repository Created!</p>
              <Badge variant="secondary" className="font-mono text-[11px] px-2 py-0.5">
                <Github className="w-3 h-3 mr-1" />
                {result.fullName}
              </Badge>
              {pushArtifacts && (
                <p className="text-[11px] text-muted-foreground/50">
                  Initial code push has been queued
                </p>
              )}
              <a
                href={result.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-amber hover:text-amber/80 transition-colors mt-2"
              >
                View on GitHub
                <ExternalLink className="w-3 h-3" />
              </a>
            </motion.div>
          )}

          {/* ── Error ── */}
          {step === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-8 flex flex-col items-center gap-3"
            >
              <XCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm font-semibold">Failed to Create Repository</p>
              <p className="text-xs text-red-400/80 text-center max-w-xs">
                {errorMessage}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter>
          {step === 'token' && (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handleValidateToken}
                disabled={!token.trim() || token.trim().length < 10 || validatingToken}
                className="flex-1 bg-amber hover:bg-amber/90 text-black"
              >
                {validatingToken ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    Connect
                  </>
                )}
              </Button>
            </div>
          )}

          {step === 'details' && (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => setStep('token')}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                onClick={handleCreate}
                disabled={!repoName.trim() || !owner}
                className="flex-1 bg-amber hover:bg-amber/90 text-black"
              >
                <Github className="w-4 h-4 mr-2" />
                Create Repository
              </Button>
            </div>
          )}

          {step === 'error' && (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => setStep('details')}
                className="flex-1"
              >
                Try Again
              </Button>
            </div>
          )}

          {(step === 'success' || step === 'creating') && (
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={step === 'creating'}
              className="w-full"
            >
              {step === 'creating' ? 'Please wait...' : 'Done'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
