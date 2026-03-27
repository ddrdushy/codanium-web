'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Download, RefreshCw, Loader2, Zap, DollarSign,
  Hash, ChevronLeft, ChevronRight, Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface UsageRecord {
  id: string;
  createdAt: string;
  provider: string;
  model: string;
  tokensUsed: number;
  actualCost: number;
  markedUpCost: number | null;
  billingType: string;
  agentName: string;
  projectId: string;
}

interface DailyUsage {
  date: string;
  tokens: number;
  cost: number;
}

interface UsageData {
  usage: UsageRecord[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  summary: { totalTokens: number; totalCost: number; totalCalls: number };
  thisMonth: { tokens: number; cost: number; calls: number };
  dailyUsage: DailyUsage[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatUSD(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const providerColors: Record<string, string> = {
  anthropic: '#0d9488',
  openai:    '#3b82f6',
  ollama:    '#8b5cf6',
  mistral:   '#f59e0b',
  groq:      '#ef4444',
  together:  '#10b981',
};

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

function exportCSV(records: UsageRecord[]) {
  const headers = ['Date', 'Provider', 'Model', 'Agent', 'Tokens', 'Actual Cost', 'Charged Cost', 'Billing Type'];
  const rows = records.map(r => [
    new Date(r.createdAt).toISOString(),
    r.provider,
    r.model,
    r.agentName,
    r.tokensUsed,
    r.actualCost.toFixed(6),
    (r.markedUpCost ?? r.actualCost).toFixed(6),
    r.billingType,
  ]);
  const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `ai-usage-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Stat card
// ---------------------------------------------------------------------------

function StatCard({ label, value, sub, color }: {
  label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color }}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function UsagePage() {
  const [data, setData]       = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage]       = useState(1);
  const [provider, setProvider]       = useState('');
  const [billingType, setBillingType] = useState('');

  const load = useCallback(async (p = page) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), limit: '50' });
      if (provider)    params.set('provider', provider);
      if (billingType) params.set('billingType', billingType);
      const res = await fetch(`/api/account/usage?${params}`);
      if (res.ok) setData(await res.json());
    } catch { /* keep previous */ }
    setLoading(false);
  }, [page, provider, billingType]);

  useEffect(() => { load(); }, [load]);

  function applyFilter() { setPage(1); load(1); }

  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div className="min-h-screen bg-background p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Usage & Consumption</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Your AI agent token usage and billing details
          </p>
        </div>
        <div className="flex items-center gap-2">
          {data && data.usage.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => exportCSV(data.usage)}
              className="gap-1.5 text-xs"
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
          )}
          <button
            onClick={() => load()}
            className="p-2 rounded-lg hover:bg-foreground/[0.04] text-muted-foreground transition-colors"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Stats — this month */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Tokens This Month"
          value={formatTokens(data?.thisMonth.tokens ?? 0)}
          sub={`${data?.thisMonth.calls ?? 0} LLM calls`}
          color="#0d9488"
        />
        <StatCard
          label="Spend This Month"
          value={`$${(data?.thisMonth.cost ?? 0).toFixed(4)}`}
          sub="including platform markup"
          color="#f59e0b"
        />
        <StatCard
          label="All-Time Tokens"
          value={formatTokens(data?.summary.totalTokens ?? 0)}
          sub={`${data?.summary.totalCalls ?? 0} total calls`}
          color="#8b5cf6"
        />
      </div>

      {/* Daily chart */}
      {data && data.dailyUsage.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-border bg-[var(--surface)] p-5"
        >
          <p className="text-sm font-semibold mb-4">Daily Token Usage — Last 30 Days</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.dailyUsage} barSize={10}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#888' }}
                tickFormatter={d => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                axisLine={false} tickLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#888' }}
                tickFormatter={formatTokens}
                axisLine={false} tickLine={false} width={40}
              />
              <Tooltip
                contentStyle={{ background: '#1a1a1a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
                formatter={(v: number | undefined) => [formatTokens(v ?? 0), 'Tokens']}
                labelFormatter={d => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              />
              <Bar dataKey="tokens" fill="#0d9488" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Filter:</span>
        </div>
        <select
          value={provider}
          onChange={e => setProvider(e.target.value)}
          className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none"
        >
          <option value="">All Providers</option>
          <option value="anthropic">Anthropic</option>
          <option value="openai">OpenAI</option>
          <option value="ollama">Ollama</option>
          <option value="mistral">Mistral</option>
          <option value="groq">Groq</option>
          <option value="together">Together AI</option>
        </select>
        <select
          value={billingType}
          onChange={e => setBillingType(e.target.value)}
          className="h-8 px-2 text-xs rounded-md border border-border bg-background text-foreground focus:outline-none"
        >
          <option value="">All Billing Types</option>
          <option value="PLATFORM">Platform (credits)</option>
          <option value="BYOK">BYOK (your key)</option>
        </select>
        <Button variant="outline" size="sm" onClick={applyFilter} className="h-8 text-xs">
          Apply
        </Button>
      </div>

      {/* Usage table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : data && data.usage.length > 0 ? (
        <div className="rounded-xl border border-border bg-[var(--surface)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/50 bg-white/[0.02]">
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Provider / Model</th>
                  <th className="text-left px-4 py-3 font-medium">Agent</th>
                  <th className="text-right px-4 py-3 font-medium">Tokens</th>
                  <th className="text-right px-4 py-3 font-medium">Cost</th>
                  <th className="text-center px-4 py-3 font-medium">Billing</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {data.usage.map(r => {
                  const cost = r.markedUpCost ?? r.actualCost;
                  const color = providerColors[r.provider] ?? '#888';
                  return (
                    <tr key={r.id} className="hover:bg-white/[0.015] transition-colors">
                      <td className="px-4 py-2.5 text-muted-foreground whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: color }}
                          />
                          <div>
                            <span className="font-medium capitalize">{r.provider}</span>
                            <span className="text-muted-foreground ml-1.5 font-mono text-[10px]">{r.model}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.agentName}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums font-medium">
                        {formatTokens(r.tokensUsed)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">
                        {cost > 0 ? formatUSD(cost) : <span className="text-muted-foreground/40">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={cn(
                          'inline-block px-1.5 py-0.5 rounded text-[9px] font-semibold uppercase tracking-wide',
                          r.billingType === 'BYOK'
                            ? 'bg-blue-500/10 text-blue-400'
                            : 'bg-amber/10 text-amber',
                        )}>
                          {r.billingType === 'BYOK' ? 'BYOK' : 'Platform'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border/30">
              <span className="text-[10px] text-muted-foreground">
                Page {data.pagination.page} of {totalPages} · {data.pagination.total} records
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => { const p = page - 1; setPage(p); load(p); }}
                  className="h-7 w-7 p-0"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => { const p = page + 1; setPage(p); load(p); }}
                  className="h-7 w-7 p-0"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground/40">
          <Zap className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No usage records found</p>
          <p className="text-xs mt-0.5">LLM calls will appear here once your AI team starts working</p>
        </div>
      )}
    </div>
  );
}
