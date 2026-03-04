'use client';

import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ReactNode;
  color?: string;
}

export function StatCard({ title, value, change, icon, color = '#6366f1' }: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className="glass-card card-lift rounded-xl border border-border/50 p-5 transition-all duration-200">
      <div className="flex items-start justify-between">
        {/* Icon */}
        <div
          className="flex items-center justify-center w-10 h-10 rounded-full"
          style={{ backgroundColor: color + '15' }}
        >
          <div style={{ color }}>{icon}</div>
        </div>

        {/* Change indicator */}
        {change !== undefined && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md',
              isPositive && 'text-emerald-500 bg-emerald-500/10',
              isNegative && 'text-red-500 bg-red-500/10'
            )}
          >
            {isPositive ? (
              <ArrowUpRight className="w-3 h-3" />
            ) : (
              <ArrowDownRight className="w-3 h-3" />
            )}
            <span>{Math.abs(change)}%</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="mt-4">
        <p className="text-sm text-muted-foreground font-medium">{title}</p>
        <p className="text-2xl font-bold text-foreground mt-0.5">{value}</p>
      </div>
    </div>
  );
}
