'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bot,
  Code2,
  Eye,
  Github,
  Heart,
  Lightbulb,
  Milestone,
  Rocket,
  Shield,
  Sparkles,
  Target,
  Users,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const values = [
  {
    icon: Lightbulb,
    title: 'Idea-First Development',
    description:
      'We believe great software starts with a vision, not a spec. Describe what you need in plain language and our AI team translates it into reality.',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
  },
  {
    icon: Users,
    title: 'Accessible to Everyone',
    description:
      'No coding experience required. Codanium puts the power of a full software team in the hands of anyone with an idea worth building.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
  },
  {
    icon: Shield,
    title: 'Quality Without Compromise',
    description:
      'Every deliverable passes through automated quality gates — from architecture review to security testing — before reaching you.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
  },
  {
    icon: Eye,
    title: 'Radical Transparency',
    description:
      'Watch your project take shape in real time. Every decision, every line of code, every test result is visible and explained in plain English.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/20',
  },
];

const agents = [
  { role: 'Project Manager', icon: Target, desc: 'Orchestrates the entire delivery pipeline' },
  { role: 'Business Analyst', icon: Lightbulb, desc: 'Turns your idea into detailed requirements' },
  { role: 'Solutions Architect', icon: Code2, desc: 'Designs scalable system architecture' },
  { role: 'UX Designer', icon: Heart, desc: 'Crafts intuitive user experiences' },
  { role: 'Senior Developer', icon: Zap, desc: 'Writes production-grade code' },
  { role: 'QA Engineer', icon: Shield, desc: 'Ensures everything works flawlessly' },
];

const milestones = [
  {
    date: '2024',
    title: 'The Spark',
    description:
      'AiSensei envisions a world where anyone can ship professional software without writing a single line of code.',
  },
  {
    date: 'Early 2025',
    title: 'Platform Foundation',
    description:
      'Core architecture established. 23 specialized AI agents designed and integrated into a cohesive delivery pipeline.',
  },
  {
    date: 'Mid 2025',
    title: 'Open Source Launch',
    description:
      'Codanium goes open source on GitHub, inviting the community to shape the future of AI-driven development.',
  },
  {
    date: 'Late 2025',
    title: 'Desktop App & Multi-Platform',
    description:
      'Codanium Desktop ships for Mac, Windows, and Linux — bringing AI software delivery to the native experience.',
  },
  {
    date: '2026',
    title: 'Scale & Community',
    description:
      'Growing community of builders, expanded agent capabilities, and enterprise features for teams of all sizes.',
  },
];

/* ------------------------------------------------------------------ */
/*  Animation helpers                                                  */
/* ------------------------------------------------------------------ */

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const staggerContainer = {
  whileInView: { transition: { staggerChildren: 0.1 } },
  viewport: { once: true },
};

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function AboutPage() {
  return (
    <>
      {/* ============================================================ */}
      {/*  HERO                                                         */}
      {/* ============================================================ */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        {/* Background effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-amber-500/5 blur-3xl" />

        <div className="relative mx-auto max-w-7xl px-6 text-center">
          <motion.div {...fadeUp} className="space-y-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10 border border-amber/20">
              <Sparkles className="h-7 w-7 text-amber" />
            </div>

            <h1 className="text-5xl font-extrabold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
              Building the Future of{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Software Delivery
              </span>
            </h1>

            <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl leading-relaxed">
              Codanium puts a full AI software team at your fingertips. Describe your vision,
              and 23 specialized agents handle everything from requirements to deployment.
              No code required.
            </p>

            <p className="text-sm font-medium tracking-widest uppercase text-amber-500">
              Your Vibe, Multiplied
            </p>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  MISSION                                                      */}
      {/* ============================================================ */}
      <section className="py-24 sm:py-32 bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-16 lg:grid-cols-2 lg:items-center">
            <motion.div {...fadeUp} className="space-y-6">
              <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
                Our{' '}
                <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                  Mission
                </span>
              </h2>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We started Codanium because we saw a gap that kept growing: the world is full of
                people with brilliant ideas but no way to build them. Hiring a dev team is expensive.
                Learning to code takes years. No-code tools hit a wall fast.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                We asked a simple question: <span className="text-foreground font-semibold">
                What if AI could be the team?</span> Not just a copilot that suggests code, but a
                full delivery organization — a project manager, architect, designer, developer,
                tester, and DevOps engineer — all working together, around the clock, for a fraction
                of the cost.
              </p>
              <p className="text-lg text-muted-foreground leading-relaxed">
                That question became Codanium.
              </p>
            </motion.div>

            <motion.div
              {...fadeUp}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="glass rounded-2xl p-8 card-lift"
            >
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20">
                    <Rocket className="h-5 w-5 text-amber-400" />
                  </div>
                  <h3 className="text-xl font-bold text-foreground">Founded by AiSensei</h3>
                </div>
                <p className="text-muted-foreground leading-relaxed">
                  Codanium was founded by AiSensei with a singular belief: AI should not just
                  assist developers — it should empower everyone to become a builder. By
                  orchestrating 23 specialized AI agents into a seamless delivery pipeline,
                  Codanium transforms the way software gets made.
                </p>
                <div className="flex items-center gap-4 pt-2">
                  <Link
                    href="https://github.com/AiSenseiMY/Ai-Team_studio"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-sm font-medium text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    <Github className="h-4 w-4" />
                    Open Source on GitHub
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  VALUES                                                       */}
      {/* ============================================================ */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div {...fadeUp} className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              What We{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Believe In
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              Our values shape every agent, every pipeline stage, and every decision Codanium makes on your behalf.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {values.map((value, i) => (
              <motion.div
                key={value.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass rounded-2xl p-6 card-lift group"
              >
                <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${value.bg} border ${value.border} mb-4 transition-transform group-hover:scale-110`}>
                  <value.icon className={`h-6 w-6 ${value.color}`} />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{value.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{value.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  AI TEAM                                                      */}
      {/* ============================================================ */}
      <section className="py-24 sm:py-32 bg-[var(--surface)]">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div {...fadeUp} className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Meet Your{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                AI Team
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              23 specialized AI agents work together like a world-class software team.
              Here are just a few of the roles they fill.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {agents.map((agent, i) => (
              <motion.div
                key={agent.role}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08 }}
                className="glass rounded-2xl p-6 card-lift group"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400/10 border border-amber-400/20 transition-transform group-hover:scale-110">
                    <agent.icon className="h-6 w-6 text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-foreground mb-1">{agent.role}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{agent.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div
            {...fadeUp}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="mt-12 text-center"
          >
            <p className="text-muted-foreground">
              <span className="font-semibold text-foreground">+ 17 more agents</span>{' '}
              covering UI design, security auditing, performance engineering, DevOps, and more.
            </p>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  TIMELINE                                                     */}
      {/* ============================================================ */}
      <section className="py-24 sm:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <motion.div {...fadeUp} className="text-center space-y-4 mb-16">
            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Our{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Journey
              </span>
            </h2>
            <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
              From a bold idea to an open-source platform powering AI-driven software delivery.
            </p>
          </motion.div>

          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/50 via-amber-500/20 to-transparent sm:left-1/2 sm:-translate-x-px" />

            <div className="space-y-12">
              {milestones.map((milestone, i) => (
                <motion.div
                  key={milestone.date}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 }}
                  className={`relative flex flex-col sm:flex-row ${
                    i % 2 === 0 ? 'sm:flex-row' : 'sm:flex-row-reverse'
                  } items-start sm:items-center gap-6 sm:gap-12`}
                >
                  {/* Dot */}
                  <div className="absolute left-4 sm:left-1/2 sm:-translate-x-1/2 h-3 w-3 rounded-full bg-amber-500 ring-4 ring-amber-500/20 z-10" />

                  {/* Content */}
                  <div className={`ml-12 sm:ml-0 sm:w-1/2 ${i % 2 === 0 ? 'sm:text-right sm:pr-12' : 'sm:text-left sm:pl-12'}`}>
                    <span className="inline-block text-sm font-semibold text-amber-400 mb-2">
                      {milestone.date}
                    </span>
                    <h3 className="text-xl font-bold text-foreground mb-2">{milestone.title}</h3>
                    <p className="text-muted-foreground leading-relaxed">{milestone.description}</p>
                  </div>

                  {/* Spacer for alternating layout */}
                  <div className="hidden sm:block sm:w-1/2" />
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  OPEN SOURCE                                                  */}
      {/* ============================================================ */}
      <section className="py-24 sm:py-32 bg-[var(--surface)]">
        <div className="mx-auto max-w-4xl px-6 text-center">
          <motion.div {...fadeUp} className="space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10 border border-amber/20">
              <Github className="h-7 w-7 text-amber" />
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Open Source,{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Open Future
              </span>
            </h2>

            <p className="mx-auto max-w-xl text-lg text-muted-foreground leading-relaxed">
              Codanium is fully open source. We believe the tools that shape how software is built
              should belong to everyone. Explore the code, contribute, or fork it and make it your own.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
              <Link
                href="https://github.com/AiSenseiMY/Ai-Team_studio"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="border-amber/30 text-foreground hover:bg-amber/10 font-semibold text-base px-8 h-13"
                >
                  <Github className="mr-2 h-5 w-5" />
                  View on GitHub
                </Button>
              </Link>
              <Link
                href="https://github.com/AiSenseiMY/Codanium"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="border-amber/30 text-foreground hover:bg-amber/10 font-semibold text-base px-8 h-13"
                >
                  <Bot className="mr-2 h-5 w-5" />
                  Desktop App Repo
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ============================================================ */}
      {/*  CTA                                                          */}
      {/* ============================================================ */}
      <section className="relative py-24 sm:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-[var(--surface)]" />

        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <motion.div {...fadeUp} className="space-y-6">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber/10 border border-amber/20">
              <Rocket className="h-7 w-7 text-amber" />
            </div>

            <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
              Ready to{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Build Something Great
              </span>
              ?
            </h2>

            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              Tell Codanium what you want to create. Our AI team takes it from there —
              requirements, architecture, code, tests, and deployment. All you bring is the idea.
            </p>

            <div className="flex flex-col items-center gap-4 pt-4">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-amber text-background hover:bg-amber/90 font-semibold text-base px-10 h-13 glow-amber"
                >
                  Start Your Project Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <p className="text-sm text-muted-foreground">
                No credit card required
              </p>
            </div>
          </motion.div>
        </div>
      </section>
    </>
  );
}
