'use client';

import { motion } from 'framer-motion';

const logos = [
  { name: 'TechFlow', weight: '700', tracking: 'tracking-tight' },
  { name: 'NovaSoft', weight: '300', tracking: 'tracking-widest' },
  { name: 'QuantumAI', weight: '800', tracking: 'tracking-tight' },
  { name: 'Meridian', weight: '400', tracking: 'tracking-[0.2em]' },
  { name: 'Apex Systems', weight: '600', tracking: 'tracking-wide' },
  { name: 'CloudForge', weight: '900', tracking: 'tracking-tight' },
];

const fontWeightMap: Record<string, string> = {
  '300': 'font-light',
  '400': 'font-normal',
  '600': 'font-semibold',
  '700': 'font-bold',
  '800': 'font-extrabold',
  '900': 'font-black',
};

export function LogosSection() {
  return (
    <section className="relative border-y border-border bg-[var(--surface)] py-14">
      <div className="mx-auto max-w-7xl px-6">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center text-sm font-medium text-muted-foreground uppercase tracking-widest"
        >
          Trusted by founders and businesses
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6"
        >
          {logos.map((logo, i) => (
            <motion.div
              key={logo.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: 0.1 + i * 0.08 }}
            >
              <svg
                viewBox="0 0 180 40"
                className="h-8 w-auto opacity-30 transition-opacity hover:opacity-50"
              >
                <text
                  x="90"
                  y="28"
                  textAnchor="middle"
                  fill="currentColor"
                  className={`${fontWeightMap[logo.weight] || 'font-normal'} text-muted-foreground`}
                  style={{
                    fontSize: logo.name.length > 10 ? '16px' : '20px',
                    fontWeight: logo.weight,
                    letterSpacing: logo.tracking.includes('widest')
                      ? '0.1em'
                      : logo.tracking.includes('wide')
                        ? '0.05em'
                        : logo.tracking.includes('0.2em')
                          ? '0.2em'
                          : '-0.01em',
                    fontFamily: 'system-ui, -apple-system, sans-serif',
                  }}
                >
                  {logo.name}
                </text>
              </svg>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
