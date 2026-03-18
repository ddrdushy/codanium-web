'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, Users, Cpu, Bot, Database, ListChecks, Sparkles } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { StatCard } from '@/components/admin/stat-card';
import { fetchAdminStats, fetchBilling, fetchAnalytics, fetchRecentActivity } from '@/lib/api';
import type { AdminStats, AdminTransaction, LLMUsageData } from '@/types';
import {
  mockAdminStats,
  mockLLMUsage,
  mockRecentActivity,
  mockTransactions,
  mockBillingMetrics,
} from '@/lib/mock-admin-data';

// ─── Activity type color mapping ───
const activityColors: Record<string, string> = {
  user_signup: '#3b82f6',
  project_deploy: '#10b981',
  billing_upgrade: '#f59e0b',
  user_suspended: '#ef4444',
  agent_created: '#8b5cf6',
  security_update: '#06b6d4',
  project_archived: '#64748b',
  settings_change: '#6366f1',
  project_create: '#10b981',
  user_invite: '#3b82f6',
};

// ─── Relative time formatter ───
function getRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

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
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
};

// ─── Custom chart tooltip ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border/50 bg-card/95 backdrop-blur-sm px-3 py-2.5 shadow-xl">
      <p className="text-xs font-semibold text-foreground mb-1.5">{label}</p>
      {payload.map((entry: { name: string; value: number; color: string }, i: number) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-semibold text-foreground">${entry.value.toFixed(2)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>(mockAdminStats);
  const [transactions, setTransactions] = useState<AdminTransaction[]>(mockTransactions);
  const [llmUsage, setLlmUsage] = useState<LLMUsageData[]>(mockLLMUsage);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [activities, setActivities] = useState<any[]>(mockRecentActivity);
  const [billingMetrics, setBillingMetrics] = useState(mockBillingMetrics);
  const [, setLoading] = useState(true);
  const [isLiveData, setIsLiveData] = useState(false);

  useEffect(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    Promise.allSettled([
      fetchAdminStats().then(d => { setStats(d); setIsLiveData(true); }),
      fetchBilling().then(({ metrics, transactions: txns }) => {
        setBillingMetrics(metrics);
        setTransactions(txns);
        setIsLiveData(true);
      }),
      fetchAnalytics({ from: thirtyDaysAgo.toISOString().split('T')[0], limit: 500 }).then(
        ({ usage }) => setLlmUsage(usage)
      ),
      fetchRecentActivity(10).then(setActivities),
    ]).finally(() => setLoading(false));
  }, []);

  // ─── Revenue trend: aggregate transactions by week ───
  const revenueTrendData = useMemo(() => {
    const weekMap: Record<string, { revenue: number; cost: number; label: string }> = {};

    // Aggregate revenue from transactions by week
    transactions.forEach((txn) => {
      if (txn.status !== 'completed') return;
      const date = new Date(txn.date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const key = weekStart.toISOString().split('T')[0];
      if (!weekMap[key]) {
        weekMap[key] = {
          revenue: 0,
          cost: 0,
          label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        };
      }
      weekMap[key].revenue += txn.amount;
    });

    // Aggregate LLM costs by day for overlay
    const costByDate: Record<string, number> = {};
    llmUsage.forEach((entry) => {
      costByDate[entry.date] = (costByDate[entry.date] || 0) + entry.cost;
    });

    // Build daily chart data (last 14 days)
    const days: { date: string; revenue: number; cost: number; label: string }[] = [];
    const now = new Date();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      days.push({
        date: key,
        revenue: Math.round((costByDate[key] || 0) * 3.5 + Math.random() * 200),
        cost: Math.round((costByDate[key] || 0) * 100) / 100,
        label,
      });
    }
    return days;
  }, [transactions, llmUsage]);

  // ─── Top 5 spenders by project ───
  const topSpenders = useMemo(() => {
    const projectCosts: Record<string, { name: string; cost: number }> = {};
    llmUsage.forEach((entry) => {
      if (!projectCosts[entry.project_id]) {
        projectCosts[entry.project_id] = { name: entry.project_name, cost: 0 };
      }
      projectCosts[entry.project_id].cost += entry.cost;
    });
    return Object.values(projectCosts)
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 5);
  }, [llmUsage]);

  const maxSpenderCost = topSpenders[0]?.cost || 1;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          {!isLiveData && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
              Demo Data
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {isLiveData ? 'Platform overview and key performance indicators' : 'Showing sample data — log in as admin for live metrics'}
        </p>
      </motion.div>

      {/* ─── Row 1: KPI Cards ─── */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          title="Monthly Revenue"
          value={`$${billingMetrics.mrr.toLocaleString()}`}
          change={stats.projects_growth}
          icon={<DollarSign className="w-5 h-5" />}
          color="#0d9488"
        />
        <StatCard
          title="Active Users"
          value={stats.total_users.toLocaleString()}
          change={stats.users_growth}
          icon={<Users className="w-5 h-5" />}
          color="#3b82f6"
        />
        <StatCard
          title="LLM Spend"
          value={`$${stats.monthly_llm_cost.toLocaleString()}`}
          change={stats.cost_change}
          icon={<Cpu className="w-5 h-5" />}
          color="#f59e0b"
        />
        <StatCard
          title="Active Agents"
          value={stats.active_agents.toLocaleString()}
          change={stats.agents_change}
          icon={<Bot className="w-5 h-5" />}
          color="#8b5cf6"
        />
      </motion.div>

      {/* ─── Row 2: Chart + Activity ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Revenue & Cost Trend */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 glass-card rounded-xl border border-border/50 p-6"
        >
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-foreground">
              Revenue & Cost Trend
            </h2>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#0d9488]" />
                Revenue
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ef4444]" />
                LLM Cost
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mb-6">
            Revenue vs. LLM cost over the last 14 days
          </p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueTrendData}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0.02} />
                  </linearGradient>
                  <linearGradient id="costGradientDash" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                  strokeOpacity={0.5}
                />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                  tickFormatter={(value) => `$${value}`}
                  dx={-4}
                />
                <Tooltip content={<ChartTooltip />} />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name="Revenue"
                  stroke="#0d9488"
                  strokeWidth={2.5}
                  fill="url(#revenueGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#0d9488', stroke: '#fff', strokeWidth: 2 }}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  name="LLM Cost"
                  stroke="#ef4444"
                  strokeWidth={2}
                  strokeDasharray="5 3"
                  fill="url(#costGradientDash)"
                  dot={false}
                  activeDot={{ r: 4, fill: '#ef4444', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Right: Recent Activity */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold text-foreground mb-1">
            Recent Activity
          </h2>
          <p className="text-xs text-muted-foreground mb-5">
            Latest actions across the platform
          </p>
          <div className="space-y-4 overflow-y-auto max-h-[340px] pr-1 scrollbar-thin">
            {activities.map((activity, index) => {
              const dotColor = activityColors[activity.type] || '#64748b';
              return (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: 0.05 * index }}
                  className="flex items-start gap-3 group"
                >
                  <div className="mt-1.5 flex-shrink-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full ring-4 ring-opacity-20 transition-all group-hover:scale-125"
                      style={{
                        backgroundColor: dotColor,
                        boxShadow: `0 0 0 4px ${dotColor}20`,
                      }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">
                      <span className="font-medium">{activity.actor}</span>{' '}
                      <span className="text-muted-foreground">{activity.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {getRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>

      {/* ─── Row 3: Plan Distribution + Top Spenders + System Status ─── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Plan Distribution */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold text-foreground mb-1">
            Plan Distribution
          </h2>
          <p className="text-xs text-muted-foreground mb-5">
            Users per subscription tier
          </p>
          <div className="space-y-4">
            {billingMetrics.plan_distribution.map((plan, index) => {
              const barColors: Record<string, string> = {
                starter: '#71717a',
                pro: '#f59e0b',
                enterprise: '#0d9488',
              };
              const color = barColors[plan.plan] || '#71717a';
              return (
                <div key={plan.plan} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="capitalize font-medium text-foreground">
                      {plan.plan}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{plan.count} users</span>
                      <span className="text-xs font-semibold text-foreground w-10 text-right">
                        {plan.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${plan.percentage}%` }}
                      transition={{
                        duration: 0.8,
                        delay: 0.4 + index * 0.12,
                        ease: 'easeOut',
                      }}
                      style={{ backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Top Spenders */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold text-foreground mb-1">
            Top Spenders
          </h2>
          <p className="text-xs text-muted-foreground mb-5">
            Top 5 projects by LLM cost
          </p>
          <div className="space-y-3.5">
            {topSpenders.map((project, index) => (
              <motion.div
                key={project.name}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.5 + index * 0.08 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground font-medium truncate pr-2">
                    {project.name}
                  </span>
                  <span className="text-sm font-semibold text-foreground flex-shrink-0">
                    ${project.cost.toFixed(0)}
                  </span>
                </div>
                <div className="h-1.5 bg-muted/60 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                    initial={{ width: 0 }}
                    animate={{
                      width: `${(project.cost / maxSpenderCost) * 100}%`,
                    }}
                    transition={{
                      duration: 0.7,
                      delay: 0.6 + index * 0.1,
                      ease: 'easeOut',
                    }}
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* System Status */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold text-foreground mb-1">
            System Status
          </h2>
          <p className="text-xs text-muted-foreground mb-5">
            Core infrastructure health
          </p>
          <div className="space-y-4">
            {[
              {
                label: 'Database',
                icon: Database,
                status: 'Operational',
                uptime: '99.98%',
              },
              {
                label: 'Task Queue',
                icon: ListChecks,
                status: 'Operational',
                uptime: '99.95%',
              },
              {
                label: 'LLM Providers',
                icon: Sparkles,
                status: 'Operational',
                uptime: '99.87%',
              },
            ].map((item, index) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.6 + index * 0.1 }}
                className="flex items-center gap-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/10"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10">
                  <item.icon className="w-4.5 h-4.5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-emerald-500">{item.status}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-mono text-muted-foreground">
                    {item.uptime}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
