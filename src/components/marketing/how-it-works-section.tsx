'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { Network, Search, Database, Layers, CheckCircle2, Lock, Cpu, Cloud, Smartphone, Monitor } from 'lucide-react';

const coverageItems = [
  { icon: Monitor, title: 'Frontend Implementation', desc: 'React, Next.js, and modern UI toolkits.' },
  { icon: Database, title: 'Backend & DB Design', desc: 'PostgreSQL, Node, Python, and Redis grids.' },
  { icon: Lock, title: 'Security Audits', desc: 'OWASP checks, sanitization, and dependency scanning.' },
  { icon: Cloud, title: 'Cloud Provisioning', desc: 'Docker, AWS configs, and CI/CD setup.' },
  { icon: Smartphone, title: 'Mobile Readiness', desc: 'Responsive web and native wrappers.' },
  { icon: Cpu, title: 'Agentic Orchestration', desc: 'BullMQ and distributed Redis workers.' },
  { icon: Network, title: 'Network Scaling', desc: 'Load balancing setup and scale-out plans.' },
  { icon: Search, title: 'Automated Testing', desc: 'Jest, Playwright, and Cypress E2E pipelines.' }
];

export function HowItWorksSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section className="py-24 bg-slate-950 border-t border-slate-900">
      <div className="mx-auto max-w-7xl px-6" ref={ref}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.5 }}
          className="mb-16 max-w-2xl"
        >
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl mb-4">
            Comprehensive engineering coverage from day one.
          </h2>
          <p className="text-lg text-slate-400">
            No matter the complexity of your platform, our specialized AI agents cover all disciplines out of the box.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {coverageItems.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="p-6 rounded-xl border border-slate-800 bg-slate-900/40 hover:bg-slate-800/60 transition-colors group"
            >
              <item.icon className="h-6 w-6 text-blue-500 mb-4 group-hover:text-blue-400 transition-colors" />
              <h3 className="text-sm font-bold text-white mb-2">{item.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
