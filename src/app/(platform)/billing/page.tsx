'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard, Zap, Check, Loader2, ArrowLeft,
  Crown, Sparkles, Building2, ExternalLink,
} from 'lucide-react';
import Link from 'next/link';
import { Sidebar } from '@/components/layout/sidebar';
import { Topbar } from '@/components/layout/topbar';

interface SubscriptionData {
  plan: string;
  status: string;
  currentPeriodEnd: string | null;
  priceId: string | null;
  hasStripeCustomer: boolean;
  trialEndsAt: string | null;
  priceIds: { starter: string; pro: string; enterprise: string };
  transactions: Array<{
    id: string;
    amount: number;
    plan: string;
    status: string;
    createdAt: string;
  }>;
}

const PLANS = [
  {
    key: 'STARTER',
    name: 'Starter',
    price: '$19',
    icon: Zap,
    color: '#10b981',
    features: [
      '3 projects',
      '2 API keys',
      '1 team member per project',
      'Community support',
      'Basic analytics',
    ],
  },
  {
    key: 'PRO',
    name: 'Pro',
    price: '$49',
    icon: Crown,
    color: '#3b82f6',
    popular: true,
    features: [
      '10 projects',
      '10 API keys',
      '5 team members per project',
      'Email support',
      'Advanced analytics',
      'Git integration',
      'Webhook endpoints',
    ],
  },
  {
    key: 'ENTERPRISE',
    name: 'Enterprise',
    price: '$299',
    icon: Building2,
    color: '#8b5cf6',
    features: [
      'Unlimited projects',
      '50 API keys',
      'Unlimited team members',
      'Priority support',
      'Custom integrations',
      'SSO / SAML',
      'Dedicated account manager',
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
};

export default function BillingPage() {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch('/api/billing/subscription')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleUpgrade = async (planKey: string) => {
    if (!data) return;
    const priceMap: Record<string, string> = {
      STARTER: data.priceIds.starter,
      PRO: data.priceIds.pro,
      ENTERPRISE: data.priceIds.enterprise,
    };
    const priceId = priceMap[planKey];
    if (!priceId) return;

    setCheckoutLoading(planKey);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      // handle error
    }
    setCheckoutLoading(null);
  };

  const handleManage = async () => {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const result = await res.json();
      if (result.url) {
        window.location.href = result.url;
      }
    } catch {
      // handle error
    }
    setPortalLoading(false);
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="max-w-5xl mx-auto space-y-6"
          >
            {/* Header */}
            <motion.div variants={itemVariants} className="flex items-center gap-4">
              <Link href="/projects">
                <Button variant="ghost" size="icon" className="shrink-0">
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Billing</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Manage your subscription and payment details
                </p>
              </div>
            </motion.div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {/* Current Plan */}
                <motion.div
                  variants={itemVariants}
                  className="glass-card rounded-xl border border-border/50 p-6"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
                        <CreditCard className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-lg font-semibold text-foreground">
                            {data?.plan ?? 'STARTER'} Plan
                          </h2>
                          <Badge variant={data?.status === 'ACTIVE' ? 'default' : 'secondary'}>
                            {data?.status ?? 'NONE'}
                          </Badge>
                        </div>
                        {data?.currentPeriodEnd && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Next billing: {new Date(data.currentPeriodEnd).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    {data?.hasStripeCustomer && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleManage}
                        disabled={portalLoading}
                        className="gap-1.5"
                      >
                        {portalLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <ExternalLink className="w-3.5 h-3.5" />
                        )}
                        Manage Subscription
                      </Button>
                    )}
                  </div>
                </motion.div>

                {/* Plan Cards */}
                <motion.div variants={itemVariants}>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Available Plans
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {PLANS.map((plan) => {
                      const Icon = plan.icon;
                      const isCurrent = data?.plan === plan.key;
                      return (
                        <div
                          key={plan.key}
                          className={`glass-card rounded-xl border p-5 transition-all ${
                            isCurrent
                              ? 'border-primary/50 ring-1 ring-primary/20'
                              : 'border-border/50 hover:border-border'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <div
                              className="flex items-center justify-center w-8 h-8 rounded-lg"
                              style={{ backgroundColor: plan.color + '15' }}
                            >
                              <Icon className="w-4 h-4" style={{ color: plan.color }} />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-foreground">{plan.name}</h4>
                              {plan.popular && (
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  <Sparkles className="w-2.5 h-2.5 mr-0.5" /> Popular
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="mb-4">
                            <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                            <span className="text-sm text-muted-foreground">/mo</span>
                          </div>

                          <ul className="space-y-2 mb-5">
                            {plan.features.map((f) => (
                              <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Check className="w-3.5 h-3.5 shrink-0" style={{ color: plan.color }} />
                                {f}
                              </li>
                            ))}
                          </ul>

                          {isCurrent ? (
                            <Button variant="outline" size="sm" className="w-full" disabled>
                              Current Plan
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              className="w-full"
                              disabled={checkoutLoading === plan.key}
                              onClick={() => handleUpgrade(plan.key)}
                              style={{ backgroundColor: plan.color }}
                            >
                              {checkoutLoading === plan.key ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                `${data?.plan && PLANS.findIndex((p) => p.key === data.plan) > PLANS.findIndex((p) => p.key === plan.key) ? 'Downgrade' : 'Upgrade'} to ${plan.name}`
                              )}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* Billing History */}
                {data?.transactions && data.transactions.length > 0 && (
                  <motion.div
                    variants={itemVariants}
                    className="glass-card rounded-xl border border-border/50 p-6"
                  >
                    <h3 className="text-sm font-semibold text-foreground mb-4">Billing History</h3>
                    <div className="space-y-2">
                      {data.transactions.map((tx) => (
                        <div
                          key={tx.id}
                          className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground">{tx.plan} Plan</p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(tx.createdAt).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-mono text-foreground">
                              ${tx.amount.toFixed(2)}
                            </span>
                            <Badge
                              variant={tx.status === 'COMPLETED' ? 'default' : 'destructive'}
                              className="text-[10px]"
                            >
                              {tx.status}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </>
            )}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
