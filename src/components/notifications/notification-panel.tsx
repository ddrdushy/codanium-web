'use client';

import { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bell,
  CheckCircle2,
  AlertTriangle,
  GitPullRequest,
  XCircle,
  Bot,
  Rocket,
  ShieldAlert,
  Hammer,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  useNotificationStore,
  selectUnreadCount,
  type Notification,
  type NotificationType,
} from '@/lib/notification-store';

// ── Icon + color config per notification type ─────────────────────────
const typeConfig: Record<
  NotificationType,
  { icon: React.ElementType; color: string; bg: string }
> = {
  decision: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
  },
  completion: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
  pr: {
    icon: GitPullRequest,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
  },
  failure: {
    icon: XCircle,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
  },
  agent: {
    icon: Bot,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
  },
  deploy: {
    icon: Rocket,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
  },
  security: {
    icon: ShieldAlert,
    color: 'text-red-400',
    bg: 'bg-red-400/10',
  },
  build: {
    icon: Hammer,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
  },
};

// ── Time helpers ──────────────────────────────────────────────────────
function isToday(date: Date) {
  const now = new Date();
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

function isYesterday(date: Date) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatRelative(date: Date) {
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return formatTime(date);
}

// ── Group notifications by day ────────────────────────────────────────
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

// ── Single notification row ───────────────────────────────────────────
function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  const config = typeConfig[notification.type] ?? typeConfig.agent;
  const Icon = config.icon;

  return (
    <button
      onClick={() => onRead(notification.id)}
      className={cn(
        'w-full text-left flex items-start gap-3 px-4 py-3 rounded-lg transition-all',
        'hover:bg-foreground/[0.04] group',
        !notification.read && 'bg-foreground/[0.02]'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5',
          config.bg
        )}
      >
        <Icon className={cn('w-4 h-4', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-sm font-medium truncate',
              notification.read ? 'text-muted-foreground' : 'text-foreground'
            )}
          >
            {notification.title}
          </span>
          {!notification.read && (
            <span className="shrink-0 w-1.5 h-1.5 rounded-full bg-amber-400" />
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
          {notification.description}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] text-muted-foreground/60">
            {formatRelative(notification.timestamp)}
          </span>
          {notification.projectName && (
            <span className="text-[10px] text-muted-foreground/40">
              · {notification.projectName}
            </span>
          )}
          {notification.actionLabel && (
            <span className="text-[10px] font-medium text-amber-400 hover:text-amber-300 transition-colors">
              {notification.actionLabel}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────
function NotificationSkeleton() {
  return (
    <div className="px-4 py-3 flex items-start gap-3 animate-pulse">
      <div className="w-8 h-8 rounded-lg bg-foreground/[0.06]" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-3/4 rounded bg-foreground/[0.06]" />
        <div className="h-3 w-full rounded bg-foreground/[0.04]" />
        <div className="h-2.5 w-1/4 rounded bg-foreground/[0.04]" />
      </div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────
export function NotificationPanel() {
  const { isOpen, close, notifications, markAsRead, markAllRead, loading } =
    useNotificationStore();
  const unreadCount = useNotificationStore(selectUnreadCount);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Grouped data
  const groups = useMemo(() => groupByDay(notifications), [notifications]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm"
            onClick={close}
          />

          {/* Slide-out panel */}
          <motion.div
            ref={panelRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={cn(
              'fixed top-0 right-0 bottom-0 z-[10000] w-full max-w-md',
              'bg-[var(--surface)]/95 backdrop-blur-xl',
              'border-l border-border',
              'shadow-2xl shadow-black/40',
              'flex flex-col'
            )}
          >
            {/* ── Header ─────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-foreground" />
                <h2 className="text-sm font-semibold text-foreground">
                  Notifications
                </h2>
                {unreadCount > 0 && (
                  <Badge className="bg-amber-400/15 text-amber-400 border-amber-400/20 text-[10px] px-1.5 py-0">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={markAllRead}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Mark all read
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={close}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* ── Notification list ──────────────────────────────── */}
            <div className="flex-1 overflow-y-auto scrollbar-thin py-2">
              {loading ? (
                <div className="space-y-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <NotificationSkeleton key={i} />
                  ))}
                </div>
              ) : groups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center px-6">
                  <Bell className="w-8 h-8 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No notifications yet
                  </p>
                  <p className="text-xs text-muted-foreground/50 mt-1">
                    You&apos;re all caught up
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group.label}>
                    {/* Group label */}
                    <div className="px-5 pt-3 pb-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50">
                        {group.label}
                      </span>
                    </div>
                    {/* Items */}
                    <div className="px-1">
                      {group.items.map((n) => (
                        <NotificationItem
                          key={n.id}
                          notification={n}
                          onRead={markAsRead}
                        />
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* ── Footer ─────────────────────────────────────────── */}
            <div className="px-5 py-3 border-t border-border shrink-0">
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors group/link">
                <span>View all notifications</span>
                <ChevronRight className="w-3 h-3 transition-transform group-hover/link:translate-x-0.5" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
