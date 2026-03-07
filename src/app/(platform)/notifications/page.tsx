'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Bell,
  CheckCircle2,
  AlertTriangle,
  GitPullRequest,
  XCircle,
  Bot,
  Rocket,
  ShieldAlert,
  Hammer,
  Filter,
  CheckCheck,
} from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────

type NotificationType =
  | 'decision'
  | 'completion'
  | 'pr'
  | 'failure'
  | 'agent'
  | 'deploy'
  | 'security'
  | 'build';

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  description: string;
  timestamp: Date;
  read: boolean;
  actionLabel?: string;
  actionHref?: string;
  projectId?: string;
  projectName?: string;
}

// ── Config ─────────────────────────────────────────────────────────────

const typeConfig: Record<
  NotificationType,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  decision: { icon: AlertTriangle, color: 'text-amber-400', bg: 'bg-amber-400/10', label: 'Decisions' },
  completion: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Completions' },
  pr: { icon: GitPullRequest, color: 'text-blue-400', bg: 'bg-blue-400/10', label: 'Pull Requests' },
  failure: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Failures' },
  agent: { icon: Bot, color: 'text-violet-400', bg: 'bg-violet-400/10', label: 'Agents' },
  deploy: { icon: Rocket, color: 'text-cyan-400', bg: 'bg-cyan-400/10', label: 'Deploys' },
  security: { icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-400/10', label: 'Security' },
  build: { icon: Hammer, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Builds' },
};

const filterOptions: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'decision', label: 'Decisions' },
  { key: 'completion', label: 'Completions' },
  { key: 'failure', label: 'Failures' },
  { key: 'pr', label: 'PRs' },
  { key: 'deploy', label: 'Deploys' },
  { key: 'build', label: 'Builds' },
  { key: 'agent', label: 'Agents' },
  { key: 'security', label: 'Security' },
];

// ── Helpers ────────────────────────────────────────────────────────────

function mapDbNotification(n: any): Notification {
  return {
    id: n.id,
    type: (n.type?.toLowerCase() ?? 'agent') as NotificationType,
    title: n.title,
    description: n.description ?? '',
    timestamp: new Date(n.createdAt),
    read: n.read ?? false,
    actionLabel: n.actionLabel ?? undefined,
    actionHref: n.actionHref ?? undefined,
    projectId: n.projectId ?? undefined,
    projectName: n.project?.name ?? undefined,
  };
}

function isToday(date: Date) {
  const now = new Date();
  return date.getDate() === now.getDate() && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

function isYesterday(date: Date) {
  const y = new Date();
  y.setDate(y.getDate() - 1);
  return date.getDate() === y.getDate() && date.getMonth() === y.getMonth() && date.getFullYear() === y.getFullYear();
}

function formatRelative(date: Date) {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function groupByDay(notifications: Notification[]) {
  const today: Notification[] = [];
  const yesterday: Notification[] = [];
  const earlier: Notification[] = [];
  for (const n of notifications) {
    if (isToday(n.timestamp)) today.push(n);
    else if (isYesterday(n.timestamp)) yesterday.push(n);
    else earlier.push(n);
  }
  const groups: { label: string; items: Notification[] }[] = [];
  if (today.length > 0) groups.push({ label: 'Today', items: today });
  if (yesterday.length > 0) groups.push({ label: 'Yesterday', items: yesterday });
  if (earlier.length > 0) groups.push({ label: 'Earlier', items: earlier });
  return groups;
}

// ── Page Component ─────────────────────────────────────────────────────

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    fetch('/api/notifications?limit=200')
      .then((r) => r.json())
      .then((data) => {
        const mapped = (data.notifications ?? []).map(mapDbNotification);
        setNotifications(mapped);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return notifications;
    if (filter === 'unread') return notifications.filter((n) => !n.read);
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const groups = useMemo(() => groupByDay(filtered), [filtered]);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: [id] }),
    }).catch(() => {});
  };

  const handleMarkAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    }).catch(() => {});
  };

  const handleClick = (notification: Notification) => {
    handleMarkAsRead(notification.id);
    if (notification.actionHref) {
      router.push(notification.actionHref);
    }
  };

  return (
    <div className="min-h-[80vh] bg-background">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center">
              <Bell className="w-4.5 h-4.5 text-amber" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Notifications</h1>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
              </p>
            </div>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllRead}
              className="text-xs gap-1.5"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Mark all read
            </Button>
          )}
        </motion.div>

        {/* Filter tabs */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.05 }}
          className="flex gap-1 mb-6 overflow-x-auto scrollbar-thin pb-1"
        >
          {filterOptions.map((opt) => (
            <button
              key={opt.key}
              onClick={() => setFilter(opt.key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap',
                filter === opt.key
                  ? 'bg-amber/15 text-amber border border-amber/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/5'
              )}
            >
              {opt.label}
            </button>
          ))}
        </motion.div>

        {/* Notification list */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-4 rounded-xl animate-pulse">
                <div className="w-9 h-9 rounded-lg bg-foreground/[0.06]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-foreground/[0.06]" />
                  <div className="h-3 w-full rounded bg-foreground/[0.04]" />
                  <div className="h-2.5 w-1/4 rounded bg-foreground/[0.04]" />
                </div>
              </div>
            ))}
          </div>
        ) : groups.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center"
          >
            <div className="w-14 h-14 rounded-2xl bg-foreground/[0.03] border border-border flex items-center justify-center mb-4">
              <Bell className="w-6 h-6 text-muted-foreground/30" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">No notifications</p>
            <p className="text-xs text-muted-foreground/50 mt-1">
              {filter === 'all' ? "You're all caught up" : `No ${filter} notifications`}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                    {group.label}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.items.map((n, i) => {
                    const config = typeConfig[n.type] ?? typeConfig.agent;
                    const Icon = config.icon;
                    return (
                      <motion.button
                        key={n.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.02 }}
                        onClick={() => handleClick(n)}
                        className={cn(
                          'w-full text-left flex items-start gap-3 p-4 rounded-xl transition-all',
                          'hover:bg-foreground/[0.04] group',
                          !n.read && 'bg-foreground/[0.02] border border-foreground/[0.04]',
                          n.read && 'border border-transparent'
                        )}
                      >
                        <div className={cn('shrink-0 w-9 h-9 rounded-lg flex items-center justify-center mt-0.5', config.bg)}>
                          <Icon className={cn('w-4 h-4', config.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              'text-sm font-medium truncate',
                              n.read ? 'text-muted-foreground' : 'text-foreground'
                            )}>
                              {n.title}
                            </span>
                            {!n.read && (
                              <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {n.description}
                          </p>
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-[10px] text-muted-foreground/60">
                              {formatRelative(n.timestamp)}
                            </span>
                            {n.projectName && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5 border-border">
                                {n.projectName}
                              </Badge>
                            )}
                            {n.actionLabel && (
                              <span className="text-[10px] font-medium text-amber-400">
                                {n.actionLabel}
                              </span>
                            )}
                          </div>
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
