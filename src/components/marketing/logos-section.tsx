'use client';

import { motion } from 'framer-motion';

const logos = [
  { name: 'TechFlow', weight: '700' },
  { name: 'NovaSoft', weight: '300' },
  { name: 'QuantumAI', weight: '800' },
  { name: 'Meridian', weight: '400' },
  { name: 'Apex Systems', weight: '600' },
  { name: 'CloudForge', weight: '900' },
  { name: 'DataPulse', weight: '700' },
  { name: 'SkyLab', weight: '500' },
];

export function LogosSection() {
  return (
    <section className="relative border-y border-border bg-[var(--surface)] py-12 overflow-hidden">
      <div className="mx-auto max-w-7xl px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8 text-center text-xs font-semibold text-muted-foreground uppercase tracking-[0.2em]"
        >
          Trusted by innovative teams worldwide
        </motion.p>

        {/* Scrolling logo strip */}
        <div className="relative">
          {/* Fade edges */}
          <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-[var(--surface)] to-transparent z-10" />
          <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-[var(--surface)] to-transparent z-10" />

          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center gap-x-16 gap-y-4 flex-wrap"
          >
            {logos.map((logo, i) => (
              <motion.span
                key={logo.name}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.06 }}
                className="text-lg sm:text-xl text-muted-foreground/30 hover:text-muted-foreground/50 transition-colors cursor-default select-none"
                style={{
                  fontWeight: Number(logo.weight),
                  fontFamily: 'system-ui, -apple-system, sans-serif',
                  letterSpacing: Number(logo.weight) >= 700 ? '-0.02em' : '0.05em',
                }}
              >
                {logo.name}
              </motion.span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
