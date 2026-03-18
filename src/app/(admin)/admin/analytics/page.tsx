'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Hash, DollarSign, TrendingUp, Server } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from 'recharts';
import { StatCard } from '@/components/admin/stat-card';
import { fetchAnalytics } from '@/lib/api';
import { mockLLMUsage } from '@/lib/mock-admin-data';
import type { LLMUsageData } from '@/types';

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

// ─── Date range options ───
const dateRanges = [
  { label: '7d', days: 7 },
  { label: '14d', days: 14 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

// ─── Provider config ───
const providerColors: Record<string, string> = {
  anthropic: '#0d9488',
  openai: '#3b82f6',
  google: '#f59e0b',
};

const providerLabels: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  google: 'Google',
};

// ─── Format token count ───
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(0)}K`;
  return tokens.toString();
}

// ─── Custom chart tooltip ───
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-lg">
      <p className="text-sm font-semibold text-foreground mb-2">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.dataKey} className="flex items-center gap-2 text-xs">
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">
            {providerLabels[entry.dataKey] || entry.dataKey}:
          </span>
          <span className="font-medium text-foreground">
            {formatTokens(Number(entry.value))}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AnalyticsPage() {
  const [llmUsage, setLlmUsage] = useState<LLMUsageData[]>(mockLLMUsage);
  const [loading, setLoading] = useState(true);
  const [selectedRange, setSelectedRange] = useState<number>(30);
  const [isLiveData, setIsLiveData] = useState(false);

  // ─── Compute date from range ───
  const computedFrom = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - selectedRange);
    return d.toISOString().split('T')[0];
  }, [selectedRange]);

  // ─── Fetch data ───
  const loadData = useCallback(() => {
    setLoading(true);
    fetchAnalytics({ from: computedFrom, limit: 500 })
      .then((data) => { setLlmUsage(data.usage); setIsLiveData(true); })
      .catch(() => {/* keep mock data */})
      .finally(() => setLoading(false));
  }, [computedFrom]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─── Summary metrics ───
  const totalTokens = useMemo(
    () => llmUsage.reduce((sum, e) => sum + e.tokens_used, 0),
    [llmUsage]
  );
  const totalCost = useMemo(
    () => llmUsage.reduce((sum, e) => sum + e.cost, 0),
    [llmUsage]
  );
  const uniqueDays = useMemo(
    () => new Set(llmUsage.map((e) => e.date)).size || 1,
    [llmUsage]
  );
  const avgCostPerDay = totalCost / uniqueDays;
  const activeProviders = useMemo(
    () => new Set(llmUsage.map((e) => e.provider)).size,
    [llmUsage]
  );

  // ─── Daily token usage chart data (stacked by provider) ───
  const dailyTokenData = useMemo(() => {
    const byDate: Record<string, Record<string, number>> = {};
    llmUsage.forEach((entry) => {
      if (!byDate[entry.date]) byDate[entry.date] = {};
      byDate[entry.date][entry.provider] =
        (byDate[entry.date][entry.provider] || 0) + entry.tokens_used;
    });
    return Object.entries(byDate)
      .map(([date, providers]) => ({
        date,
        label: new Date(date).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
        }),
        ...providers,
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [llmUsage]);

  // ─── Provider breakdown ───
  const providerData = useMemo(() => {
    const byProvider: Record<string, { tokens: number; cost: number }> = {};
    llmUsage.forEach((entry) => {
      if (!byProvider[entry.provider]) {
        byProvider[entry.provider] = { tokens: 0, cost: 0 };
      }
      byProvider[entry.provider].tokens += entry.tokens_used;
      byProvider[entry.provider].cost += entry.cost;
    });
    const entries = Object.entries(byProvider).sort(
      (a, b) => b[1].cost - a[1].cost
    );
    const maxCost = entries.length > 0 ? entries[0][1].cost : 1;
    return entries.map(([provider, data]) => ({
      provider,
      cost: Math.round(data.cost * 100) / 100,
      tokens: data.tokens,
      percentage: (data.cost / maxCost) * 100,
    }));
  }, [llmUsage]);

  // ─── Top projects by spend ───
  const projectData = useMemo(() => {
    const byProject: Record<string, { tokens: number; cost: number }> = {};
    llmUsage.forEach((entry) => {
      if (!byProject[entry.project_name]) {
        byProject[entry.project_name] = { tokens: 0, cost: 0 };
      }
      byProject[entry.project_name].tokens += entry.tokens_used;
      byProject[entry.project_name].cost += entry.cost;
    });
    return Object.entries(byProject)
      .map(([name, data]) => ({
        name,
        tokens: data.tokens,
        cost: Math.round(data.cost * 100) / 100,
      }))
      .sort((a, b) => b.cost - a.cost);
  }, [llmUsage]);

  // ─── All provider keys for stacked bars ───
  const allProviders = useMemo(
    () => [...new Set(llmUsage.map((e) => e.provider))],
    [llmUsage]
  );

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Page Header + Date Range */}
      <motion.div
        variants={itemVariants}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">LLM Analytics</h1>
            {!isLiveData && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                Demo Data
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {isLiveData ? 'Token usage, cost trends, and provider analysis' : 'Showing sample data — log in as admin for live metrics'}
          </p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-lg bg-muted/50 border border-border/50">
          {dateRanges.map((range) => (
            <button
              key={range.days}
              onClick={() => setSelectedRange(range.days)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-150 ${
                selectedRange === range.days
                  ? 'bg-[var(--admin-accent)] text-white shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {range.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Row 1 — 4 Metric Cards */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          title="Total Tokens"
          value={formatTokens(totalTokens)}
          icon={<Hash className="w-5 h-5" />}
          color="#0d9488"
        />
        <StatCard
          title="Total Cost"
          value={`$${totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<DollarSign className="w-5 h-5" />}
          color="#3b82f6"
        />
        <StatCard
          title="Avg Cost/Day"
          value={`$${avgCostPerDay.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color="#f59e0b"
        />
        <StatCard
          title="Active Providers"
          value={activeProviders.toString()}
          icon={<Server className="w-5 h-5" />}
          color="#8b5cf6"
        />
      </motion.div>

      {/* Row 2 — Chart + Provider Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Daily Token Usage — Stacked Bar Chart */}
        <motion.div
          variants={itemVariants}
          className="lg:col-span-2 glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold text-foreground mb-1">
            Daily Token Usage
          </h2>
          <p className="text-xs text-muted-foreground mb-6">
            Token consumption by provider over the selected period
          </p>
          <div className="h-[320px] w-full">
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
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  formatter={(value: string) => (
                    <span className="text-xs text-muted-foreground">
                      {providerLabels[value] || value}
                    </span>
                  )}
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ paddingTop: 12 }}
                />
                {allProviders.map((provider) => (
                  <Bar
                    key={provider}
                    dataKey={provider}
                    stackId="tokens"
                    fill={providerColors[provider] || '#64748b'}
                    radius={[0, 0, 0, 0]}
                    maxBarSize={40}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Provider Breakdown */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold text-foreground mb-1">
            Provider Breakdown
          </h2>
          <p className="text-xs text-muted-foreground mb-5">
            Cost distribution by LLM provider
          </p>
          <div className="space-y-5">
            {providerData.map((item) => (
              <div key={item.provider} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{
                        backgroundColor: providerColors[item.provider] || '#64748b',
                      }}
                    />
                    <span className="text-sm font-medium text-foreground">
                      {providerLabels[item.provider] || item.provider}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    ${item.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${item.percentage}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
                    className="h-full rounded-full"
                    style={{
                      backgroundColor: providerColors[item.provider] || '#64748b',
                    }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatTokens(item.tokens)} tokens
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Row 3 — Top Projects by Spend */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50 p-6"
      >
        <h2 className="text-base font-semibold text-foreground mb-1">
          Top Projects by Spend
        </h2>
        <p className="text-xs text-muted-foreground mb-5">
          Projects ranked by total LLM cost
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left text-xs font-medium text-muted-foreground pb-3 pr-4">
                  Project
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground pb-3 px-4">
                  Tokens
                </th>
                <th className="text-right text-xs font-medium text-muted-foreground pb-3 pl-4">
                  Cost
                </th>
              </tr>
            </thead>
            <tbody>
              {projectData.map((project, idx) => (
                <motion.tr
                  key={project.name}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="border-b border-border/30 last:border-0"
                >
                  <td className="py-3 pr-4">
                    <span className="font-medium text-foreground">
                      {project.name}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right text-muted-foreground font-mono text-xs">
                    {formatTokens(project.tokens)}
                  </td>
                  <td className="py-3 pl-4 text-right font-semibold text-foreground">
                    ${project.cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </motion.div>
  );
}
