'use client';

import { useRef } from 'react';
import Link from 'next/link';
import { motion, useInView } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description: string;
  features: string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}

const tiers: PricingTier[] = [
  {
    name: 'Starter',
    price: '$0',
    period: '/mo',
    description: 'For personal projects',
    features: [
      '3 projects',
      '5 agents',
      'Basic pipeline',
      'Community support',
      '10K tokens/mo',
    ],
    cta: 'Get Started Free',
    href: '/signup',
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/mo',
    description: 'For growing teams',
    features: [
      'Unlimited projects',
      'All 23 agents',
      'Full SDLC pipeline',
      'Priority support',
      '500K tokens/mo',
      'Advanced analytics',
      'Custom workflows',
    ],
    cta: 'Start Pro Trial',
    href: '/signup?plan=pro',
    highlighted: true,
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    description: 'For organizations',
    features: [
      'Everything in Pro',
      'SSO & SAML',
      'Custom agents',
      '99.9% SLA',
      'Dedicated support',
      'Unlimited tokens',
      'Audit logs',
    ],
    cta: 'Contact Sales',
    href: '/signup?plan=enterprise',
  },
];

export function PricingSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section
      id="pricing"
      className="relative py-24 sm:py-32 bg-[var(--surface)]"
    >
      <div className="mx-auto max-w-7xl px-6">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center mb-16"
        >
          <span className="text-sm font-semibold uppercase tracking-widest text-amber">
            Pricing
          </span>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Simple, Transparent Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Start free and scale as your team grows. No hidden fees.
          </p>
        </motion.div>

        {/* Cards */}
        <div ref={ref} className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-3">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{
                duration: 0.5,
                delay: i * 0.12,
                ease: 'easeOut' as const,
              }}
              className={cn(
                'relative flex flex-col rounded-2xl border p-8',
                tier.highlighted
                  ? 'border-amber/40 bg-[var(--surface-raised)] scale-[1.02] glow-amber shadow-xl z-10'
                  : 'border-border bg-[var(--surface-raised)]'
              )}
            >
              {/* Popular badge */}
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-amber text-background font-semibold px-3 py-1 text-xs">
                    Most Popular
                  </Badge>
                </div>
              )}

              {/* Header */}
              <div className="mb-6">
                <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{tier.description}</p>
              </div>

              {/* Price */}
              <div className="mb-8">
                <span className="text-5xl font-extrabold tracking-tight text-foreground">
                  {tier.price}
                </span>
                {tier.period && (
                  <span className="text-lg text-muted-foreground">{tier.period}</span>
                )}
              </div>

              {/* Features */}
              <ul className="mb-8 flex-1 space-y-3">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <CheckCircle2
                      className={cn(
                        'mt-0.5 h-4 w-4 shrink-0',
                        tier.highlighted ? 'text-amber' : 'text-emerald-500'
                      )}
                    />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Link href={tier.href}>
                <Button
                  className={cn(
                    'w-full font-semibold',
                    tier.highlighted
                      ? 'bg-amber text-background hover:bg-amber/90 glow-amber'
                      : ''
                  )}
                  variant={tier.highlighted ? 'default' : 'outline'}
                  size="lg"
                >
                  {tier.cta}
                </Button>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
