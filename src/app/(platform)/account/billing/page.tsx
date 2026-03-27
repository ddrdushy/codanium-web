'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard, Zap, CheckCircle2, AlertTriangle, TrendingDown,
  ArrowUpRight, ArrowDownRight, Loader2, RefreshCw, Sparkles,
  Clock, Gift,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CreditTransaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

interface WalletData {
  balance: number;
  lifetimeAdded: number;
  lifetimeUsed: number;
  freeCreditsGranted: number;
  freeCreditsExpiry: string | null;
  freeDataConsent: boolean;
  warningLevel: 'warn' | 'critical' | null;
  transactions: CreditTransaction[];
}

interface CreditPack {
  id: string;
  label: string;
  priceInCents: number;
  credits: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatUSD(amount: number): string {
  return `$${Math.abs(amount).toFixed(2)}`;
}

function txIcon(type: string, amount: number) {
  if (type === 'FREE_GRANT') return <Gift className="w-3.5 h-3.5 text-amber" />;
  if (type === 'PURCHASE') return <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />;
  if (type === 'USAGE') return <ArrowDownRight className="w-3.5 h-3.5 text-muted-foreground" />;
  if (type === 'REFUND') return <ArrowUpRight className="w-3.5 h-3.5 text-blue-400" />;
  return amount >= 0
    ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" />
    : <ArrowDownRight className="w-3.5 h-3.5 text-muted-foreground" />;
}

function txColor(amount: number): string {
  return amount >= 0 ? 'text-emerald-400' : 'text-muted-foreground';
}

function trialDaysLeft(expiry: string | null): number | null {
  if (!expiry) return null;
  const ms = new Date(expiry).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// Inner component (needs useSearchParams — wrapped in Suspense)
// ---------------------------------------------------------------------------

function BillingPageInner() {
  const searchParams = useSearchParams();
  const justPurchased = searchParams.get('success') === '1';
  const packId = searchParams.get('pack');

  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [packs, setPacks] = useState<CreditPack[]>([]);
  const [loading, setLoading] = useState(true);
  const [buyingPack, setBuyingPack] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/account/credits').then(r => r.json()),
      fetch('/api/billing/credits').then(r => r.json()),
    ]).then(([walletData, packData]) => {
      setWallet(walletData);
      setPacks(packData.packs ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function buyCredits(pid: string) {
    setBuyingPack(pid);
    try {
      const res = await fetch('/api/billing/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pid }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setBuyingPack(null);
    }
  }

  const daysLeft = wallet ? trialDaysLeft(wallet.freeCreditsExpiry) : null;
  const usedPct = wallet && wallet.lifetimeAdded > 0
    ? Math.min((wallet.lifetimeUsed / wallet.lifetimeAdded) * 100, 100)
    : 0;

  return (
    <div className="min-h-screen bg-background p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Credits & Billing</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage your AI agent credits and model configuration
          </p>
        </div>
        <button
          onClick={() => {
            setLoading(true);
            fetch('/api/account/credits').then(r => r.json())
              .then(setWallet).catch(() => {}).finally(() => setLoading(false));
          }}
          className="p-2 rounded-lg hover:bg-foreground/[0.04] text-muted-foreground transition-colors"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Purchase success banner */}
      {justPurchased && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-400">Credits added!</p>
            <p className="text-xs text-muted-foreground">Your {packId} pack has been credited to your account.</p>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-amber" />
        </div>
      ) : (
        <>
          {/* Balance card */}
          <div className="rounded-2xl border border-border bg-[var(--surface)] overflow-hidden">
            {/* Warning banners */}
            {wallet?.warningLevel === 'critical' && (
              <div className="flex items-center gap-2.5 px-5 py-3 bg-red-500/10 border-b border-red-500/20">
                <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-xs text-red-400">
                  <span className="font-semibold">No credits remaining.</span> AI agents are paused. Top up to resume, or configure your own model key.
                </p>
              </div>
            )}
            {wallet?.warningLevel === 'warn' && (
              <div className="flex items-center gap-2.5 px-5 py-3 bg-amber/10 border-b border-amber/20">
                <AlertTriangle className="w-4 h-4 text-amber shrink-0" />
                <p className="text-xs text-amber">
                  <span className="font-semibold">Credits running low</span> — {(100 - usedPct).toFixed(0)}% remaining. Top up to keep your AI team running.
                </p>
              </div>
            )}

            <div className="p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Available Balance</p>
                  <p className="text-4xl font-bold mt-0.5">
                    ${wallet?.balance.toFixed(2) ?? '0.00'}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center">
                  <Zap className="w-5 h-5 text-amber" />
                </div>
              </div>

              {/* Usage bar */}
              {wallet && wallet.lifetimeAdded > 0 && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[10px] text-muted-foreground">
                    <span>{formatUSD(wallet.lifetimeUsed)} used</span>
                    <span>{formatUSD(wallet.lifetimeAdded)} total added</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        usedPct >= 100 ? 'bg-red-400' : usedPct >= 80 ? 'bg-amber' : 'bg-emerald-400',
                      )}
                      style={{ width: `${usedPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Free trial badge */}
              {wallet?.freeCreditsGranted && wallet.freeCreditsGranted > 0 && daysLeft !== null && daysLeft > 0 && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-amber bg-amber/5 border border-amber/10 rounded-lg px-3 py-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Free trial: <span className="font-semibold">{daysLeft} day{daysLeft !== 1 ? 's' : ''} left</span>
                    {' '}· ${wallet.freeCreditsGranted} in trial credits (data may be used to improve the platform)
                  </span>
                </div>
              )}
              {daysLeft === 0 && wallet?.freeCreditsGranted && wallet.freeCreditsGranted > 0 && (
                <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Free trial expired — top up to continue using AI agents</span>
                </div>
              )}
            </div>
          </div>

          {/* Credit packs */}
          <div>
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber" />
              Top Up Credits
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {packs.map((pack) => {
                const bonusPct = Math.round(((pack.credits - pack.priceInCents / 100) / (pack.priceInCents / 100)) * 100);
                const hasBonus = bonusPct > 0;
                return (
                  <motion.div
                    key={pack.id}
                    whileHover={{ scale: 1.01 }}
                    className={cn(
                      'relative rounded-xl border bg-[var(--surface)] p-4 cursor-pointer transition-colors',
                      hasBonus ? 'border-amber/30' : 'border-border',
                    )}
                  >
                    {hasBonus && (
                      <span className="absolute -top-2 right-3 text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber text-black">
                        +{bonusPct}% bonus
                      </span>
                    )}
                    <div className="mb-3">
                      <p className="text-xs font-semibold">{pack.label}</p>
                      <p className="text-2xl font-bold mt-0.5">${pack.credits}</p>
                      <p className="text-[10px] text-muted-foreground">in AI credits</p>
                    </div>
                    <Button
                      onClick={() => buyCredits(pack.id)}
                      disabled={!!buyingPack}
                      size="sm"
                      className={cn(
                        'w-full h-8 text-xs',
                        hasBonus
                          ? 'bg-amber text-black hover:bg-amber/90'
                          : 'bg-foreground/[0.06] text-foreground hover:bg-foreground/[0.1]',
                      )}
                    >
                      {buyingPack === pack.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <><CreditCard className="w-3.5 h-3.5 mr-1" />${(pack.priceInCents / 100).toFixed(0)}</>
                      )}
                    </Button>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* Transaction history */}
          {wallet && wallet.transactions.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-muted-foreground" />
                Transaction History
              </h2>
              <div className="rounded-xl border border-border bg-[var(--surface)] divide-y divide-border">
                {wallet.transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-7 h-7 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center shrink-0">
                      {txIcon(tx.type, tx.amount)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{tx.description}</p>
                      <p className="text-[10px] text-muted-foreground/60">
                        {new Date(tx.createdAt).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                    </div>
                    <span className={cn('text-xs font-semibold tabular-nums shrink-0', txColor(tx.amount))}>
                      {tx.amount >= 0 ? '+' : ''}{formatUSD(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {wallet && wallet.transactions.length === 0 && (
            <div className="text-center py-12 text-muted-foreground/40">
              <TrendingDown className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No transactions yet</p>
              <p className="text-xs mt-0.5">Usage will appear here as your AI team works</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page (wraps inner in Suspense for useSearchParams)
// ---------------------------------------------------------------------------

export default function BillingPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin text-amber" />
      </div>
    }>
      <BillingPageInner />
    </Suspense>
  );
}
