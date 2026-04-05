'use client';

import Link from 'next/link';
import { ArrowRight, Shield, Activity, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

export function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden pt-32 pb-20 bg-background flex flex-col items-center justify-center">
      {/* Sleek, deep background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-background to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 w-full z-10 flex flex-col items-center text-center">
        {/* SafetyKit style badge */}
        <div className="animate-fade-in opacity-0" style={{ animationFillMode: 'forwards' }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 mb-8 uppercase tracking-wider">
            <Zap className="h-3.5 w-3.5" />
            Agentic SDLC Orchestration
          </span>
        </div>

        {/* Main heading */}
        <h1 className="max-w-4xl animate-fade-in opacity-0 [animation-delay:150ms] text-5xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl" style={{ animationFillMode: 'forwards' }}>
          Deploy AI agents to automate your software lifecycle.
        </h1>

        {/* Subheading */}
        <p className="mt-8 max-w-2xl mx-auto text-lg leading-relaxed text-slate-400 animate-fade-in opacity-0 [animation-delay:300ms]" style={{ animationFillMode: 'forwards' }}>
          Orchestrate a team of 23+ specialized AI agents for requirements, architecture, coding, and testing. Trusted by forward-thinking engineering teams to increase velocity and reduce regressions.
        </p>

        {/* CTA buttons */}
        <div className="mt-10 flex items-center justify-center gap-6 animate-fade-in opacity-0 [animation-delay:450ms]" style={{ animationFillMode: 'forwards' }}>
          <Link href="/signup">
            <Button
              size="lg"
              className="bg-blue-600 text-white hover:bg-blue-700 font-semibold text-base px-8 h-14 rounded-md transition-all hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]"
            >
              Start orchestrating
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <Link href="/contact">
            <Button
              variant="outline"
              size="lg"
              className="font-semibold text-base h-14 px-8 rounded-md border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Contact Sales
            </Button>
          </Link>
        </div>

        {/* Trust indicators */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-500 font-medium animate-fade-in opacity-0 [animation-delay:600ms]" style={{ animationFillMode: 'forwards' }}>
          <span className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-slate-400" />
            Enterprise-grade security
          </span>
          <span className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-slate-400" />
            Automated quality gates
          </span>
        </div>

        {/* The Hero Mockup Image */}
        <div className="mt-20 relative w-full max-w-[1200px] animate-fade-up opacity-0 [animation-delay:750ms]" style={{ animationFillMode: 'forwards' }}>
          <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-2 shadow-2xl backdrop-blur-xl">
            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-lg border border-slate-800 ring-1 ring-white/10">
              <Image
                src="/marketing/hero-dashboard.png"
                alt="Codanium Agent Dashboard"
                fill
                className="object-cover object-top"
                priority
                unoptimized
              />
            </div>
          </div>
          
          {/* Subtle backglow for the image */}
          <div className="absolute -inset-4 -z-10 bg-gradient-to-b from-blue-500/20 to-transparent blur-2xl rounded-[3rem] opacity-50" />
        </div>
      </div>
    </section>
  );
}
