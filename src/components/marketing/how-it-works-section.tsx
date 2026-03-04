'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { FolderPlus, Bot, Scale, Rocket } from 'lucide-react';

const steps = [
  {
    number: 1,
    icon: FolderPlus,
    title: 'Define Your Product',
    description:
      'Create a project, upload requirements, and set your SDLC preferences.',
  },
  {
    number: 2,
    icon: Bot,
    title: 'Agents Activate',
    description:
      '23 AI agents self-organize into squads. BA writes the BRD, Architect designs the system.',
  },
  {
    number: 3,
    icon: Scale,
    title: 'Review & Decide',
    description:
      'Agents surface decisions for your approval. You stay in control of every critical choice.',
  },
  {
    number: 4,
    icon: Rocket,
    title: 'Ship with Confidence',
    description:
      'Automated testing, code review, and deployment. Quality gates ensure nothing ships broken.',
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
          <span className="text-sm font-semibold uppercase tracking-widest text-amber">
            How It Works
          </span>
          <h2 className="mt-3 text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl">
            From Idea to Production in 4 Steps
          </h2>
        </motion.div>

        {/* Steps */}
        <div ref={ref} className="relative">
          {/* Horizontal connector line — desktop only */}
          <div className="absolute left-0 right-0 top-[52px] hidden lg:block">
            <div className="mx-auto max-w-4xl px-16">
              <div className="h-[2px] w-full border-t-2 border-dashed border-border" />
            </div>
          </div>

          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, i) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -30 }}
                animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.15,
                  ease: 'easeOut',
                }}
                className="relative flex flex-col items-center text-center"
              >
                {/* Numbered circle with icon */}
                <div className="relative z-10 mb-6">
                  <div className="flex h-[104px] w-[104px] items-center justify-center rounded-full border-2 border-amber/20 bg-[var(--surface-raised)]">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber/10">
                      <step.icon className="h-7 w-7 text-amber" />
                    </div>
                  </div>
                  {/* Step number badge */}
                  <div className="absolute -top-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-amber text-xs font-bold text-background">
                    {step.number}
                  </div>
                </div>

                {/* Text */}
                <h3 className="text-lg font-bold text-foreground mb-2">
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground max-w-[240px]">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
