'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { fetchBilling } from '@/lib/api';
import {
  mockBillingMetrics,
  mockTransactions,
  mockAdminStats,
} from '@/lib/mock-admin-data';
import { TrendingUp, DollarSign, CreditCard, Percent, Search } from 'lucide-react';
import { StatCard } from '@/components/admin/stat-card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

const planColors: Record<string, string> = {
  starter: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
  pro: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  enterprise: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
};

const planBarColors: Record<string, string> = {
  starter: '#71717a',
  pro: '#f59e0b',
  enterprise: '#3b82f6',
};

const statusColors: Record<string, string> = {
  completed: 'bg-emerald-500/15 text-emerald-500 border-emerald-500/30',
  pending: 'bg-amber-500/15 text-amber-500 border-amber-500/30',
  failed: 'bg-red-500/15 text-red-500 border-red-500/30',
  refunded: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
};

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

export default function AdminBillingPage() {
  const [billingMetrics, setBillingMetrics] = useState(mockBillingMetrics);
  const [transactions, setTransactions] = useState(mockTransactions);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBilling()
      .then(({ metrics, transactions: txns }) => {
        setBillingMetrics(metrics);
        setTransactions(txns);
      })
      .catch(() => {/* keep mock data */})
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-bold text-foreground">Billing & Revenue</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Financial overview and subscription management
        </p>
      </motion.div>

      {/* Stat Cards */}
      <motion.div
        className="grid grid-cols-4 gap-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <StatCard
          title="MRR"
          value={formatCurrency(billingMetrics.mrr)}
          change={mockAdminStats.projects_growth}
          icon={<TrendingUp className="w-5 h-5" />}
          color="#10b981"
        />
        <StatCard
          title="Total Revenue"
          value={formatCurrency(billingMetrics.total_revenue)}
          change={12.5}
          icon={<DollarSign className="w-5 h-5" />}
          color="#3b82f6"
        />
        <StatCard
          title="Active Subscriptions"
          value={billingMetrics.active_subscriptions}
          change={mockAdminStats.users_growth}
          icon={<CreditCard className="w-5 h-5" />}
          color="#f59e0b"
        />
        <StatCard
          title="Churn Rate"
          value={`${billingMetrics.churn_rate}%`}
          change={-0.5}
          icon={<Percent className="w-5 h-5" />}
          color={billingMetrics.churn_rate > 3 ? '#ef4444' : '#10b981'}
        />
      </motion.div>

      {/* Plan Distribution */}
      <motion.div
        className="glass-card rounded-xl border border-border/50 p-6"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <h2 className="text-base font-semibold text-foreground mb-4">
          Plan Distribution
        </h2>
        <div className="space-y-4">
          {billingMetrics.plan_distribution.map((plan, index) => (
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
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${plan.percentage}%` }}
                  transition={{
                    duration: 0.7,
                    delay: 0.3 + index * 0.1,
                    ease: 'easeOut' as const,
                  }}
                  style={{ backgroundColor: planBarColors[plan.plan] }}
                />
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Recent Transactions */}
      <motion.div
        className="glass-card rounded-xl border border-border/50"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.3 }}
      >
        <div className="p-4 border-b border-border/50 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Recent Transactions
          </h2>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search transactions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border/50 bg-background/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-[var(--admin-accent)]/30 focus:border-[var(--admin-accent)]/50 transition-all"
            />
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow className="border-border/50 hover:bg-transparent">
              <TableHead className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">
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
                className="border-b border-border/30 transition-colors hover:bg-muted/50"
              >
                {/* User */}
                <TableCell>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {txn.user_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {txn.user_email}
                    </p>
                  </div>
                </TableCell>

                {/* Amount */}
                <TableCell>
                  <span className="text-sm font-semibold text-foreground">
                    ${txn.amount.toFixed(2)}
                  </span>
                </TableCell>

                {/* Plan */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`capitalize text-[11px] ${planColors[txn.plan]}`}
                  >
                    {txn.plan}
                  </Badge>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Badge
                    variant="outline"
                    className={`capitalize text-[11px] ${statusColors[txn.status]}`}
                  >
                    {txn.status}
                  </Badge>
                </TableCell>

                {/* Date */}
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatDate(txn.date)}
                  </span>
                </TableCell>
              </motion.tr>
            ))}
          </TableBody>
        </Table>

        {filteredTransactions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <CreditCard className="w-10 h-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No transactions found</p>
            <p className="text-xs mt-1">Try adjusting your search term</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
