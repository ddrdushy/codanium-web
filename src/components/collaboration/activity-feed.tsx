'use client';

import { useProjectActivity, type ActivityEvent } from '@/lib/hooks/use-project-activity';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  GitPullRequest,
  Rocket,
  Hammer,
  ListTodo,
  Users,
  Zap,
  Wifi,
  WifiOff,
} from 'lucide-react';

interface ActivityFeedProps {
  projectId: string | null;
  maxItems?: number;
  className?: string;
}

const categoryConfig: Record<
  string,
  { icon: React.ElementType; color: string; bg: string; label: string }
> = {
  agent_status: {
    icon: Bot,
    color: 'text-violet-400',
    bg: 'bg-violet-400/10',
    label: 'Agent',
  },
  task_update: {
    icon: ListTodo,
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    label: 'Task',
  },
  deployment_update: {
    icon: Rocket,
    color: 'text-cyan-400',
    bg: 'bg-cyan-400/10',
    label: 'Deploy',
  },
  code_update: {
    icon: GitPullRequest,
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    label: 'Code',
  },
  build_update: {
    icon: Hammer,
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    label: 'Build',
  },
  member_activity: {
    icon: Users,
    color: 'text-foreground/60',
    bg: 'bg-foreground/[0.06]',
    label: 'Activity',
  },
};

function formatActivityTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function getEventDescription(event: ActivityEvent): string {
  const payload = event.payload;

  // Try to extract a meaningful summary from payload
  if (payload.summary && typeof payload.summary === 'string') return payload.summary;
  if (payload.message && typeof payload.message === 'string') return payload.message;
  if (payload.description && typeof payload.description === 'string') return payload.description;

  // Fall back to event type formatted nicely
  return event.type.replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Compact scrollable feed showing real-time project events.
 */
export function ActivityFeed({ projectId, maxItems = 20, className }: ActivityFeedProps) {
  const { events, connected } = useProjectActivity(projectId);
  const displayEvents = events.slice(0, maxItems);

  if (!projectId) return null;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
          <span className="text-xs font-semibold text-foreground">Live Activity</span>
        </div>
        <div className="flex items-center gap-1.5">
          {connected ? (
            <Wifi className="w-3 h-3 text-emerald-400" />
          ) : (
            <WifiOff className="w-3 h-3 text-red-400" />
          )}
          <span className={cn('text-[10px]', connected ? 'text-emerald-400' : 'text-red-400')}>
            {connected ? 'Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Events list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin max-h-80">
        {displayEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Zap className="w-6 h-6 text-muted-foreground/20 mb-2" />
            <p className="text-xs text-muted-foreground/50">No activity yet</p>
            <p className="text-[10px] text-muted-foreground/30 mt-0.5">
              Events will appear here in real-time
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {displayEvents.map((event) => {
              const config = categoryConfig[event.category] ?? categoryConfig.member_activity;
              const Icon = config.icon;

              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, y: -8, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="flex items-start gap-2.5 px-3 py-2 hover:bg-foreground/[0.02] transition-colors"
                >
                  <div className={cn('shrink-0 w-6 h-6 rounded-md flex items-center justify-center mt-0.5', config.bg)}>
                    <Icon className={cn('w-3 h-3', config.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-medium text-foreground/80 truncate">
                        {event.actor}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40">·</span>
                      <span className={cn('text-[10px] font-medium', config.color)}>
                        {config.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                      {getEventDescription(event)}
                    </p>
                    <span className="text-[10px] text-muted-foreground/40 mt-0.5">
                      {formatActivityTime(event.timestamp)}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
