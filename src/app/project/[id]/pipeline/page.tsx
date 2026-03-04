'use client';

import { motion } from 'framer-motion';
import { mockSDLCProgress, mockCards, mockAgents } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2, Circle, Loader2, AlertTriangle,
  Lock, ArrowRight, ChevronRight, Zap, Shield
} from 'lucide-react';

const stageIcons: Record<string, string> = {
  'Business Analysis': '📋',
  'Architecture': '🏗️',
  'UI/UX Design': '🎨',
  'Planning': '📊',
  'Development': '💻',
  'Code Review': '🔍',
  'Testing': '🧪',
  'Release': '🚀',
  'Monitoring': '📡',
  'Iteration': '🔄',
};

const gateDescriptions: Record<string, string> = {
  'Business Analysis': 'BRD approved by BA + user',
  'Architecture': 'SDD approved, feasibility confirmed',
  'UI/UX Design': 'Wireframes approved',
  'Planning': 'Epics, features, tasks created on board',
  'Development': 'Code implemented per task DoD',
  'Code Review': 'PR approved, quality confirmed',
  'Testing': 'All test scenarios pass',
  'Release': 'DoD met, rollback ready, deployed',
  'Monitoring': 'Health checks pass, no critical incidents',
  'Iteration': 'Next cycle begins from current state',
};

export default function PipelinePage() {
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-lg font-bold tracking-tight">SDLC Pipeline</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          10-stage lifecycle · Quality gates enforced between every stage
        </p>
      </motion.div>

      {/* Pipeline Flow */}
      <div className="space-y-3">
        {mockSDLCProgress.map((stage, i) => {
          const icon = stageIcons[stage.stage] || '📋';
          const gate = gateDescriptions[stage.stage] || '';
          const isLast = i === mockSDLCProgress.length - 1;

          return (
            <motion.div
              key={stage.stage}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3 }}
            >
              <div className={cn(
                'relative flex items-start gap-4 p-4 rounded-xl border transition-all',
                stage.status === 'completed' && 'border-emerald-500/20 bg-emerald-500/[0.03]',
                stage.status === 'active' && 'border-amber/30 bg-amber/[0.04] glow-amber',
                stage.status === 'pending' && 'border-border bg-[var(--surface)]/30 opacity-50',
                stage.status === 'blocked' && 'border-red-500/30 bg-red-500/[0.04]',
              )}>
                {/* Stage number */}
                <div className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-xl text-sm font-bold shrink-0',
                  stage.status === 'completed' && 'bg-emerald-500/15 text-emerald-400',
                  stage.status === 'active' && 'bg-amber/15 text-amber',
                  stage.status === 'pending' && 'bg-white/[0.04] text-muted-foreground/40',
                  stage.status === 'blocked' && 'bg-red-500/15 text-red-400',
                )}>
                  {stage.status === 'completed' ? (
                    <CheckCircle2 className="w-5 h-5" />
                  ) : stage.status === 'active' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <span>{i + 1}</span>
                  )}
                </div>

                {/* Stage info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{icon}</span>
                    <h3 className={cn(
                      'text-sm font-semibold',
                      stage.status === 'completed' && 'text-emerald-400',
                      stage.status === 'active' && 'text-amber',
                      stage.status === 'pending' && 'text-muted-foreground/50',
                    )}>
                      {stage.stage}
                    </h3>
                    {stage.status === 'active' && (
                      <Badge className="bg-amber/15 text-amber border-amber/20 text-[10px]">
                        Active
                      </Badge>
                    )}
                    {stage.status === 'completed' && stage.gate_passed && (
                      <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]">
                        Gate Passed
                      </Badge>
                    )}
                  </div>

                  {/* Quality Gate */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <Shield className={cn(
                      'w-3 h-3',
                      stage.gate_passed ? 'text-emerald-500' : 'text-muted-foreground/30'
                    )} />
                    <span className="text-[11px] text-muted-foreground/70">{gate}</span>
                  </div>
                </div>

                {/* Status */}
                <div className="text-right shrink-0">
                  {stage.status === 'completed' && (
                    <span className="text-xs font-medium text-emerald-400">Complete</span>
                  )}
                  {stage.status === 'active' && (
                    <span className="text-xs font-medium text-amber">In Progress</span>
                  )}
                  {stage.status === 'pending' && (
                    <span className="text-xs font-medium text-muted-foreground/30">Pending</span>
                  )}
                </div>

                {/* Connector */}
                {!isLast && (
                  <div className="absolute left-[2.05rem] top-14 w-[2px] h-3 bg-gradient-to-b from-border to-transparent" />
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Summary */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6 }}
        className="rounded-xl border border-border bg-[var(--surface)] p-4"
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Zap className="w-3 h-3 text-amber" />
          <span><strong className="text-foreground">4 of 10</strong> stages completed</span>
          <span className="text-border">·</span>
          <span><strong className="text-amber">3</strong> stages active</span>
          <span className="text-border">·</span>
          <span><strong className="text-muted-foreground/50">3</strong> pending</span>
        </div>
      </motion.div>
    </div>
  );
}
