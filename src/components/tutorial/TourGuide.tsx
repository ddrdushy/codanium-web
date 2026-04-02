'use client';

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTutorial, type TourStep } from '@/lib/hooks/use-tutorial';
import { Sparkles, ArrowRight, ArrowLeft, X, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';

function WelcomeStep({ onStart, onSkip }: { onStart: () => void; onSkip: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-[var(--surface)] border border-border rounded-2xl p-8 max-w-md mx-4 text-center shadow-2xl"
      >
        <div className="w-14 h-14 rounded-2xl bg-amber/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="w-7 h-7 text-amber" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">Welcome to Codanium!</h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          Your AI-powered development team is ready. Let&apos;s take a quick 30-second tour to show you around.
        </p>
        <div className="flex gap-3 justify-center">
          <Button variant="outline" size="sm" onClick={onSkip} className="text-muted-foreground">
            Skip Tour
          </Button>
          <Button size="sm" onClick={onStart} className="gap-1.5 bg-amber hover:bg-amber/90 text-black">
            <Rocket className="w-3.5 h-3.5" /> Start Tour
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SpotlightTooltip({
  step,
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  onSkip,
}: {
  step: TourStep;
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!step.target) return;
    const el = document.querySelector(step.target);
    if (el) {
      const r = el.getBoundingClientRect();
      setRect(r);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [step.target]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip();
      if (e.key === 'ArrowRight') onNext();
      if (e.key === 'ArrowLeft') onPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onNext, onPrev, onSkip]);

  const padding = 8;
  const clipPath = rect
    ? `polygon(0% 0%, 0% 100%, ${rect.left - padding}px 100%, ${rect.left - padding}px ${rect.top - padding}px, ${rect.right + padding}px ${rect.top - padding}px, ${rect.right + padding}px ${rect.bottom + padding}px, ${rect.left - padding}px ${rect.bottom + padding}px, ${rect.left - padding}px 100%, 100% 100%, 100% 0%)`
    : 'none';

  // Position tooltip relative to target
  const tooltipStyle: React.CSSProperties = rect
    ? {
        position: 'fixed',
        top: step.position === 'top' ? rect.top - 12 : rect.bottom + 12,
        left: Math.max(16, Math.min(rect.left, window.innerWidth - 340)),
        transform: step.position === 'top' ? 'translateY(-100%)' : undefined,
        zIndex: 10001,
      }
    : {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10001,
      };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Overlay with spotlight cutout */}
      <div
        className="fixed inset-0 z-[10000] bg-black/50 transition-all duration-300"
        style={{ clipPath }}
        onClick={onSkip}
      />

      {/* Tooltip */}
      <motion.div
        ref={tooltipRef}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        style={tooltipStyle}
        className="w-80 bg-[var(--surface)] border border-border rounded-xl p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-sm font-semibold text-foreground">{step.title}</h3>
          <button onClick={onSkip} className="p-0.5 rounded hover:bg-muted text-muted-foreground">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed mb-4">{step.description}</p>

        {/* Progress + Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === currentStep ? 'bg-amber' : i < currentStep ? 'bg-amber/40' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <div className="flex gap-1.5">
            {currentStep > 1 && (
              <Button variant="ghost" size="sm" onClick={onPrev} className="h-7 px-2 text-xs">
                <ArrowLeft className="w-3 h-3 mr-1" /> Back
              </Button>
            )}
            <Button
              size="sm"
              onClick={onNext}
              className="h-7 px-3 text-xs gap-1 bg-amber hover:bg-amber/90 text-black"
            >
              {currentStep === totalSteps - 1 ? 'Finish' : 'Next'}
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

export function TourGuide() {
  const tutorial = useTutorial();

  if (tutorial.loading || tutorial.completed || !tutorial.isActive) return null;

  return (
    <AnimatePresence mode="wait">
      {tutorial.currentStep === 0 ? (
        <WelcomeStep
          key="welcome"
          onStart={tutorial.nextStep}
          onSkip={tutorial.skipTour}
        />
      ) : tutorial.step ? (
        <SpotlightTooltip
          key={tutorial.step.id}
          step={tutorial.step}
          currentStep={tutorial.currentStep}
          totalSteps={tutorial.totalSteps}
          onNext={tutorial.nextStep}
          onPrev={tutorial.prevStep}
          onSkip={tutorial.skipTour}
        />
      ) : null}
    </AnimatePresence>
  );
}
