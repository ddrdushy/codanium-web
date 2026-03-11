'use client';

import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels?: string[];
}

export function StepIndicator({ currentStep, totalSteps, labels }: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0">
      {Array.from({ length: totalSteps }, (_, i) => {
        const step = i + 1;
        const isCompleted = step < currentStep;
        const isActive = step === currentStep;

        return (
          <div key={step} className="flex items-center">
            {/* Step circle */}
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  'w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                  isCompleted && 'bg-amber/20 text-amber',
                  isActive && 'bg-amber text-background shadow-lg shadow-amber/25',
                  !isCompleted && !isActive && 'bg-surface-raised text-muted-foreground border border-border',
                )}
              >
                {isCompleted ? (
                  <CheckCircle2 className="w-4.5 h-4.5" />
                ) : (
                  step
                )}
              </div>
              {labels?.[i] && (
                <span
                  className={cn(
                    'text-[10px] mt-1.5 font-medium transition-colors whitespace-nowrap',
                    isActive ? 'text-amber' : isCompleted ? 'text-amber/60' : 'text-muted-foreground/50',
                  )}
                >
                  {labels[i]}
                </span>
              )}
            </div>

            {/* Connecting line */}
            {step < totalSteps && (
              <div
                className={cn(
                  'w-12 h-[2px] mx-1.5 rounded-full transition-all duration-300',
                  step < currentStep ? 'bg-amber/40' : 'bg-border',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
