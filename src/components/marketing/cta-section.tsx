'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CTASection() {
  return (
    <section className="relative py-24 sm:py-32 overflow-hidden">
      {/* Gradient background */}
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
  );
}
