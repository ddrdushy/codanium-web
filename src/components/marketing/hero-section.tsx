'use client';

import Link from 'next/link';
import { ArrowRight, Star, Key, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Image from 'next/image';

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-screen overflow-hidden pt-32 pb-20 bg-background flex flex-col items-center justify-center">
      {/* Sleek, deep background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900/40 via-background to-background" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-[1000px] h-[500px] bg-blue-500/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 w-full z-10 flex flex-col items-center text-center">
        {/* OSS badge */}
        <div className="animate-fade-in opacity-0" style={{ animationFillMode: 'forwards' }}>
          <a
            href="https://github.com/ddrdushy/codanium"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 mb-8 uppercase tracking-wider hover:bg-blue-500/15 transition-colors"
          >
            <Zap className="h-3.5 w-3.5" />
            Open Source · MIT Licensed
          </a>
        </div>

        {/* Main heading */}
        <h1 className="max-w-4xl animate-fade-in opacity-0 [animation-delay:150ms] text-5xl font-bold leading-[1.1] tracking-tight text-white sm:text-6xl lg:text-7xl" style={{ animationFillMode: 'forwards' }}>
          Your AI dev team. Open source.
        </h1>

        {/* Subheading */}
        <p className="mt-8 max-w-2xl mx-auto text-lg leading-relaxed text-slate-400 animate-fade-in opacity-0 [animation-delay:300ms]" style={{ animationFillMode: 'forwards' }}>
          23+ specialized AI agents that take your idea through requirements, architecture, coding, testing, and deployment. Bring your own LLM keys — OpenAI, Anthropic, Ollama, or any compatible provider. Self-host it, fork it, run it however you want.
        </p>

        {/* CTA buttons */}
        <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 animate-fade-in opacity-0 [animation-delay:450ms]" style={{ animationFillMode: 'forwards' }}>
          <Link href="/signup">
            <Button
              size="lg"
              className="bg-blue-600 text-white hover:bg-blue-700 font-semibold text-base px-8 h-14 rounded-md transition-all hover:shadow-[0_0_20px_rgba(37,99,235,0.4)]"
            >
              Start orchestrating
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="https://github.com/ddrdushy/codanium" target="_blank" rel="noopener noreferrer">
            <Button
              variant="outline"
              size="lg"
              className="font-semibold text-base h-14 px-8 rounded-md border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white gap-2"
            >
              <GitHubIcon className="h-4 w-4" />
              Star on GitHub
              <Star className="h-3.5 w-3.5 text-amber-400" />
            </Button>
          </a>
        </div>

        {/* Trust indicators */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-8 text-sm text-slate-500 font-medium animate-fade-in opacity-0 [animation-delay:600ms]" style={{ animationFillMode: 'forwards' }}>
          <span className="flex items-center gap-2">
            <Key className="h-4 w-4 text-slate-400" />
            Bring your own LLM keys
          </span>
          <span className="flex items-center gap-2">
            <GitHubIcon className="h-4 w-4 text-slate-400" />
            Self-host on your infra
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
