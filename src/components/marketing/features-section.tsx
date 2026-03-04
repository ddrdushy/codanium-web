'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import {
  Bot,
  Workflow,
  KanbanSquare,
  Scale,
  MessageSquare,
  BarChart3,
} from 'lucide-react';

const features = [
  {
    icon: Bot,
    title: '23 AI Agents',
    description:
      'From Business Analyst to QA Engineer, each agent has specialized skills and authority contracts.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
  },
  {
    icon: Workflow,
    title: 'SDLC Pipeline',
    description:
      '10-stage pipeline from Business Analysis to Monitoring with automated quality gates between stages.',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
  },
  {
    icon: KanbanSquare,
    title: 'Kanban Board',
    description:
      'AI-managed task board with 7 state columns. Agents pick up cards, report progress, and request reviews.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
  },
  {
    icon: Scale,
    title: 'Decision Engine',
    description:
      'Structured decision-making with options analysis, risk ratings, and human-in-the-loop approval.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/20',
  },
  {
    icon: MessageSquare,
    title: 'Real-time Chat',
    description:
      'Talk to any agent. See their reasoning. Approve actions. Code blocks, artifacts, and inline tools.',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/20',
  },
  {
    icon: BarChart3,
    title: 'KPI Dashboard',
    description:
      'Track delivery velocity, LLM costs, agent performance, and quality metrics in real time.',
    color: 'text-red-400',
    bg: 'bg-red-400/10',
    border: 'border-red-400/20',
  },
];

export function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="features" className="relative py-24 sm:py-32">
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
            Features
          </span>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            Everything Your Team Needs
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A complete AI-powered operating system for modern product delivery.
          </p>
        </motion.div>

        {/* Grid */}
        <div ref={ref} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{
                duration: 0.5,
                delay: i * 0.1,
                ease: 'easeOut' as const,
              }}
              className="group relative rounded-xl glass p-6 card-lift"
            >
              {/* Icon */}
              <div
                className={`mb-4 flex h-11 w-11 items-center justify-center rounded-lg ${feature.bg} border ${feature.border}`}
              >
                <feature.icon className={`h-5 w-5 ${feature.color}`} />
              </div>

              {/* Content */}
              <h3 className="text-lg font-bold text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {feature.description}
              </p>

              {/* Subtle hover glow */}
              <div
                className={`absolute inset-0 -z-10 rounded-xl opacity-0 transition-opacity group-hover:opacity-100 blur-2xl ${feature.bg}`}
              />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
