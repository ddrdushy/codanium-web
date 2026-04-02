'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, Zap, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const benefits = [
  'No credit card required',
  'No coding skills needed',
  'Free tier available',
  'Cancel anytime',
];

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
              Ready to Bring Your{' '}
              <span className="bg-gradient-to-r from-amber-400 via-amber-500 to-orange-500 bg-clip-text text-transparent">
                Idea to Life
              </span>
              ?
            </h2>

            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              Describe what you want built and let our AI team handle the rest.
              Your first project takes under 2 minutes to start.
            </p>

            <div className="flex flex-col items-center gap-5 pt-4">
              <Link href="https://app.codanium.com/signup">
                <Button
                  size="lg"
                  className="bg-amber text-background hover:bg-amber/90 font-semibold text-base px-10 h-14 glow-amber group"
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  Start Your Project Free
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </Button>
              </Link>

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
