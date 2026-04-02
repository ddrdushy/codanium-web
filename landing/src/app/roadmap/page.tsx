'use client';

import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Circle, Sparkles, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const roadmap = [
  {
    quarter: 'Q1 2026',
    label: 'Foundation',
    items: [
      { title: 'Desktop App Launch', description: 'Mac, Windows, and Linux installers with auto-update', status: 'completed' },
      { title: 'AI Agent Improvements', description: 'Enhanced BA and SA agents with context-aware analysis', status: 'completed' },
      { title: 'CI/CD Integration', description: 'Automated deployment pipelines with GitHub Actions', status: 'completed' },
      { title: 'Multi-provider LLM Fallback', description: 'Seamless failover across 6+ LLM providers', status: 'completed' },
    ],
  },
  {
    quarter: 'Q2 2026',
    label: 'Growth',
    items: [
      { title: 'Multi-language Support', description: 'Python, Go, Rust, and Java project scaffolding', status: 'in-progress' },
      { title: 'Real-time Collaboration', description: 'Live cursors and shared project workspaces', status: 'in-progress' },
      { title: 'Advanced Code Review', description: 'AI-powered code review with security scanning', status: 'in-progress' },
    ],
  },
  {
    quarter: 'Q3 2026',
    label: 'Scale',
    items: [
      { title: 'Enterprise SSO', description: 'SAML 2.0 and OIDC for organization-level auth', status: 'planned' },
      { title: 'Custom AI Models', description: 'Bring your own fine-tuned models to the platform', status: 'planned' },
      { title: 'Marketplace', description: 'Community plugins, templates, and agent extensions', status: 'planned' },
      { title: 'Audit Logging', description: 'Comprehensive activity logs for compliance', status: 'planned' },
    ],
  },
  {
    quarter: 'Q4 2026',
    label: 'Enterprise',
    items: [
      { title: 'On-premise Deployment', description: 'Self-hosted option for enterprise environments', status: 'planned' },
      { title: 'Advanced Analytics', description: 'Project health metrics, velocity tracking, cost forecasting', status: 'planned' },
      { title: 'White-label Solution', description: 'Rebrandable platform for agencies and consultancies', status: 'planned' },
    ],
  },
];

const statusConfig = {
  completed: { icon: CheckCircle2, label: 'Completed', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  'in-progress': { icon: Clock, label: 'In Progress', color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  planned: { icon: Circle, label: 'Planned', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30' },
};

export default function RoadmapPage() {
  return (
    <>
      {/* Hero */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-blue-500/5" />
        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-amber">
              Where we are headed
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Product{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Roadmap
              </span>
            </h1>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Transparency is a core value. Here is what we have shipped, what we are building now, and what is coming next.
            </p>

            {/* Legend */}
            <div className="flex flex-wrap items-center justify-center gap-6 pt-4">
              {Object.entries(statusConfig).map(([key, config]) => (
                <div key={key} className="flex items-center gap-2">
                  <config.icon className={`h-4 w-4 ${config.color}`} />
                  <span className="text-sm text-muted-foreground">{config.label}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Timeline */}
      <section className="relative py-16 sm:py-24">
        <div className="mx-auto max-w-5xl px-6">
          {/* Vertical line */}
          <div className="absolute left-1/2 top-0 hidden h-full w-px bg-border lg:block" />

          <div className="space-y-16">
            {roadmap.map((quarter, qi) => (
              <motion.div
                key={quarter.quarter}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: qi * 0.1 }}
              >
                {/* Quarter heading */}
                <div className="mb-8 flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber/10 border border-amber/20">
                    <Sparkles className="h-5 w-5 text-amber" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">{quarter.quarter}</h2>
                    <p className="text-sm text-muted-foreground">{quarter.label}</p>
                  </div>
                </div>

                {/* Feature cards */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {quarter.items.map((item, ii) => {
                    const status = statusConfig[item.status as keyof typeof statusConfig];
                    const StatusIcon = status.icon;
                    return (
                      <motion.div
                        key={item.title}
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.4, delay: ii * 0.05 }}
                        className="rounded-xl border border-border bg-[var(--surface)] p-6 card-lift"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-2">
                            <h3 className="font-semibold text-foreground">{item.title}</h3>
                            <p className="text-sm text-muted-foreground">{item.description}</p>
                          </div>
                          <span
                            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${status.bg} ${status.color} ${status.border} border`}
                          >
                            <StatusIcon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-[var(--surface)]" />
        <div className="relative mx-auto max-w-3xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Have a Feature Request?
            </h2>
            <p className="text-lg text-muted-foreground">
              We build Codanium in the open. Share your ideas and vote on what matters most to you.
            </p>
            <Link href="/community">
              <Button
                size="lg"
                className="bg-amber text-background hover:bg-amber/90 font-semibold text-base px-10 h-13 glow-amber"
              >
                Join the Discussion
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>
    </>
  );
}
