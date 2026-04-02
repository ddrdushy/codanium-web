'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { FolderPlus, Bot, Scale, Rocket, ArrowRight } from 'lucide-react';

const steps = [
  {
    number: 1,
    icon: FolderPlus,
    title: 'Describe Your Idea',
    description:
      'Tell us what you want built. It can be a rough idea, a detailed brief, or anything in between.',
    color: 'from-blue-500 to-cyan-500',
    iconColor: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    number: 2,
    icon: Bot,
    title: 'AI Team Gets to Work',
    description:
      'Our AI analysts clarify your requirements, architects design the solution, and developers start building.',
    color: 'from-emerald-500 to-teal-500',
    iconColor: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
  },
  {
    number: 3,
    icon: Scale,
    title: 'Review & Approve',
    description:
      'Your AI team presents key decisions with clear recommendations. You approve what matters to you.',
    color: 'from-purple-500 to-violet-500',
    iconColor: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    number: 4,
    icon: Rocket,
    title: 'Launch Your Product',
    description:
      'Your software is tested, reviewed, and deployed. Quality checks at every step ensure it works right.',
    color: 'from-amber-500 to-orange-500',
    iconColor: 'text-amber-400',
    bg: 'bg-amber-500/10',
  },
];

export function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <section
      id="how-it-works"
      className="relative py-24 sm:py-32 bg-[var(--surface)]"
    >
      <div className="mx-auto max-w-7xl px-6">
        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center mb-20"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-amber/20 bg-amber/5 px-4 py-1.5 text-sm font-medium text-amber">
            How It Works
          </span>
          <h2 className="mt-6 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            From Idea to Launch in{' '}
            <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
              4 Steps
            </span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No coding skills needed. No technical knowledge required. Just tell us your vision.
          </p>
        </motion.div>

        {/* Steps */}
        <div ref={ref} className="relative">
          {/* Desktop: Horizontal layout */}
          <div className="hidden lg:grid lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.15,
                  ease: 'easeOut' as const,
                }}
                className="relative"
              >
                {/* Connector arrow */}
                {i < steps.length - 1 && (
                  <div className="absolute top-14 -right-3 z-10">
                    <ArrowRight className="h-5 w-5 text-border" />
                  </div>
                )}

                <div className="flex flex-col items-center text-center">
                  {/* Number + Icon */}
                  <div className="relative mb-6">
                    <div className={`flex h-28 w-28 items-center justify-center rounded-2xl border border-border bg-[var(--surface-raised)] shadow-lg`}>
                      <div className={`flex h-16 w-16 items-center justify-center rounded-xl ${step.bg}`}>
                        <step.icon className={`h-8 w-8 ${step.iconColor}`} />
                      </div>
                    </div>
                    <div className={`absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br ${step.color} text-sm font-bold text-white shadow-lg`}>
                      {step.number}
                    </div>
                  </div>

                  {/* Text */}
                  <h3 className="text-lg font-bold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground max-w-[260px]">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Mobile: Vertical timeline */}
          <div className="lg:hidden space-y-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -20 }}
                animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.12,
                  ease: 'easeOut' as const,
                }}
                className="flex gap-5"
              >
                {/* Timeline line + number */}
                <div className="flex flex-col items-center">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${step.color} text-lg font-bold text-white shadow-lg`}>
                    {step.number}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px flex-1 bg-border mt-3" />
                  )}
                </div>

                {/* Content */}
                <div className="pb-8">
                  <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${step.bg}`}>
                    <step.icon className={`h-5 w-5 ${step.iconColor}`} />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-1">
                    {step.title}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
