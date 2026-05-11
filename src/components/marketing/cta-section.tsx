'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, CheckCircle2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

const benefits = [
  'MIT-licensed, free forever',
  'Bring your own LLM keys',
  'Self-host on your infra',
  'No credit card required',
];

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export function CTASection() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Gradient backgrounds */}
      <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-purple-500/5" />
      <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-[var(--surface)]" />

      {/* Animated orbs */}
      <div className="absolute top-1/3 left-1/6 h-64 w-64 rounded-full bg-amber/8 blur-[100px] animate-float" />
      <div className="absolute bottom-1/3 right-1/6 h-48 w-48 rounded-full bg-purple-500/8 blur-[80px] animate-float-slow" />

      <div className="relative mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative rounded-3xl border border-amber/20 bg-gradient-to-br from-amber/5 via-[var(--surface)] to-purple-500/5 p-10 sm:p-16 text-center overflow-hidden"
        >
          {/* Inner glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 h-px w-1/2 bg-gradient-to-r from-transparent via-amber/40 to-transparent" />

          <div className="relative space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-lg shadow-amber/25">
              <Zap className="h-8 w-8 text-white" />
            </div>

            <h2 className="text-4xl font-extrabold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
              Build with your{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                AI dev team
              </span>
              .
            </h2>

            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              Try the hosted version, or clone the repos and run the whole platform on your own infra. MIT licensed, no lock-in, your keys.
            </p>

            <div className="flex flex-col items-center gap-5 pt-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/signup">
                  <Button
                    size="lg"
                    className="bg-amber text-background hover:bg-amber/90 font-semibold text-base px-8 h-14 glow-amber group"
                  >
                    <Sparkles className="mr-2 h-5 w-5" />
                    Try Hosted
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                  </Button>
                </Link>
                <a href="https://github.com/ddrdushy/codanium" target="_blank" rel="noopener noreferrer">
                  <Button
                    size="lg"
                    variant="outline"
                    className="font-semibold text-base px-8 h-14 group"
                  >
                    <GitHubIcon className="mr-2 h-5 w-5" />
                    Star on GitHub
                    <Star className="ml-2 h-3.5 w-3.5 text-amber-400" />
                  </Button>
                </a>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
                {benefits.map((benefit) => (
                  <span key={benefit} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    {benefit}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
