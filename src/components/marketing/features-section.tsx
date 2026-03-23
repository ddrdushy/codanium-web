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
    title: 'A Full AI Team',
    description:
      '23 specialists — from requirements analyst to quality tester — work around the clock to build your software.',
    color: 'text-emerald-400',
    bg: 'bg-emerald-400/10',
    border: 'border-emerald-400/20',
  },
  {
    icon: Workflow,
    title: 'End-to-End Delivery',
    description:
      'Your project moves through 8 phases from idea to launch, with quality checks at every step.',
    color: 'text-amber-400',
    bg: 'bg-amber-400/10',
    border: 'border-amber-400/20',
  },
  {
    icon: KanbanSquare,
    title: 'Live Progress Tracking',
    description:
      'See exactly what your AI team is working on, what\'s done, and what needs your attention — all in real time.',
    color: 'text-blue-400',
    bg: 'bg-blue-400/10',
    border: 'border-blue-400/20',
  },
  {
    icon: Scale,
    title: 'You Stay In Control',
    description:
      'When a key choice needs to be made, your AI team presents clear options with recommendations. You approve.',
    color: 'text-purple-400',
    bg: 'bg-purple-400/10',
    border: 'border-purple-400/20',
  },
  {
    icon: MessageSquare,
    title: 'Talk To Your AI Team',
    description:
      'Ask questions, give feedback, or request changes. Your AI team responds instantly and explains their thinking.',
    color: 'text-rose-400',
    bg: 'bg-rose-400/10',
    border: 'border-rose-400/20',
  },
  {
    icon: BarChart3,
    title: 'Budget & Progress Dashboard',
    description:
      'Track how your project is progressing, what it\'s costing, and when it\'ll be ready — all in one place.',
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
            Everything Handled For You
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            From your first idea to a working product — our AI team manages every step.
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
