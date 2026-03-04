'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, FolderOpen, DollarSign, Bot } from 'lucide-react';
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
import { mockAdminStats, mockLLMUsage, mockRecentActivity } from '@/lib/mock-admin-data';

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
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export default function AdminDashboardPage() {
  // Aggregate LLM usage costs by date (last 14 days)
  const costTrendData = useMemo(() => {
    const costByDate: Record<string, number> = {};
    mockLLMUsage.forEach((entry) => {
      costByDate[entry.date] = (costByDate[entry.date] || 0) + entry.cost;
    });

    return Object.entries(costByDate)
      .map(([date, cost]) => ({
        date,
        cost: Math.round(cost * 100) / 100,
        label: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14);
  }, []);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your platform metrics and activity
        </p>
      </motion.div>

      {/* Stat Cards Row */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          title="Total Users"
          value={mockAdminStats.total_users.toLocaleString()}
          change={mockAdminStats.users_growth}
          icon={<Users className="w-5 h-5" />}
          color="#3b82f6"
        />
        <StatCard
          title="Total Projects"
          value={mockAdminStats.total_projects.toLocaleString()}
          change={mockAdminStats.projects_growth}
          icon={<FolderOpen className="w-5 h-5" />}
          color="#f59e0b"
        />
        <StatCard
          title="Monthly LLM Cost"
          value={`$${mockAdminStats.monthly_llm_cost.toLocaleString()}`}
          change={mockAdminStats.cost_change}
          icon={<DollarSign className="w-5 h-5" />}
          color="#10b981"
        />
        <StatCard
          title="Active Agents"
          value={mockAdminStats.active_agents.toLocaleString()}
          change={mockAdminStats.agents_change}
          icon={<Bot className="w-5 h-5" />}
          color="#8b5cf6"
        />
      </motion.div>

      {/* Two-column Layout: Chart + Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: LLM Cost Trend Chart */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold text-foreground mb-1">
            LLM Cost Trend
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            Daily aggregate costs over the last 14 days
          </p>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={costTrendData}
                margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
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
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  dy={8}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(value) => `$${value}`}
                  dx={-4}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    padding: '8px 12px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600, marginBottom: 4 }}
                  itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  formatter={(value: any) => [`$${Number(value).toFixed(2)}`, 'Cost']}
                />
                <Area
                  type="monotone"
                  dataKey="cost"
                  stroke="#f59e0b"
                  strokeWidth={2}
                  fill="url(#costGradient)"
                  dot={false}
                  activeDot={{ r: 5, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Right Column: Recent Activity */}
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
          <div className="space-y-4 overflow-y-auto max-h-[320px] pr-1">
            {mockRecentActivity.map((activity) => {
              const dotColor = activityColors[activity.type] || '#64748b';
              return (
                <div key={activity.id} className="flex items-start gap-3">
                  {/* Colored dot */}
                  <div className="mt-1.5 flex-shrink-0">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: dotColor }}
                    />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">
                      <span className="font-medium">{activity.actor}</span>{' '}
                      <span className="text-muted-foreground">{activity.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-0.5">
                      {getRelativeTime(activity.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
