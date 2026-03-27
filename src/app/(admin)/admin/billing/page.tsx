'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingUp, Users, TrendingDown, Search, CreditCard,
  Zap, Key, Download, ArrowUpRight, ArrowDownRight, Gift,
} from 'lucide-react';
import { StatCard } from '@/components/admin/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { fetchBilling } from '@/lib/api';
import { mockBillingMetrics, mockTransactions } from '@/lib/mock-admin-data';
import type { BillingMetrics, AdminTransaction } from '@/types';

// ─── Style maps ───
const planBadgeStyles: Record<string, string> = {
  starter: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
  pro: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  enterprise: 'bg-blue-500/15 text-blue-400 border-blue-500/20',
};

const statusBadgeStyles: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20',
  pending: 'bg-amber-500/15 text-amber-500 border-amber-500/20',
  failed: 'bg-red-500/15 text-red-500 border-red-500/20',
  refunded: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/20',
};

const planBarColors: Record<string, string> = {
  starter: '#71717a',
  pro: '#f59e0b',
  enterprise: '#0d9488',
};

const planPrices: Record<string, number> = {
  starter: 19,
  pro: 49,
  enterprise: 299,
};

// ─── Helpers ───
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ─── Animation variants ───
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

type CreditData = NonNullable<Awaited<ReturnType<typeof fetchBilling>>['credits']>;
type TopSpender  = Awaited<ReturnType<typeof fetchBilling>>['top_spenders'][number];

function txIcon(type: string, amount: number) {
  if (type === 'FREE_GRANT') return <Gift className="w-3 h-3 text-amber-400" />;
  if (type === 'PURCHASE')   return <ArrowUpRight className="w-3 h-3 text-emerald-400" />;
  if (type === 'USAGE')      return <ArrowDownRight className="w-3 h-3 text-muted-foreground" />;
  return amount >= 0
    ? <ArrowUpRight className="w-3 h-3 text-emerald-400" />
    : <ArrowDownRight className="w-3 h-3 text-muted-foreground" />;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function exportCSV(rows: CreditData['recent_transactions']) {
  const headers = ['Date', 'User', 'Email', 'Type', 'Amount', 'Description'];
  const body = rows.map(r => [
    new Date(r.createdAt).toISOString(), r.user_name ?? '', r.user_email ?? '',
    r.type, r.amount.toFixed(4), `"${r.description}"`,
  ]);
  const csv = [headers, ...body].map(r => r.join(',')).join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })),
    download: `credits-${new Date().toISOString().slice(0, 10)}.csv`,
  });
  a.click();
}

export default function AdminBillingPage() {
  const [billingMetrics, setBillingMetrics] = useState<BillingMetrics>(mockBillingMetrics);
  const [transactions, setTransactions] = useState<AdminTransaction[]>(mockTransactions);
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [topSpenders, setTopSpenders] = useState<TopSpender[]>([]);
  const [, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isLiveData, setIsLiveData] = useState(false);
  const [creditTab, setCreditTab] = useState<'credits' | 'spenders'>('credits');

  useEffect(() => {
    fetchBilling()
      .then(({ metrics, transactions: txns, credits: c, top_spenders }) => {
        setBillingMetrics(metrics);
        setTransactions(txns);
        if (c) setCredits(c);
        setTopSpenders(top_spenders);
        setIsLiveData(true);
      })
      .catch(() => {
        /* keep mock data */
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredTransactions = useMemo(() => {
    if (!search.trim()) return transactions;
    const term = search.toLowerCase();
    return transactions.filter(
      (t) =>
        t.user_name.toLowerCase().includes(term) ||
        t.user_email.toLowerCase().includes(term)
    );
  }, [search, transactions]);

  // Calculate revenue per plan
  const revenueByPlan = useMemo(() => {
    return billingMetrics.plan_distribution.map((p) => ({
      plan: p.plan,
      count: p.count,
      revenue: p.count * planPrices[p.plan],
    }));
  }, [billingMetrics]);

  const totalPlanRevenue = revenueByPlan.reduce((sum, p) => sum + p.revenue, 0);

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Billing & Revenue</h1>
          {!isLiveData && (
            <span className="text-[10px] font-medium text-amber-600 bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
              Demo Data
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          {isLiveData ? 'Financial overview and subscription management' : 'Showing sample data — log in as admin for live metrics'}
        </p>
      </motion.div>

      {/* ─── Row 1: Stat Cards ─── */}
      <motion.div
        variants={itemVariants}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StatCard
          title="MRR"
          value={formatCurrency(billingMetrics.mrr)}
          change={8.3}
          icon={<DollarSign className="w-5 h-5" />}
          color="#0d9488"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(billingMetrics.total_revenue)}
          change={12.5}
          icon={<TrendingUp className="w-5 h-5" />}
          color="#3b82f6"
        />
        <StatCard
          title="Active Subscriptions"
          value={billingMetrics.active_subscriptions.toLocaleString()}
          change={5.2}
          icon={<Users className="w-5 h-5" />}
          color="#10b981"
        />
        <StatCard
          title="Churn Rate"
          value={`${billingMetrics.churn_rate}%`}
          change={-0.5}
          icon={<TrendingDown className="w-5 h-5" />}
          color="#ef4444"
        />
      </motion.div>

      {/* ─── Row 2: Plan Distribution + Revenue by Plan ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Plan Distribution */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold text-foreground mb-1">Plan Distribution</h2>
          <p className="text-xs text-muted-foreground mb-6">
            Active subscriptions by tier
          </p>
          <div className="space-y-5">
            {billingMetrics.plan_distribution.map((plan, index) => {
              const color = planBarColors[plan.plan] || '#71717a';
              return (
                <div key={plan.plan} className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-sm"
                        style={{ backgroundColor: color }}
                      />
                      <span className="capitalize text-sm font-medium text-foreground">
                        {plan.plan}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-muted-foreground tabular-nums">
                        {plan.count} users
                      </span>
                      <span className="text-sm font-semibold text-foreground w-12 text-right tabular-nums">
                        {plan.percentage}%
                      </span>
                    </div>
                  </div>
                  <div className="h-2.5 bg-muted/60 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${plan.percentage}%` }}
                      transition={{
                        duration: 0.8,
                        delay: 0.3 + index * 0.12,
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

        {/* Revenue by Plan */}
        <motion.div
          variants={itemVariants}
          className="glass-card rounded-xl border border-border/50 p-6"
        >
          <h2 className="text-base font-semibold text-foreground mb-1">Revenue by Plan</h2>
          <p className="text-xs text-muted-foreground mb-6">
            Monthly recurring revenue breakdown
          </p>
          <div className="space-y-4">
            {revenueByPlan.map((item, index) => {
              const color = planBarColors[item.plan] || '#71717a';
              const percentage = totalPlanRevenue > 0
                ? Math.round((item.revenue / totalPlanRevenue) * 100)
                : 0;
              return (
                <motion.div
                  key={item.plan}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.4 + index * 0.1 }}
                  className="p-4 rounded-lg border border-border/30 bg-background/50 hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: color }}
                      />
                      <span className="capitalize text-sm font-semibold text-foreground">
                        {item.plan}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        ({item.count} x ${planPrices[item.plan]}/mo)
                      </span>
                    </div>
                    <span className="text-lg font-bold text-foreground tabular-nums">
                      {formatCurrency(item.revenue)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-1.5 bg-muted/60 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        transition={{
                          duration: 0.7,
                          delay: 0.5 + index * 0.12,
                          ease: 'easeOut',
                        }}
                        style={{ backgroundColor: color }}
                      />
                    </div>
                    <span className="text-xs font-medium text-muted-foreground w-10 text-right tabular-nums">
                      {percentage}%
                    </span>
                  </div>
                </motion.div>
              );
            })}
            {/* Total */}
            <div className="pt-3 border-t border-border/30 flex items-center justify-between">
              <span className="text-sm font-semibold text-muted-foreground">Total MRR</span>
              <span className="text-lg font-bold text-foreground tabular-nums">
                {formatCurrency(totalPlanRevenue)}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ─── Row 2b: Credit Wallet Overview ─── */}
      {credits && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Wallet stats */}
          <motion.div variants={itemVariants} className="glass-card rounded-xl border border-border/50 p-6">
            <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              Credit Wallet Overview
            </h2>
            <p className="text-xs text-muted-foreground mb-5">Platform credits in circulation</p>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Total Wallets',        value: credits.total_wallets.toLocaleString() },
                { label: 'Credits Issued',        value: `$${credits.lifetime_added.toFixed(2)}`, color: 'text-emerald-400' },
                { label: 'Credits Consumed',      value: `$${credits.lifetime_used.toFixed(2)}` },
                { label: 'Outstanding Balance',   value: `$${credits.total_balance.toFixed(2)}`,  color: 'text-amber-400' },
              ].map(row => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className={cn('font-medium tabular-nums', row.color)}>{row.value}</span>
                </div>
              ))}
              <div className="pt-2 space-y-1.5">
                {credits.lifetime_added > 0 && (
                  <>
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{((credits.lifetime_used / credits.lifetime_added) * 100).toFixed(1)}% consumed</span>
                      <span>{(100 - (credits.lifetime_used / credits.lifetime_added) * 100).toFixed(1)}% remaining</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-400"
                        style={{ width: `${Math.min((credits.lifetime_used / credits.lifetime_added) * 100, 100)}%` }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>

          {/* BYOK vs Platform */}
          <motion.div variants={itemVariants} className="glass-card rounded-xl border border-border/50 p-6">
            <h2 className="text-base font-semibold text-foreground mb-1 flex items-center gap-2">
              <Key className="w-4 h-4 text-blue-400" />
              BYOK vs Platform
            </h2>
            <p className="text-xs text-muted-foreground mb-5">Users by billing mode</p>
            <div className="space-y-4">
              {[
                { label: 'BYOK Users',     count: credits.byok_users,     color: '#3b82f6' },
                { label: 'Platform Users', count: credits.platform_users, color: '#f59e0b' },
              ].map(row => {
                const total = credits.byok_users + credits.platform_users;
                const pct   = total > 0 ? (row.count / total) * 100 : 0;
                return (
                  <div key={row.label} className="space-y-1.5">
                    <div className="flex justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                        <span className="text-muted-foreground">{row.label}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-medium">{row.count}</span>
                        <span className="text-muted-foreground text-xs w-10 text-right">{pct.toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-white/[0.06] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: row.color }} />
                    </div>
                  </div>
                );
              })}
              <p className="text-[10px] text-muted-foreground pt-1">
                BYOK users supply their own API key — no credits charged.
              </p>
            </div>
          </motion.div>
        </div>
      )}

      {/* ─── Row 2c: Credit transactions + Top spenders ─── */}
      {(credits || topSpenders.length > 0) && (
        <motion.div variants={itemVariants} className="glass-card rounded-xl border border-border/50 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-border/30">
            <div className="flex">
              {(['credits', 'spenders'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setCreditTab(t)}
                  className={cn(
                    'px-4 py-1.5 text-xs font-medium rounded-lg transition-colors',
                    creditTab === t ? 'bg-[var(--admin-accent)]/15 text-[var(--admin-accent)]' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t === 'credits' ? 'Credit Transactions' : 'Top Spenders'}
                </button>
              ))}
            </div>
            {creditTab === 'credits' && credits && credits.recent_transactions.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => exportCSV(credits.recent_transactions)} className="gap-1.5 text-xs h-8">
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            )}
          </div>

          {creditTab === 'credits' && credits && (
            credits.recent_transactions.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30 bg-white/[0.02]">
                    <th className="text-left px-5 py-3 font-medium">Date</th>
                    <th className="text-left px-4 py-3 font-medium">User</th>
                    <th className="text-left px-4 py-3 font-medium">Type</th>
                    <th className="text-left px-4 py-3 font-medium">Description</th>
                    <th className="text-right px-5 py-3 font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {credits.recent_transactions.map(t => (
                    <tr key={t.id} className="hover:bg-white/[0.015]">
                      <td className="px-5 py-2.5 text-muted-foreground whitespace-nowrap">
                        {new Date(t.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{t.user_name ?? '—'}</p>
                        <p className="text-muted-foreground/60 text-[10px]">{t.user_email ?? ''}</p>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded flex items-center justify-center bg-white/[0.04]">
                            {txIcon(t.type, t.amount)}
                          </span>
                          <span className="capitalize text-muted-foreground">{t.type.replace(/_/g, ' ').toLowerCase()}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground max-w-[180px] truncate">{t.description}</td>
                      <td className={cn(
                        'px-5 py-2.5 text-right font-semibold tabular-nums',
                        t.amount >= 0 ? 'text-emerald-400' : 'text-muted-foreground',
                      )}>
                        {t.amount >= 0 ? '+' : ''}${Math.abs(t.amount).toFixed(4)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-10 text-muted-foreground/40">
                <Zap className="w-7 h-7 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No credit transactions yet</p>
              </div>
            )
          )}

          {creditTab === 'spenders' && (
            topSpenders.length > 0 ? (
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-muted-foreground border-b border-border/30 bg-white/[0.02]">
                    <th className="text-left px-5 py-3 font-medium">User</th>
                    <th className="text-right px-4 py-3 font-medium">Total Spend</th>
                    <th className="text-right px-4 py-3 font-medium">Tokens</th>
                    <th className="text-right px-5 py-3 font-medium">Calls</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {topSpenders.map((s, i) => (
                    <tr key={s.userId ?? i} className="hover:bg-white/[0.015]">
                      <td className="px-5 py-2.5">
                        <p className="font-medium">{s.name}</p>
                        <p className="text-muted-foreground/60 text-[10px]">{s.email}</p>
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-amber-400">
                        ${s.totalSpend.toFixed(4)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {formatTokens(s.totalTokens)}
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums text-muted-foreground">
                        {s.calls.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-10 text-muted-foreground/40">
                <TrendingUp className="w-7 h-7 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No platform usage recorded yet</p>
              </div>
            )
          )}
        </motion.div>
      )}

      {/* ─── Row 3: Transactions Table ─── */}
      <motion.div
        variants={itemVariants}
        className="glass-card rounded-xl border border-border/50"
      >
        <div className="p-5 border-b border-border/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground">Recent Transactions</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {transactions.length} total transactions
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border/50 bg-background/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-[#0d9488]/30 focus:border-[#0d9488]/50 transition-all"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="pl-5 text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                User
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Amount
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Plan
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Status
              </TableHead>
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
                Date
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTransactions.map((txn, index) => (
              <motion.tr
                key={txn.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: index * 0.03 }}
                className="border-b border-border/30 transition-colors hover:bg-muted/30"
              >
                {/* User */}
                <TableCell className="pl-5">
                  <div>
                    <p className="text-sm font-medium text-foreground">{txn.user_name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{txn.user_email}</p>
                  </div>
                </TableCell>

                {/* Amount */}
                <TableCell>
                  <span className="text-sm font-semibold text-foreground tabular-nums">
                    ${txn.amount.toFixed(2)}
                  </span>
                </TableCell>

                {/* Plan */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`capitalize text-[11px] ${planBadgeStyles[txn.plan] || ''}`}
                  >
                    {txn.plan}
                  </Badge>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`capitalize text-[11px] ${statusBadgeStyles[txn.status] || ''}`}
                  >
                    {txn.status}
                  </Badge>
                </TableCell>

                {/* Date */}
                <TableCell>
                  <span className="text-sm text-muted-foreground">{formatDate(txn.date)}</span>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>

        {filteredTransactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mb-3">
              <CreditCard className="w-7 h-7 opacity-40" />
            </div>
            <p className="text-sm font-medium">No transactions found</p>
            <p className="text-xs mt-1 text-muted-foreground/60">Try adjusting your search term</p>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
