'use client';

import { motion } from 'framer-motion';
import { Zap, Bot, Kanban, Scale, GitBranch, BarChart3 } from 'lucide-react';

const floatingCards = [
  { icon: Bot, label: '23 AI Agents', color: '#10b981', x: 20, y: 15, delay: 0 },
  { icon: Kanban, label: 'Smart Board', color: '#3b82f6', x: 60, y: 25, delay: 0.2 },
  { icon: Scale, label: 'Decisions', color: '#f59e0b', x: 35, y: 55, delay: 0.4 },
  { icon: GitBranch, label: 'Git Ops', color: '#8b5cf6', x: 65, y: 65, delay: 0.6 },
  { icon: BarChart3, label: 'Analytics', color: '#ef4444', x: 15, y: 75, delay: 0.8 },
];

export function AuthIllustration() {
  return (
    <div className="relative w-full h-full overflow-hidden bg-gradient-to-br from-amber/[0.03] via-background to-blue-500/[0.03]">
      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `linear-gradient(rgba(245,158,11,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,0.05) 1px, transparent 1px)`,
          backgroundSize: '40px 40px',
        }}
      />

      {/* Central glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-amber/[0.08] blur-[100px]" />

      {/* Large logo */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
      >
        <div className="w-20 h-20 rounded-2xl bg-amber/10 border border-amber/20 flex items-center justify-center shadow-xl shadow-amber/5">
          <Zap className="w-10 h-10 text-amber" />
        </div>
      </motion.div>

      {/* Floating cards */}
      {floatingCards.map((card, i) => {
        const Icon = card.icon;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + card.delay, duration: 0.5 }}
            className="absolute"
            style={{ left: `${card.x}%`, top: `${card.y}%`, transform: 'translate(-50%, -50%)' }}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut' as const }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--surface)]/80 backdrop-blur-sm border border-border shadow-lg"
            >
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: card.color + '15' }}
              >
                <Icon className="w-3.5 h-3.5" style={{ color: card.color }} />
              </div>
              <span className="text-xs font-medium text-foreground/80 whitespace-nowrap">{card.label}</span>
            </motion.div>
          </motion.div>
        );
      })}

      {/* Connection lines (SVG) */}
      <svg className="absolute inset-0 w-full h-full opacity-10" xmlns="http://www.w3.org/2000/svg">
        <line x1="50%" y1="40%" x2="20%" y2="15%" stroke="currentColor" strokeDasharray="4 4" />
        <line x1="50%" y1="40%" x2="60%" y2="25%" stroke="currentColor" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="35%" y2="55%" stroke="currentColor" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="65%" y2="65%" stroke="currentColor" strokeDasharray="4 4" />
        <line x1="50%" y1="50%" x2="15%" y2="75%" stroke="currentColor" strokeDasharray="4 4" />
      </svg>

      {/* Brand text at bottom */}
      <div className="absolute bottom-8 left-8 right-8">
        <p className="text-lg font-bold text-foreground/80">AI Team Studio</p>
        <p className="text-sm text-muted-foreground/60 mt-1">
          Ship products 10x faster with 23 AI agents working alongside your team.
        </p>
      </div>
    </div>
  );
}
