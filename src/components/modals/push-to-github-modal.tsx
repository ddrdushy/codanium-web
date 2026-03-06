'use client';

import { useState } from 'react';
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
  GitBranch,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PushToGitHubModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  artifactCount: number;
  repoOwner?: string;
  repoName?: string;
  defaultBranch?: string;
  hasGitConfig: boolean;
}

type PushStatus = 'idle' | 'pushing' | 'success' | 'error';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PushToGitHubModal({
  open,
  onOpenChange,
  projectId,
  artifactCount,
  repoOwner,
  repoName,
  defaultBranch = 'main',
  hasGitConfig,
}: PushToGitHubModalProps) {
  // Form state
  const [branchName, setBranchName] = useState('');
  const [commitMessage, setCommitMessage] = useState(
    'AI Team Studio: deliver project artifacts',
  );
  const [createPR, setCreatePR] = useState(true);

  // Push state
  const [status, setStatus] = useState<PushStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [resultData, setResultData] = useState<{
    branchName: string;
    jobId: string;
    artifactCount: number;
  } | null>(null);

  // Reset form when modal opens
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setBranchName(`ai-team-studio/delivery-${Date.now()}`);
      setCommitMessage('AI Team Studio: deliver project artifacts');
      setCreatePR(true);
      setStatus('idle');
      setErrorMessage('');
      setResultData(null);
    }
    onOpenChange(v);
  };

  const handlePush = async () => {
    setStatus('pushing');
    setErrorMessage('');

    try {
      const res = await fetch(`/api/projects/${projectId}/git/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          branchName,
          commitMessage,
          createPR,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setStatus('error');
        setErrorMessage(data.error ?? 'Push failed');
        return;
      }

      setStatus('success');
      setResultData(data);
    } catch {
      setStatus('error');
      setErrorMessage('Network error. Please try again.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="bg-[var(--surface)] border-border sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <Upload className="w-5 h-5 text-amber" />
            Push to GitHub
          </DialogTitle>
          <DialogDescription>
            {hasGitConfig
              ? `Push ${artifactCount} files to ${repoOwner}/${repoName}`
              : 'Connect your GitHub repository in Settings first'}
          </DialogDescription>
        </DialogHeader>

        <AnimatePresence mode="wait">
          {/* ── Idle / Form ── */}
          {status === 'idle' && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4 py-2"
            >
              {/* Not configured warning */}
              {!hasGitConfig && (
                <div className="rounded-lg border border-amber/20 bg-amber/5 p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber mt-0.5 shrink-0" />
                  <p className="text-xs text-amber/80">
                    Git is not configured. Go to Settings → Git to connect your GitHub repository.
                  </p>
                </div>
              )}

              {/* Branch name */}
              <div className="space-y-1.5">
                <Label htmlFor="branch" className="text-xs font-medium">
                  Branch Name
                </Label>
                <div className="flex items-center gap-2">
                  <GitBranch className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  <Input
                    id="branch"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="ai-team-studio/delivery-..."
                    className="font-mono text-xs"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground/40">
                  New branch from <Badge variant="secondary" className="text-[10px] px-1 py-0">{defaultBranch}</Badge>
                </p>
              </div>

              {/* Commit message */}
              <div className="space-y-1.5">
                <Label htmlFor="commit-msg" className="text-xs font-medium">
                  Commit Message
                </Label>
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                  <Input
                    id="commit-msg"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="Describe what's being delivered..."
                    className="text-xs"
                  />
                </div>
              </div>

              {/* Create PR toggle */}
              <label
                className="flex items-center justify-between rounded-lg border border-border p-3 cursor-pointer hover:bg-white/[0.02] transition-colors"
              >
                <div>
                  <p className="text-xs font-medium">Create Pull Request</p>
                  <p className="text-[10px] text-muted-foreground/50">
                    Opens a PR from your branch into {defaultBranch}
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={createPR}
                  onChange={(e) => setCreatePR(e.target.checked)}
                  className="w-4 h-4 accent-amber"
                />
              </label>

              {/* File summary */}
              <div className="rounded-lg bg-white/[0.02] border border-border p-3">
                <div className="flex items-center gap-2 text-[11px]">
                  <FileText className="w-3.5 h-3.5 text-muted-foreground/40" />
                  <span className="text-muted-foreground/60">
                    {artifactCount} file{artifactCount !== 1 ? 's' : ''} will be committed
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── Pushing ── */}
          {status === 'pushing' && (
            <motion.div
              key="pushing"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="py-10 flex flex-col items-center gap-3"
            >
              <Loader2 className="w-8 h-8 text-amber animate-spin" />
              <p className="text-sm font-medium">Pushing to GitHub...</p>
              <p className="text-xs text-muted-foreground/50">
                Creating branch, committing {artifactCount} files
                {createPR ? ', and opening PR' : ''}
              </p>
            </motion.div>
          )}

          {/* ── Success ── */}
          {status === 'success' && resultData && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-8 flex flex-col items-center gap-3"
            >
              <CheckCircle2 className="w-10 h-10 text-emerald-400" />
              <p className="text-sm font-semibold">Push Complete!</p>
              <div className="text-center space-y-1">
                <p className="text-xs text-muted-foreground/60">
                  {resultData.artifactCount} files pushed to branch
                </p>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  <GitBranch className="w-3 h-3 mr-1" />
                  {resultData.branchName}
                </Badge>
              </div>
              {repoOwner && repoName && (
                <a
                  href={`https://github.com/${repoOwner}/${repoName}/tree/${resultData.branchName}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-amber hover:text-amber/80 transition-colors mt-2"
                >
                  View on GitHub
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </motion.div>
          )}

          {/* ── Error ── */}
          {status === 'error' && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="py-8 flex flex-col items-center gap-3"
            >
              <XCircle className="w-10 h-10 text-red-400" />
              <p className="text-sm font-semibold">Push Failed</p>
              <p className="text-xs text-red-400/80 text-center max-w-xs">
                {errorMessage}
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        <DialogFooter>
          {status === 'idle' && (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePush}
                disabled={!hasGitConfig || !branchName.trim() || !commitMessage.trim()}
                className={cn(
                  'flex-1',
                  'bg-amber hover:bg-amber/90 text-black',
                )}
              >
                <Upload className="w-4 h-4 mr-2" />
                Push to GitHub
              </Button>
            </div>
          )}

          {status === 'error' && (
            <div className="flex gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => handleOpenChange(false)}
                className="flex-1"
              >
                Close
              </Button>
              <Button
                onClick={() => setStatus('idle')}
                className="flex-1"
              >
                Try Again
              </Button>
            </div>
          )}

          {(status === 'success' || status === 'pushing') && (
            <Button
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={status === 'pushing'}
              className="w-full"
            >
              {status === 'pushing' ? 'Please wait...' : 'Done'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
