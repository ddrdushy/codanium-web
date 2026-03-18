'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Database,
  ListTodo,
  Activity,
  Server,
  AlertTriangle,
  RefreshCw,
  Play,
} from 'lucide-react';
import { fetchSystemHealth } from '@/lib/api';
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

// ─── Types ───
interface HealthData {
  database: {
    status: string;
    tables: Record<string, number>;
  };
  taskQueue: {
    pending: number;
    running: number;
    completed: number;
    failed: number;
  };
  platform: {
    totalLlmCalls: number;
    totalLlmCost: number;
    uptime: number;
  };
  recentErrors: Array<{
    id: string;
    userMessage: string;
    errorMessage: string | null;
    createdAt: string;
  }>;
}

// ─── Default health data ───
const defaultHealthData: HealthData = {
  database: {
    status: 'healthy',
    tables: { users: 18, projects: 10, agents: 46, orchestrationRuns: 24, events: 150, deploymentPipelines: 5, deploymentRuns: 12 },
  },
  taskQueue: { pending: 2, running: 1, completed: 89, failed: 3 },
  platform: { totalLlmCalls: 1247, totalLlmCost: 2847.63, uptime: 432000 },
  recentErrors: [
    { id: 'err_1', userMessage: 'Generate API docs for payment module', errorMessage: 'Context window exceeded: 210K tokens', createdAt: '2026-03-04T07:30:00Z' },
    { id: 'err_2', userMessage: 'Deploy staging environment', errorMessage: 'Docker build failed: missing env variable DB_HOST', createdAt: '2026-03-03T22:15:00Z' },
    { id: 'err_3', userMessage: 'Run full test suite', errorMessage: 'Timeout after 300s: test runner unresponsive', createdAt: '2026-03-03T18:00:00Z' },
  ],
};

// ─── Format uptime ───
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

// ─── Format relative time ───
function formatRelativeTime(iso: string): string {
  const now = new Date();
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Status dot component ───
function StatusDot({ status }: { status: 'healthy' | 'warning' | 'error' }) {
  const colors = {
    healthy: 'bg-emerald-500',
    warning: 'bg-amber-500',
    error: 'bg-red-500',
  };
  return (
    <span className="relative flex h-2.5 w-2.5">
      <span
        className={`absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping ${colors[status]}`}
      />
      <span
        className={`relative inline-flex rounded-full h-2.5 w-2.5 ${colors[status]}`}
      />
    </span>
  );
}

// ─── Status card component ───
function StatusCard({
  icon,
  title,
  status,
  metric,
  metricLabel,
}: {
  icon: React.ReactNode;
  title: string;
  status: 'healthy' | 'warning' | 'error';
  metric: string;
  metricLabel: string;
}) {
  const statusLabels = { healthy: 'Healthy', warning: 'Warning', error: 'Error' };
  return (
    <div className="glass-card rounded-xl border border-border/50 p-5 transition-all duration-200">
      <div className="flex items-center justify-between mb-4">
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full"
          style={{ backgroundColor: '#0d948815' }}
        >
          <div style={{ color: '#0d9488' }}>{icon}</div>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status={status} />
          <span
            className={`text-xs font-medium ${
              status === 'healthy'
                ? 'text-emerald-500'
                : status === 'warning'
                ? 'text-amber-500'
                : 'text-red-500'
            }`}
          >
            {statusLabels[status]}
          </span>
        </div>
      </div>
      <p className="text-sm text-muted-foreground font-medium">{title}</p>
      <p className="text-2xl font-bold text-foreground mt-0.5">{metric}</p>
      <p className="text-xs text-muted-foreground mt-1">{metricLabel}</p>
    </div>
  );
}

export default function HealthPage() {
  const [health, setHealth] = useState<HealthData>(defaultHealthData);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processResult, setProcessResult] = useState<string | null>(null);
  const [isLiveData, setIsLiveData] = useState(false);

  // ─── Load health data ───
  const loadHealth = useCallback(() => {
    fetchSystemHealth()
      .then((data: HealthData) => { setHealth(data); setIsLiveData(true); })
      .catch(() => {/* keep default data */})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000);
    return () => clearInterval(interval);
  }, [loadHealth]);

  // ─── Compute statuses ───
  const dbStatus: 'healthy' | 'warning' | 'error' =
    health.database.status === 'healthy' ? 'healthy' : 'error';

  const queueStatus: 'healthy' | 'warning' | 'error' =
    health.taskQueue.failed > 0
      ? 'error'
      : health.taskQueue.pending > 5
      ? 'warning'
      : 'healthy';

  const totalRecords = Object.values(health.database.tables).reduce(
    (sum, count) => sum + count,
    0
  );

  // ─── Process queue handler ───
  const handleProcessQueue = async () => {
    setProcessing(true);
    setProcessResult(null);
    try {
      const res = await fetch('/api/internal/process-tasks', { method: 'POST' });
      if (res.ok) {
        setProcessResult('success');
      } else {
        setProcessResult('error');
      }
    } catch {
      setProcessResult('error');
    } finally {
      setProcessing(false);
      setTimeout(() => setProcessResult(null), 3000);
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">System Health</h1>
            {!isLiveData && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                Demo Data
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isLiveData ? 'Infrastructure status and monitoring' : 'Showing sample data — log in as admin for live metrics'}
          </p>
        </div>
        <button
          onClick={loadHealth}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border/50 transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </motion.div>

      {/* Row 1 — 4 Status Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatusCard
          icon={<Database className="w-5 h-5" />}
          title="Database"
          status={dbStatus}
          metric={totalRecords.toLocaleString()}
          metricLabel="Total records across all tables"
        />
        <StatusCard
          icon={<ListTodo className="w-5 h-5" />}
          title="Task Queue"
          status={queueStatus}
          metric={`${health.taskQueue.pending} / ${health.taskQueue.running} / ${health.taskQueue.failed}`}
          metricLabel="Pending / Running / Failed"
        />
        <StatusCard
          icon={<Activity className="w-5 h-5" />}
          title="API Performance"
          status="healthy"
          metric={health.platform.totalLlmCalls.toLocaleString()}
          metricLabel={`Total LLM calls \u00B7 Uptime: ${formatUptime(health.platform.uptime)}`}
        />
        <StatusCard
          icon={<Server className="w-5 h-5" />}
          title="LLM Providers"
          status="healthy"
          metric={`$${health.platform.totalLlmCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          metricLabel="Total LLM cost (all providers)"
        />
      </motion.div>

      {/* Row 2 — Errors + Queue Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Errors */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <div className="flex items-center gap-2 mb-5">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="text-base font-semibold text-foreground">
              Recent Errors
            </h2>
          </div>
          {health.recentErrors.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-muted-foreground">No recent errors</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-3">
                      Message
                    </th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-3">
                      Error
                    </th>
                    <th className="text-right text-xs font-medium text-muted-foreground pb-3">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {health.recentErrors.map((error, idx) => (
                    <motion.tr
                      key={error.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="border-b border-border/30 last:border-0"
                    >
                      <td className="py-3 pr-3 max-w-[200px]">
                        <span className="text-foreground truncate block">
                          {error.userMessage}
                        </span>
                      </td>
                      <td className="py-3 pr-3 max-w-[200px]">
                        <span className="text-red-400 text-xs font-mono truncate block">
                          {error.errorMessage || 'Unknown error'}
                        </span>
                      </td>
                      <td className="py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(error.createdAt)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>

        {/* Queue Status */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold text-foreground mb-5">
            Queue Status
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {/* Pending */}
            <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-4 text-center">
              <p className="text-3xl font-bold text-amber-500">
                {health.taskQueue.pending}
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Pending
              </p>
            </div>
            {/* Running */}
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 text-center">
              <p className="text-3xl font-bold text-blue-500">
                {health.taskQueue.running}
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Running
              </p>
            </div>
            {/* Completed */}
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4 text-center">
              <p className="text-3xl font-bold text-emerald-500">
                {health.taskQueue.completed}
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Completed
              </p>
            </div>
            {/* Failed */}
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4 text-center">
              <p className="text-3xl font-bold text-red-500">
                {health.taskQueue.failed}
              </p>
              <p className="text-xs text-muted-foreground mt-1 font-medium">
                Failed
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Row 3 — Quick Actions */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <h2 className="text-base font-semibold text-foreground mb-1">
          Quick Actions
        </h2>
        <p className="text-xs text-muted-foreground mb-5">
          Administrative operations for the task queue
        </p>
        <div className="flex items-center gap-3">
          <Button
            onClick={handleProcessQueue}
            disabled={processing}
            className="gap-2"
            style={{
              backgroundColor: processResult === 'success' ? '#10b981' : undefined,
            }}
          >
            {processing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Processing...
              </>
            ) : processResult === 'success' ? (
              <>
                <Play className="w-4 h-4" />
                Queue Processed
              </>
            ) : processResult === 'error' ? (
              <>
                <AlertTriangle className="w-4 h-4" />
                Failed - Retry
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Process Queue
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
