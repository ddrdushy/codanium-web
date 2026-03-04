'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Play, Bot, CheckCircle2, Zap, GitBranch, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const stagger = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12, delayChildren: 0.2 },
  },
};

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' as const } },
};

const agentAvatars = [
  { name: 'BA', color: 'bg-emerald-500' },
  { name: 'SA', color: 'bg-blue-500' },
  { name: 'FE', color: 'bg-purple-500' },
  { name: 'QA', color: 'bg-rose-500' },
  { name: 'PM', color: 'bg-amber-500' },
];

const miniCards = [
  { title: 'Auth Module', status: 'In Progress', color: 'text-amber-400 bg-amber-400/10' },
  { title: 'API Design', status: 'Review', color: 'text-blue-400 bg-blue-400/10' },
  { title: 'DB Schema', status: 'Done', color: 'text-emerald-400 bg-emerald-400/10' },
];

export function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden pt-24 pb-20">
      {/* Background effects */}
      <div className="hero-gradient absolute inset-0" />
      <div className="grid-pattern absolute inset-0" />

      <div className="relative mx-auto max-w-7xl px-6">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {/* Left — Copy */}
          <motion.div
            variants={stagger}
            initial="hidden"
            animate="visible"
            className="max-w-2xl"
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 rounded-full border border-amber/20 bg-amber/5 px-4 py-1.5 text-sm font-medium text-amber mb-6">
                <Zap className="h-3.5 w-3.5" />
                Now in Public Beta
              </span>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              className="mt-4 text-5xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-6xl lg:text-7xl"
            >
              Ship Products{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                10x Faster
              </span>{' '}
              with AI Agent Teams
            </motion.h1>

            <motion.p
              variants={fadeUp}
              className="mt-6 text-lg leading-relaxed text-muted-foreground sm:text-xl"
            >
              23 specialized AI agents work alongside your team to analyze, design,
              build, test, and deploy software. One platform, every stage of your
              SDLC automated.
            </motion.p>

            <motion.div variants={fadeUp} className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-amber text-background hover:bg-amber/90 font-semibold text-base px-8 h-12 glow-amber"
                >
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <a href="#how-it-works">
                <Button
                  variant="outline"
                  size="lg"
                  className="font-semibold text-base h-12 px-8"
                >
                  <Play className="mr-2 h-4 w-4" />
                  See How It Works
                </Button>
              </a>
            </motion.div>

            <motion.div
              variants={fadeUp}
              className="mt-8 flex items-center gap-6 text-sm text-muted-foreground"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                No credit card required
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                Free tier available
              </span>
            </motion.div>
          </motion.div>

          {/* Right — Dashboard Mockup */}
          <motion.div
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.4, ease: 'easeOut' }}
            className="relative hidden lg:block"
          >
            <div className="animate-float-slow rounded-2xl border border-border bg-[var(--surface)] p-5 shadow-2xl">
              {/* Mockup top bar */}
              <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded-full bg-red-500/60" />
                  <div className="h-3 w-3 rounded-full bg-amber-500/60" />
                  <div className="h-3 w-3 rounded-full bg-emerald-500/60" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Zap className="h-3 w-3 text-amber" />
                  <span>AI Team Studio</span>
                </div>
                <div className="w-16" />
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-4 gap-3 mb-4">
                {[
                  { label: 'Active Cards', value: '47', icon: GitBranch, color: 'text-blue-400' },
                  { label: 'Agents', value: '8', icon: Bot, color: 'text-emerald-400' },
                  { label: 'Decisions', value: '3', icon: CheckCircle2, color: 'text-purple-400' },
                  { label: 'Velocity', value: '94%', icon: BarChart3, color: 'text-amber-400' },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-border bg-[var(--surface-raised)] p-3"
                  >
                    <div className="flex items-center gap-1.5 mb-1">
                      <stat.icon className={`h-3 w-3 ${stat.color}`} />
                      <span className="text-[10px] text-muted-foreground">{stat.label}</span>
                    </div>
                    <span className="text-lg font-bold text-foreground">{stat.value}</span>
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-medium text-muted-foreground">SDLC Progress</span>
                  <span className="text-[10px] text-amber font-semibold">Stage 6/10</span>
                </div>
                <div className="h-2 w-full rounded-full bg-[var(--surface-overlay)]">
                  <div className="h-2 w-[60%] rounded-full bg-gradient-to-r from-amber-500 to-orange-500" />
                </div>
              </div>

              {/* Agent avatars + mini cards */}
              <div className="grid grid-cols-2 gap-3">
                {/* Active Agents */}
                <div className="rounded-lg border border-border bg-[var(--surface-raised)] p-3">
                  <span className="text-[10px] font-medium text-muted-foreground mb-2 block">
                    Active Agents
                  </span>
                  <div className="flex -space-x-2">
                    {agentAvatars.map((agent) => (
                      <div
                        key={agent.name}
                        className={`flex h-7 w-7 items-center justify-center rounded-full ${agent.color} text-[9px] font-bold text-white ring-2 ring-[var(--surface)]`}
                      >
                        {agent.name}
                      </div>
                    ))}
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--surface-overlay)] text-[9px] font-medium text-muted-foreground ring-2 ring-[var(--surface)]">
                      +15
                    </div>
                  </div>
                </div>

                {/* Mini task cards */}
                <div className="rounded-lg border border-border bg-[var(--surface-raised)] p-3">
                  <span className="text-[10px] font-medium text-muted-foreground mb-2 block">
                    Recent Tasks
                  </span>
                  <div className="space-y-1.5">
                    {miniCards.map((card) => (
                      <div key={card.title} className="flex items-center justify-between">
                        <span className="text-[10px] text-foreground">{card.title}</span>
                        <span className={`text-[8px] font-medium px-1.5 py-0.5 rounded ${card.color}`}>
                          {card.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Glow effect behind mockup */}
            <div className="absolute -inset-4 -z-10 rounded-3xl bg-amber/5 blur-3xl" />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
