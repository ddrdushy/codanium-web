'use client';

import { motion } from 'framer-motion';
import {
  Globe,
  Code2,
  Cpu,
  Heart,
  Briefcase,
  ArrowRight,
  Sparkles,
  MapPin,
  Clock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: 'easeOut' as const },
  }),
};

const benefits = [
  {
    icon: Globe,
    title: 'Remote-First',
    description:
      'Work from anywhere in the world. We care about what you ship, not where you sit. Flexible hours, async communication, zero commute.',
  },
  {
    icon: Code2,
    title: 'Open Source DNA',
    description:
      'Contribute to tools the community actually uses. Your code ships to thousands of developers and you get credit for it.',
  },
  {
    icon: Cpu,
    title: 'Cutting-Edge AI',
    description:
      'Work with multi-agent orchestration, LLM pipelines, and autonomous software delivery systems that are genuinely novel.',
  },
  {
    icon: Heart,
    title: 'Real Impact',
    description:
      'Democratize software creation for people who could never code before. Every feature you build gives someone a new superpower.',
  },
];

const positions = [
  {
    title: 'Full Stack Engineer',
    department: 'Engineering',
    type: 'Full-time',
    location: 'Remote',
    description:
      'Build and scale our Next.js platform, design APIs, and integrate LLM pipelines into a seamless product experience. You will own features end-to-end.',
  },
  {
    title: 'AI / ML Engineer',
    department: 'AI Research',
    type: 'Full-time',
    location: 'Remote',
    description:
      'Design and optimize our multi-agent orchestration engine. Work on prompt engineering, model evaluation, context management, and autonomous agent workflows.',
  },
  {
    title: 'Developer Relations',
    department: 'Community',
    type: 'Full-time',
    location: 'Remote',
    description:
      'Be the bridge between Codanium and the developer community. Create tutorials, speak at events, and champion the builder experience.',
  },
  {
    title: 'Product Designer',
    department: 'Design',
    type: 'Full-time',
    location: 'Remote',
    description:
      'Craft intuitive interfaces for complex AI workflows. From wireframes to production UI, you will define how people interact with autonomous agents.',
  },
];

export default function CareersPage() {
  return (
    <>
      {/* ─── Hero ─── */}
      <section className="relative overflow-hidden pt-32 pb-16 sm:pt-40 sm:pb-20">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5" />
        <div className="grid-pattern absolute inset-0" />

        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <motion.span
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="inline-flex items-center gap-2 rounded-full border border-amber/20 bg-amber/5 px-4 py-1.5 text-sm font-medium text-amber"
          >
            <Briefcase className="h-3.5 w-3.5" />
            We&apos;re Hiring
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
          >
            Join the Future of{' '}
            <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
              Software Development
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
          >
            Help us build a world where anyone can turn an idea into production
            software. No gatekeeping, no boilerplate, no limits.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="mt-8"
          >
            <a href="#positions">
              <Button
                size="lg"
                className="bg-amber text-background hover:bg-amber/90 font-semibold text-base px-10 h-12 glow-amber"
              >
                View Open Roles
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </a>
          </motion.div>
        </div>
      </section>

      {/* ─── Why Codanium ─── */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-amber">
              Why Codanium
            </p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Build something that{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                matters
              </span>
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              We&apos;re a small, focused team tackling one of the hardest problems
              in software: making development accessible to everyone through AI.
            </p>
          </motion.div>

          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map((benefit, i) => (
              <motion.div
                key={benefit.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="group rounded-xl border border-border bg-[var(--surface)] p-7 transition-all hover:border-amber/40 hover:shadow-lg hover:shadow-amber/5 card-lift"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber/10 border border-amber/20 text-amber">
                  <benefit.icon className="h-6 w-6" />
                </div>
                <h3 className="mt-5 text-lg font-bold text-foreground">
                  {benefit.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {benefit.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Open Positions ─── */}
      <section id="positions" className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <p className="text-sm font-semibold uppercase tracking-widest text-amber">
              Open Positions
            </p>
            <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Find your role
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Every role is remote-first. We value async communication, deep work,
              and shipping things that make a real difference.
            </p>
          </motion.div>

          <div className="mx-auto mt-16 max-w-3xl space-y-5">
            {positions.map((role, i) => (
              <motion.div
                key={role.title}
                custom={i}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                className="group rounded-xl border border-border bg-[var(--surface)] p-6 sm:p-8 transition-all hover:border-amber/40 hover:shadow-lg hover:shadow-amber/5 card-lift"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-bold text-foreground group-hover:text-amber transition-colors">
                      {role.title}
                    </h3>

                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-1.5">
                        <Briefcase className="h-3.5 w-3.5" />
                        {role.department}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        {role.type}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {role.location}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {role.description}
                    </p>
                  </div>

                  <div className="shrink-0 sm:mt-0">
                    <Button className="bg-amber text-background hover:bg-amber/90 font-semibold px-6">
                      Apply
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-[var(--surface)]" />

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="space-y-6"
          >
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10 border border-amber/20">
              <Sparkles className="h-7 w-7 text-amber" />
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
              Don&apos;t see your role?
            </h2>

            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              We&apos;re always looking for exceptional people. Send us your story
              and we&apos;ll find the right fit.
            </p>

            <div className="flex flex-col items-center gap-4 pt-2">
              <a href="mailto:hello@codanium.com">
                <Button
                  size="lg"
                  className="bg-amber text-background hover:bg-amber/90 font-semibold text-base px-10 h-13 glow-amber"
                >
                  Reach Out
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </a>
              <p className="text-sm text-muted-foreground">
                hello@codanium.com
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
