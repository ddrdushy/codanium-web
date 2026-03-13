'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  GitBranch, GitPullRequest, GitCommit, GitMerge,
  CheckCircle2, Clock, XCircle, AlertTriangle,
  Tag, ArrowRight, ExternalLink, Eye,
  ChevronRight, Activity, Rocket, Upload
} from 'lucide-react';
import { PushToGitHubModal } from '@/components/modals/push-to-github-modal';

interface Branch {
  name: string;
  status: 'active' | 'merged' | 'stale';
  lastCommit: string;
  author: string;
  behind: number;
  ahead: number;
}

interface PullRequest {
  id: number;
  title: string;
  branch: string;
  status: 'open' | 'merged' | 'closed';
  author: string;
  avatar: string;
  reviewers: string[];
  checks: 'passing' | 'failing' | 'pending';
  additions: number;
  deletions: number;
  comments: number;
  created: string;
}

interface Release {
  version: string;
  date: string;
  status: 'released' | 'draft' | 'pre-release';
  changes: number;
  features: string[];
}

const mockBranches: Branch[] = [
  { name: 'main', status: 'active', lastCommit: '2h ago', author: 'DevOps', behind: 0, ahead: 0 },
  { name: 'feature/decision-api', status: 'active', lastCommit: '15min ago', author: 'Junior Dev', behind: 2, ahead: 8 },
  { name: 'feature/state-machine', status: 'active', lastCommit: '1h ago', author: 'Senior Dev', behind: 1, ahead: 12 },
  { name: 'feature/llm-gateway', status: 'active', lastCommit: '3h ago', author: 'Sol. Architect', behind: 4, ahead: 6 },
  { name: 'fix/event-ordering', status: 'active', lastCommit: '4h ago', author: 'QA Engineer', behind: 3, ahead: 3 },
  { name: 'feature/auth-setup', status: 'stale', lastCommit: '3d ago', author: 'Junior Dev', behind: 15, ahead: 2 },
];

const mockPRs: PullRequest[] = [
  {
    id: 43, title: 'feat: implement decision approval workflow', branch: 'feature/decision-api',
    status: 'open', author: 'Junior Developer', avatar: '💻', reviewers: ['SD', 'TL'],
    checks: 'passing', additions: 342, deletions: 28, comments: 5, created: '2h ago'
  },
  {
    id: 42, title: 'feat: card state machine with transition validation', branch: 'feature/state-machine',
    status: 'open', author: 'Senior Developer', avatar: '🔍', reviewers: ['TL'],
    checks: 'pending', additions: 890, deletions: 156, comments: 12, created: '6h ago'
  },
  {
    id: 41, title: 'fix: event bus message ordering (FIFO)', branch: 'fix/event-ordering',
    status: 'open', author: 'QA Engineer', avatar: '🧪', reviewers: ['SD'],
    checks: 'passing', additions: 67, deletions: 23, comments: 2, created: '1d ago'
  },
  {
    id: 40, title: 'feat: board CRUD with atomic file writes', branch: 'feature/board-crud',
    status: 'merged', author: 'Junior Developer', avatar: '💻', reviewers: ['SD', 'TL'],
    checks: 'passing', additions: 456, deletions: 12, comments: 8, created: '3d ago'
  },
  {
    id: 39, title: 'feat: event logging system (events.jsonl)', branch: 'feature/event-log',
    status: 'merged', author: 'Junior Developer', avatar: '💻', reviewers: ['TL'],
    checks: 'passing', additions: 234, deletions: 5, comments: 3, created: '5d ago'
  },
];

const mockReleases: Release[] = [
  { version: 'v0.3.0', date: 'Today', status: 'draft', changes: 24, features: ['Decision engine', 'State machine', 'LLM gateway'] },
  { version: 'v0.2.0', date: 'Feb 28', status: 'released', changes: 18, features: ['Board CRUD', 'Event logging', 'Project scaffold'] },
  { version: 'v0.1.0', date: 'Feb 15', status: 'released', changes: 12, features: ['Initial scaffold', 'CLI setup', 'Basic routing'] },
];

type ViewTab = 'branches' | 'prs' | 'releases';

const dbBranchStatus: Record<string, Branch['status']> = { ACTIVE: 'active', MERGED: 'merged', STALE: 'stale' };
const dbPRStatus: Record<string, PullRequest['status']> = { OPEN: 'open', MERGED: 'merged', CLOSED: 'closed' };
const dbCheckStatus: Record<string, PullRequest['checks']> = { PASSING: 'passing', FAILING: 'failing', PENDING: 'pending' };
const dbReleaseStatus: Record<string, Release['status']> = { RELEASED: 'released', DRAFT: 'draft', PRE_RELEASE: 'pre-release' };

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function GitPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [activeTab, setActiveTab] = useState<ViewTab>('prs');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [pullRequests, setPullRequests] = useState<PullRequest[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [pushModalOpen, setPushModalOpen] = useState(false);
  const [gitConfig, setGitConfig] = useState<{
    hasToken: boolean;
    repoOwner?: string;
    repoName?: string;
    defaultBranch?: string;
  }>({ hasToken: false });
  const [artifactCount, setArtifactCount] = useState(0);

  useEffect(() => {
    Promise.all([
      fetch(`/api/projects/${projectId}/git/branches`).then(r => r.json()),
      fetch(`/api/projects/${projectId}/git/pull-requests`).then(r => r.json()),
      fetch(`/api/projects/${projectId}/git/releases`).then(r => r.json()),
    ])
      .then(([branchData, prData, releaseData]) => {
        if (Array.isArray(branchData) && branchData.length > 0) {
          setBranches(branchData.map((b: any) => ({
            name: b.name, status: dbBranchStatus[b.status] ?? 'active',
            lastCommit: b.lastCommit ?? '', author: b.author ?? '',
            behind: b.behind ?? 0, ahead: b.ahead ?? 0,
          })));
        }
        if (Array.isArray(prData) && prData.length > 0) {
          setPullRequests(prData.map((pr: any) => ({
            id: pr.number, title: pr.title, branch: pr.branch,
            status: dbPRStatus[pr.status] ?? 'open', author: pr.author ?? '',
            avatar: pr.avatar ?? '', reviewers: pr.reviewers ?? [],
            checks: dbCheckStatus[pr.checks] ?? 'pending',
            additions: pr.additions ?? 0, deletions: pr.deletions ?? 0,
            comments: pr.comments ?? 0, created: formatRelative(pr.createdAt),
          })));
        }
        if (Array.isArray(releaseData) && releaseData.length > 0) {
          setReleases(releaseData.map((r: any) => ({
            version: r.version, date: r.date ?? '',
            status: dbReleaseStatus[r.status] ?? 'released',
            changes: r.changes ?? 0, features: r.features ?? [],
          })));
        }
      })
      .catch(() => {
        setBranches(mockBranches);
        setPullRequests(mockPRs);
        setReleases(mockReleases);
      });

    // Fetch git config and artifact count for push modal
    fetch(`/api/projects/${projectId}/git/config`)
      .then(r => r.json())
      .then(data => {
        if (data && !data.error) {
          setGitConfig({
            hasToken: data.hasToken ?? false,
            repoOwner: data.repoOwner,
            repoName: data.repoName,
            defaultBranch: data.defaultBranch,
          });
        }
      })
      .catch(() => {});

    fetch(`/api/projects/${projectId}/artifacts`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setArtifactCount(data.length);
      })
      .catch(() => {});
  }, [projectId]);

  const openPRs = pullRequests.filter(pr => pr.status === 'open').length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-amber" />
            Code & Releases
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Your project's codebase, updates, and version history</p>
        </div>
        <div className="flex items-center gap-2">
          {openPRs > 0 && (
            <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/20 text-[10px]">
              {openPRs} open PRs
            </Badge>
          )}
          <Button
            size="sm"
            onClick={() => setPushModalOpen(true)}
            className="bg-amber hover:bg-amber/90 text-black text-xs"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            Push to GitHub
          </Button>
        </div>
      </motion.div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Active Branches', value: branches.filter(b => b.status === 'active').length.toString(), icon: GitBranch, color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20' },
          { label: 'Open PRs', value: openPRs.toString(), icon: GitPullRequest, color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
          { label: 'Releases', value: releases.length.toString(), icon: Tag, color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
          { label: 'Latest', value: releases[0]?.version ?? '-', icon: Rocket, color: 'text-amber', bg: 'bg-amber/10 border-amber/20' },
        ].map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className={cn('rounded-xl border p-3', stat.bg)}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] text-muted-foreground/60 font-medium">{stat.label}</p>
                  <p className={cn('text-xl font-bold mt-0.5', stat.color)}>{stat.value}</p>
                </div>
                <Icon className={cn('w-5 h-5 opacity-30', stat.color)} />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white/[0.02] rounded-xl p-1 border border-border">
        {[
          { key: 'prs' as ViewTab, label: 'Pull Requests', icon: GitPullRequest, count: openPRs },
          { key: 'branches' as ViewTab, label: 'Branches', icon: GitBranch, count: branches.length },
          { key: 'releases' as ViewTab, label: 'Releases', icon: Tag, count: releases.length },
        ].map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all',
                activeTab === tab.key
                  ? 'bg-amber/10 text-amber border border-amber/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.03]'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              <Badge variant="outline" className="text-[9px] h-4 px-1 bg-white/[0.04]">
                {tab.count}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Pull Requests Tab */}
      {activeTab === 'prs' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          {pullRequests.length === 0 && (
            <div className="rounded-xl border border-border bg-[var(--surface)] p-8 text-center">
              <GitPullRequest className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/50">No pull requests yet</p>
            </div>
          )}
          {pullRequests.map((pr, i) => (
            <motion.div
              key={pr.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-[var(--surface)] p-4 hover:border-white/10 transition-all cursor-pointer"
            >
              <div className="flex items-start gap-3">
                {/* PR Icon */}
                <div className={cn(
                  'mt-0.5',
                  pr.status === 'open' && 'text-emerald-400',
                  pr.status === 'merged' && 'text-violet-400',
                  pr.status === 'closed' && 'text-red-400',
                )}>
                  {pr.status === 'merged' ? (
                    <GitMerge className="w-5 h-5" />
                  ) : (
                    <GitPullRequest className="w-5 h-5" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">{pr.title}</h3>
                    <Badge variant="outline" className={cn(
                      'text-[9px] h-4 px-1.5',
                      pr.status === 'open' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      pr.status === 'merged' && 'bg-violet-500/10 text-violet-400 border-violet-500/20',
                    )}>
                      {pr.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground/50">
                    <span className="flex items-center gap-1">
                      <span>{pr.avatar}</span> {pr.author}
                    </span>
                    <span>#{pr.id}</span>
                    <span className="font-mono text-[10px]">{pr.branch}</span>
                    <span>{pr.created}</span>
                  </div>

                  <div className="flex items-center gap-3 mt-2">
                    {/* Checks */}
                    <Badge variant="outline" className={cn(
                      'text-[9px] h-4',
                      pr.checks === 'passing' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      pr.checks === 'failing' && 'bg-red-500/10 text-red-400 border-red-500/20',
                      pr.checks === 'pending' && 'bg-amber/10 text-amber border-amber/20',
                    )}>
                      {pr.checks === 'passing' && <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" />}
                      {pr.checks === 'failing' && <XCircle className="w-2.5 h-2.5 mr-0.5" />}
                      {pr.checks === 'pending' && <Clock className="w-2.5 h-2.5 mr-0.5" />}
                      {pr.checks}
                    </Badge>

                    {/* Diff stats */}
                    <span className="text-[10px]">
                      <span className="text-emerald-400">+{pr.additions}</span>
                      {' '}
                      <span className="text-red-400">-{pr.deletions}</span>
                    </span>

                    {/* Reviewers */}
                    <div className="flex items-center gap-1">
                      <Eye className="w-3 h-3 text-muted-foreground/30" />
                      {pr.reviewers.map(r => (
                        <Badge key={r} variant="outline" className="text-[8px] h-3.5 px-1 bg-white/[0.03]">
                          {r}
                        </Badge>
                      ))}
                    </div>

                    {/* Comments */}
                    {pr.comments > 0 && (
                      <span className="text-[10px] text-muted-foreground/40 flex items-center gap-0.5">
                        💬 {pr.comments}
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-4 h-4 text-muted-foreground/20 mt-1" />
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Branches Tab */}
      {activeTab === 'branches' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-2"
        >
          {branches.length === 0 && (
            <div className="rounded-xl border border-border bg-[var(--surface)] p-8 text-center">
              <GitBranch className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/50">No branches yet</p>
            </div>
          )}
          {branches.map((branch, i) => (
            <motion.div
              key={branch.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="rounded-xl border border-border bg-[var(--surface)] p-4 hover:border-white/10 transition-all"
            >
              <div className="flex items-center gap-3">
                <GitBranch className={cn(
                  'w-4 h-4',
                  branch.name === 'main' ? 'text-amber' : 'text-blue-400',
                  branch.status === 'stale' && 'text-zinc-500'
                )} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-mono font-semibold">{branch.name}</span>
                    {branch.name === 'main' && (
                      <Badge className="bg-amber/15 text-amber border-amber/20 text-[9px]">default</Badge>
                    )}
                    {branch.status === 'stale' && (
                      <Badge variant="outline" className="text-[9px] bg-zinc-500/10 text-zinc-400 border-zinc-500/20">
                        stale
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground/50">
                    <span>{branch.author}</span>
                    <span>{branch.lastCommit}</span>
                    {branch.name !== 'main' && (
                      <span className="flex items-center gap-1">
                        <span className={branch.behind > 5 ? 'text-red-400' : ''}>{branch.behind} behind</span>
                        <span>·</span>
                        <span className="text-emerald-400">{branch.ahead} ahead</span>
                      </span>
                    )}
                  </div>
                </div>
                {branch.name !== 'main' && branch.status !== 'stale' && (
                  <Button size="sm" variant="outline" className="h-7 text-[11px]">
                    Create PR
                  </Button>
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Releases Tab */}
      {activeTab === 'releases' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          {releases.length === 0 && (
            <div className="rounded-xl border border-border bg-[var(--surface)] p-8 text-center">
              <Tag className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground/50">No releases yet</p>
            </div>
          )}
          {releases.map((release, i) => (
            <motion.div
              key={release.version}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-xl border border-border bg-[var(--surface)] p-5"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Tag className={cn(
                      'w-4 h-4',
                      release.status === 'released' ? 'text-emerald-400' : 'text-amber'
                    )} />
                    <h3 className="text-lg font-bold">{release.version}</h3>
                    <Badge variant="outline" className={cn(
                      'text-[10px]',
                      release.status === 'released' && 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                      release.status === 'draft' && 'bg-amber/10 text-amber border-amber/20',
                      release.status === 'pre-release' && 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                    )}>
                      {release.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    {release.date} · {release.changes} changes
                  </p>
                </div>
                {release.status === 'draft' && (
                  <Button size="sm" className="h-7 text-[11px] bg-amber/20 text-amber hover:bg-amber/30 border border-amber/20">
                    <Rocket className="w-3 h-3 mr-1" /> Publish
                  </Button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {release.features.map(feat => (
                  <Badge key={feat} variant="outline" className="text-[10px] bg-white/[0.03]">
                    {feat}
                  </Badge>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
      {/* Push to GitHub Modal */}
      <PushToGitHubModal
        open={pushModalOpen}
        onOpenChange={setPushModalOpen}
        projectId={projectId}
        artifactCount={artifactCount}
        repoOwner={gitConfig.repoOwner}
        repoName={gitConfig.repoName}
        defaultBranch={gitConfig.defaultBranch}
        hasGitConfig={gitConfig.hasToken}
      />
    </div>
  );
}
