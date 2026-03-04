'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, DollarSign, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { StatCard } from '@/components/admin/stat-card';
import { fetchAnalytics } from '@/lib/api';
import { mockLLMUsage } from '@/lib/mock-admin-data';

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

// ─── Format token count ───
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(0)}K`;
  }
  return tokens.toString();
}

export default function AnalyticsPage() {
  const [llmUsage, setLlmUsage] = useState(mockLLMUsage);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics()
      .then(setLlmUsage)
      .catch(() => {/* keep mock data */})
      .finally(() => setLoading(false));
  }, []);

  // ─── Total summary metrics ───
  const totalTokens = useMemo(
    () => llmUsage.reduce((sum, e) => sum + e.tokens_used, 0),
    [llmUsage]
  );
  const totalCost = useMemo(
    () => llmUsage.reduce((sum, e) => sum + e.cost, 0),
    [llmUsage]
  );
  const uniqueDays = useMemo(
    () => new Set(llmUsage.map((e) => e.date)).size,
    [llmUsage]
  );
  const avgCostPerDay = totalCost / uniqueDays;

  // ─── Daily token usage chart data (last 14 days) ───
  const dailyTokenData = useMemo(() => {
    const byDate: Record<string, number> = {};
    llmUsage.forEach((entry) => {
      byDate[entry.date] = (byDate[entry.date] || 0) + entry.tokens_used;
    });
    return Object.entries(byDate)
      .map(([date, tokens]) => ({
        date,
        tokens,
        label: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-14);
  }, [llmUsage]);

  // ─── Cost by provider ───
  const providerData = useMemo(() => {
    const byProvider: Record<string, number> = {};
    llmUsage.forEach((entry) => {
      byProvider[entry.provider] = (byProvider[entry.provider] || 0) + entry.cost;
    });
    const entries = Object.entries(byProvider).sort((a, b) => b[1] - a[1]);
    const maxCost = entries.length > 0 ? entries[0][1] : 1;
    return entries.map(([provider, cost]) => ({
      provider,
      cost: Math.round(cost * 100) / 100,
      percentage: (cost / maxCost) * 100,
    }));
  }, [llmUsage]);

  // ─── Cost by project (top 5) ───
  const projectData = useMemo(() => {
    const byProject: Record<string, number> = {};
    llmUsage.forEach((entry) => {
      byProject[entry.project_name] =
        (byProject[entry.project_name] || 0) + entry.cost;
    });
    const entries = Object.entries(byProject)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const maxCost = entries.length > 0 ? entries[0][1] : 1;
    return entries.map(([name, cost]) => ({
      name,
      cost: Math.round(cost * 100) / 100,
      percentage: (cost / maxCost) * 100,
    }));
  }, [llmUsage]);

  const providerColors: Record<string, string> = {
    anthropic: '#f59e0b',
    openai: '#10b981',
    google: '#3b82f6',
  };

  const providerLabels: Record<string, string> = {
    anthropic: 'Anthropic',
    openai: 'OpenAI',
    google: 'Google',
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <p className="text-sm text-muted-foreground mt-1">
          LLM usage and cost analysis
        </p>
      </motion.div>

      {/* Summary Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <StatCard
          title="Total Tokens"
          value={formatTokens(totalTokens)}
          icon={<BarChart3 className="w-5 h-5" />}
          color="#f59e0b"
        />
        <StatCard
          title="Total Cost"
          value={`$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`}
          icon={<DollarSign className="w-5 h-5" />}
          color="#10b981"
        />
        <StatCard
          title="Avg Cost/Day"
          value={`$${Math.round(avgCostPerDay)}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="#3b82f6"
        />
      </motion.div>

      {/* Daily Token Usage Chart */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <h2 className="text-base font-semibold text-foreground mb-1">
          Daily Token Usage
        </h2>
        <p className="text-xs text-muted-foreground mb-6">
          Token consumption over the last 14 days
        </p>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={dailyTokenData}
              margin={{ top: 5, right: 10, left: 0, bottom: 0 }}
            >
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
                tickFormatter={(value) => formatTokens(value)}
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
                labelStyle={{
                  color: 'hsl(var(--foreground))',
                  fontWeight: 600,
                  marginBottom: 4,
                }}
                itemStyle={{ color: 'hsl(var(--muted-foreground))' }}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                formatter={(value: any) => [formatTokens(Number(value)), 'Tokens']}
              />
              <Bar
                dataKey="tokens"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Cost Breakdown: Provider + Project */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost by Provider */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold text-foreground mb-1">
            Cost by Provider
          </h2>
          <p className="text-xs text-muted-foreground mb-5">
            Total spend per LLM provider
          </p>
          <div className="space-y-4">
            {providerData.map((item) => (
              <div key={item.provider} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground">
                    {providerLabels[item.provider] || item.provider}
                  </span>
                  <span className="text-sm font-semibold text-foreground">
                    ${item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' as const, delay: 0.3 }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor:
                        providerColors[item.provider] || '#6366f1',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Cost by Project */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold text-foreground mb-1">
            Cost by Project
          </h2>
          <p className="text-xs text-muted-foreground mb-5">
            Top 5 projects by total spend
          </p>
          <div className="space-y-4">
            {projectData.map((item) => (
              <div key={item.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground truncate mr-3">
                    {item.name}
                  </span>
                  <span className="text-sm font-semibold text-foreground whitespace-nowrap">
                    ${item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' as const, delay: 0.3 }}
                    className="h-full rounded-full bg-amber-500"
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
