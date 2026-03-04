'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  User,
  FolderOpen,
  CreditCard,
  Settings,
  Bot,
  Key,
  Shield,
} from 'lucide-react';
import { fetchAuditLog } from '@/lib/api';
import { mockAuditLog } from '@/lib/mock-admin-data';
import type { AuditLogEntry } from '@/types';

// ─── Animation variants ───
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

const entryVariants = {
  hidden: { opacity: 0, x: -10 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
};

// ─── Filter tabs ───
const filterTabs = [
  { label: 'All', prefix: '' },
  { label: 'Auth', prefix: 'user.' },
  { label: 'Projects', prefix: 'project.' },
  { label: 'Billing', prefix: 'billing.' },
  { label: 'Settings', prefix: 'settings.' },
  { label: 'Security', prefix: 'api_key.' },
];

// ─── Action type configuration ───
function getActionConfig(action: string): { color: string; icon: React.ReactNode } {
  if (action.startsWith('user.')) {
    return { color: '#3b82f6', icon: <User className="w-4 h-4" /> };
  }
  if (action.startsWith('project.')) {
    return { color: '#10b981', icon: <FolderOpen className="w-4 h-4" /> };
  }
  if (action.startsWith('billing.')) {
    return { color: '#f59e0b', icon: <CreditCard className="w-4 h-4" /> };
  }
  if (action.startsWith('settings.')) {
    return { color: '#8b5cf6', icon: <Settings className="w-4 h-4" /> };
  }
  if (action.startsWith('agent.')) {
    return { color: '#06b6d4', icon: <Bot className="w-4 h-4" /> };
  }
  if (action.startsWith('api_key.')) {
    return { color: '#ef4444', icon: <Key className="w-4 h-4" /> };
  }
  return { color: '#64748b', icon: <Shield className="w-4 h-4" /> };
}

// ─── Format action label ───
function formatAction(action: string): string {
  return action
    .split('.')
    .map((part) =>
      part
        .split('_')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    )
    .join(' > ');
}

// ─── Relative time formatter ───
function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>(mockAuditLog);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('');

  useEffect(() => {
    fetchAuditLog()
      .then((data) => setLogs(data.logs))
      .catch(() => {/* keep mock data */})
      .finally(() => setLoading(false));
  }, []);

  const filteredEntries = useMemo(() => {
    return logs.filter((entry: AuditLogEntry) => {
      // Filter by action prefix
      if (activeFilter && !entry.action.startsWith(activeFilter)) {
        return false;
      }
      // Filter by search
      if (search) {
        const query = search.toLowerCase();
        return (
          entry.actor.toLowerCase().includes(query) ||
          entry.action.toLowerCase().includes(query) ||
          entry.actor_email.toLowerCase().includes(query) ||
          entry.target.toLowerCase().includes(query) ||
          entry.details.toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [logs, search, activeFilter]);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
          <p className="text-sm text-muted-foreground mt-1">
            System activity and security events
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by actor or action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-ring transition-all"
          />
        </div>
      </motion.div>

      {/* Filter Tabs */}
      <motion.div variants={itemVariants} className="flex flex-wrap gap-2">
        {filterTabs.map((tab) => {
          const isActive = activeFilter === tab.prefix;
          return (
            <button
              key={tab.label}
              onClick={() => setActiveFilter(tab.prefix)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-[var(--admin-accent)]/15 text-[var(--admin-accent)] border border-[var(--admin-accent)]/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </motion.div>

      {/* Audit Log Entries */}
      <motion.div variants={itemVariants} className="space-y-3">
        {filteredEntries.length === 0 ? (
          <div className="glass-card rounded-xl border border-border/50 p-8 text-center">
            <p className="text-sm text-muted-foreground">
              No audit log entries match your filters.
            </p>
          </div>
        ) : (
          filteredEntries.map((entry, index) => {
            const config = getActionConfig(entry.action);
            return (
              <motion.div
                key={entry.id}
                variants={entryVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: index * 0.03 }}
                className="glass-card rounded-xl border border-border/50 p-4 transition-all duration-150 hover:border-border"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className="flex items-center justify-center w-9 h-9 rounded-full shrink-0 mt-0.5"
                    style={{ backgroundColor: config.color + '15' }}
                  >
                    <div style={{ color: config.color }}>{config.icon}</div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        {/* Actor */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">
                            {entry.actor}
                          </span>
                          <span className="text-xs text-muted-foreground/70">
                            {entry.actor_email}
                          </span>
                        </div>

                        {/* Action badge + details */}
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium"
                            style={{
                              backgroundColor: config.color + '15',
                              color: config.color,
                            }}
                          >
                            {formatAction(entry.action)}
                          </span>
                          {entry.target && (
                            <span className="text-xs text-muted-foreground">
                              on <span className="font-medium text-foreground/80">{entry.target}</span>
                            </span>
                          )}
                        </div>

                        {/* Details */}
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {entry.details}
                        </p>
                      </div>

                      {/* Timestamp + IP */}
                      <div className="text-right shrink-0 hidden sm:block">
                        <p className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTimestamp(entry.timestamp)}
                        </p>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5 font-mono">
                          {entry.ip_address}
                        </p>
                      </div>
                    </div>

                    {/* Mobile timestamp + IP */}
                    <div className="flex items-center gap-3 mt-2 sm:hidden">
                      <p className="text-xs text-muted-foreground">
                        {formatTimestamp(entry.timestamp)}
                      </p>
                      <p className="text-[11px] text-muted-foreground/60 font-mono">
                        {entry.ip_address}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>
    </motion.div>
  );
}
