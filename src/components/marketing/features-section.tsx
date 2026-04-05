'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import Image from 'next/image';
import { ShieldCheck, Eye, TerminalSquare } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export function FeaturesSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section id="features" className="relative py-32 bg-background">
      <div className="mx-auto max-w-7xl px-6" ref={ref}>
        {/* Global Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="max-w-3xl mb-24"
        >
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-5xl mb-6">
            Drive execution with faster decisions and complete transparency
          </h2>
          <p className="text-xl text-slate-400">
            Automate routine scaffolding, enforce robust architecture, and verify security protocols seamlessly.
          </p>
        </motion.div>

        {/* Feature 1: Progress Tracking (Left Text, Right Image) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-32">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="order-2 lg:order-1"
          >
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-2 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-blue-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Image 
                src="/marketing/progress-ui.png"
                alt="Quad-Layer Sign-offs Progress UI"
                width={800}
                height={600}
                className="rounded-xl border border-white/5 object-cover"
              />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="order-1 lg:order-2 space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm font-medium text-emerald-400 mb-2">
              <Eye className="h-4 w-4" /> Quad-Layer Validation
            </div>
            <h3 className="text-3xl font-bold text-white tracking-tight">Ship faster with fewer regressions</h3>
            <p className="text-lg text-slate-400 leading-relaxed">
              Every feature code branch passes through an automated quad-layer sign-off system. QA, Security, DevOps, and Platform Engineering agents audit the work concurrently before it reaches human stakeholders.
            </p>
            <div className="pt-4">
              <Link href="/platform">
                <Button variant="link" className="text-blue-400 hover:text-blue-300 p-0 text-base h-auto font-semibold">
                  See how Sign-offs work <span className="ml-2">→</span>
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>

        {/* Feature 2: Architecture Diagram (Left Image, Right Text... wait, reverse it: Left Text, Right Image usually alternates, but let's do Left Text, Right Image since the first was Left Image) */}
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-sm font-medium text-purple-400 mb-2">
              <ShieldCheck className="h-4 w-4" /> Enterprise SDD
            </div>
            <h3 className="text-3xl font-bold text-white tracking-tight">Interactive Systems Engineering</h3>
            <p className="text-lg text-slate-400 leading-relaxed">
              Generate full System Design Documents (SDD) automatically. Your AI architect plans out database models, infra layout, and microservices logic with real-time optimization recommendations.
            </p>
            <ul className="space-y-4 pt-4 text-slate-300">
              <li className="flex items-center gap-3">
                <TerminalSquare className="h-5 w-5 text-purple-400" />
                <span>Automated Redis/Postgres modeling</span>
              </li>
              <li className="flex items-center gap-3">
                <TerminalSquare className="h-5 w-5 text-purple-400" />
                <span>Instant infra cost & latency estimates</span>
              </li>
            </ul>
            <div className="pt-4">
              <Link href="/architecture">
                <Button variant="link" className="text-blue-400 hover:text-blue-300 p-0 text-base h-auto font-semibold">
                  Explore AI Architecture <span className="ml-2">→</span>
                </Button>
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: '-100px' }}
          >
            <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-2 shadow-2xl relative overflow-hidden group">
              <div className="absolute inset-0 bg-purple-500/10 blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
              <Image 
                src="/marketing/architecture-ui.png"
                alt="System Design Architecture Diagram"
                width={800}
                height={600}
                className="rounded-xl border border-white/5 object-cover"
              />
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
