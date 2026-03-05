'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/lib/project-store';
import {
  Loader2, ArrowRight, ArrowLeft, Sparkles, Users, Target,
  Palette, CheckCircle2,
} from 'lucide-react';
import {
  Zap, Shield, Gem, DollarSign, Rocket, LayoutGrid,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PROJECT_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

const AUDIENCE_SUGGESTIONS = [
  'Customers',
  'Internal team',
  'General public',
  'Students',
  'Small businesses',
  'Enterprise',
];

const PRIORITIES = [
  { id: 'launch-quickly', label: 'Launch quickly', icon: Rocket },
  { id: 'high-quality', label: 'High quality', icon: Gem },
  { id: 'low-cost', label: 'Low cost', icon: DollarSign },
  { id: 'scalability', label: 'Scalability', icon: Zap },
  { id: 'beautiful-design', label: 'Beautiful design', icon: LayoutGrid },
  { id: 'security', label: 'Security', icon: Shield },
] as const;

const TOTAL_STEPS = 4;

// Step metadata for header
const STEP_META: Record<number, { title: string; description: string; icon: React.ElementType }> = {
  1: {
    title: 'What do you want to build?',
    description: 'Give your project a name and describe your idea -- it can be rough.',
    icon: Sparkles,
  },
  2: {
    title: 'Who is it for?',
    description: 'Describe your target audience so we can tailor the solution.',
    icon: Users,
  },
  3: {
    title: 'What matters most?',
    description: 'Pick the priorities that are most important for this project.',
    icon: Target,
  },
  4: {
    title: 'Almost there!',
    description: 'Review your answers and pick a project color.',
    icon: Palette,
  },
};

// Framer-motion variants for step transitions
const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 80 : -80,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -80 : 80,
    opacity: 0,
  }),
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const router = useRouter();

  // Wizard state
  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

  // Form fields
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const [audience, setAudience] = useState('');
  const [priorities, setPriorities] = useState<string[]>([]);
  const [color, setColor] = useState(PROJECT_COLORS[0]);

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = useCallback(() => {
    setStep(1);
    setDirection(1);
    setName('');
    setIdea('');
    setAudience('');
    setPriorities([]);
    setColor(PROJECT_COLORS[0]);
    setError('');
  }, []);

  // Navigation helpers
  const goNext = () => {
    if (step === 1 && !name.trim()) {
      setError('Project name is required');
      return;
    }
    setError('');
    setDirection(1);
    setStep((s) => Math.min(s + 1, TOTAL_STEPS));
  };

  const goBack = () => {
    setError('');
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 1));
  };

  const togglePriority = (id: string) => {
    setPriorities((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id],
    );
  };

  // Build the combined description that gets sent to the API
  const buildDescription = () => {
    const parts: string[] = [];
    if (idea.trim()) parts.push(`Idea: ${idea.trim()}`);
    if (audience.trim()) parts.push(`Target audience: ${audience.trim()}`);
    if (priorities.length > 0) {
      const labels = priorities
        .map((id) => PRIORITIES.find((p) => p.id === id)?.label)
        .filter(Boolean);
      parts.push(`Priorities: ${labels.join(', ')}`);
    }
    return parts.join('\n\n');
  };

  // Submit
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      const usersRes = await fetch('/api/admin/users?limit=1');
      const usersData = await usersRes.json();
      const ownerId = usersData.users?.[0]?.id;
      if (!ownerId) throw new Error('No users found');

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: buildDescription(),
          color,
          ownerId,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const project = await res.json();

      useProjectStore.setState({ projects: [] });
      await useProjectStore.getState().fetchProjects();

      reset();
      onOpenChange(false);
      router.push(`/project/${project.id}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Step indicator
  // ---------------------------------------------------------------------------

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-0 mb-2">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => {
        const stepNum = i + 1;
        const isActive = stepNum === step;
        const isCompleted = stepNum < step;
        return (
          <div key={stepNum} className="flex items-center">
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-colors',
                isActive && 'bg-amber text-black',
                isCompleted && 'bg-amber/20 text-amber',
                !isActive && !isCompleted && 'bg-[var(--surface-raised)] text-muted-foreground',
              )}
            >
              {isCompleted ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                stepNum
              )}
            </div>
            {stepNum < TOTAL_STEPS && (
              <div
                className={cn(
                  'w-8 h-0.5 transition-colors',
                  stepNum < step ? 'bg-amber/40' : 'bg-[var(--surface-raised)]',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );

  // ---------------------------------------------------------------------------
  // Step content renderers
  // ---------------------------------------------------------------------------

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="project-name" className="text-xs text-muted-foreground">
          Project Name <span className="text-amber">*</span>
        </Label>
        <Input
          id="project-name"
          placeholder="e.g. My Mobile App"
          value={name}
          onChange={(e) => { setName(e.target.value); setError(''); }}
          className="bg-[var(--surface-raised)] border-border"
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="project-idea" className="text-xs text-muted-foreground">
          Describe your idea
        </Label>
        <Textarea
          id="project-idea"
          placeholder="Tell us what you want built -- it can be rough. Our AI team will help refine it."
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          rows={4}
          className="bg-[var(--surface-raised)] border-border resize-none"
        />
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="project-audience" className="text-xs text-muted-foreground">
          Who will use this?
        </Label>
        <Textarea
          id="project-audience"
          placeholder="Describe who this is for..."
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          rows={3}
          className="bg-[var(--surface-raised)] border-border resize-none"
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Quick suggestions</Label>
        <div className="flex flex-wrap gap-2">
          {AUDIENCE_SUGGESTIONS.map((s) => (
            <Badge
              key={s}
              variant="outline"
              className={cn(
                'cursor-pointer select-none transition-colors text-xs px-3 py-1',
                audience.includes(s)
                  ? 'border-amber bg-amber/10 text-amber'
                  : 'border-border text-muted-foreground hover:border-amber/50 hover:text-foreground',
              )}
              onClick={() => {
                setAudience((prev) => {
                  if (prev.includes(s)) return prev;
                  return prev ? `${prev}, ${s}` : s;
                });
              }}
            >
              {s}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        {PRIORITIES.map(({ id, label, icon: Icon }) => {
          const selected = priorities.includes(id);
          return (
            <button
              key={id}
              type="button"
              onClick={() => togglePriority(id)}
              className={cn(
                'flex items-center gap-3 rounded-lg border p-3 text-left transition-all',
                selected
                  ? 'border-amber bg-amber/10 text-foreground'
                  : 'border-border bg-[var(--surface-raised)] text-muted-foreground hover:border-amber/40 hover:text-foreground',
              )}
            >
              <Icon className={cn('w-5 h-5 shrink-0', selected ? 'text-amber' : 'text-muted-foreground')} />
              <span className="text-sm font-medium">{label}</span>
              {selected && <CheckCircle2 className="w-4 h-4 ml-auto text-amber" />}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Select as many as you like -- or skip this step.
      </p>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-lg border border-border bg-[var(--surface-raised)] p-4 space-y-3 text-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Project</p>
            <p className="text-foreground font-medium">{name}</p>
          </div>
          <div className="w-5 h-5 rounded" style={{ backgroundColor: color }} />
        </div>

        {idea.trim() && (
          <div>
            <p className="text-xs text-muted-foreground">Idea</p>
            <p className="text-foreground line-clamp-2">{idea}</p>
          </div>
        )}

        {audience.trim() && (
          <div>
            <p className="text-xs text-muted-foreground">Audience</p>
            <p className="text-foreground">{audience}</p>
          </div>
        )}

        {priorities.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Priorities</p>
            <div className="flex flex-wrap gap-1.5">
              {priorities.map((id) => {
                const p = PRIORITIES.find((pr) => pr.id === id);
                return p ? (
                  <Badge
                    key={id}
                    variant="outline"
                    className="border-amber/40 bg-amber/10 text-amber text-xs"
                  >
                    {p.label}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        )}
      </div>

      {/* Color picker */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Project Color</Label>
        <div className="flex gap-2">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                'w-7 h-7 rounded-lg border-2 transition-all',
                color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105',
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
    </div>
  );

  const stepRenderers: Record<number, () => React.ReactNode> = {
    1: renderStep1,
    2: renderStep2,
    3: renderStep3,
    4: renderStep4,
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  const meta = STEP_META[step];
  const StepIcon = meta.icon;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-[var(--surface)] border-border sm:max-w-lg">
        {/* Step indicator */}
        <StepIndicator />

        <DialogHeader>
          <DialogTitle className="text-foreground flex items-center gap-2">
            <StepIcon className="w-5 h-5 text-amber" />
            {meta.title}
          </DialogTitle>
          <DialogDescription>{meta.description}</DialogDescription>
        </DialogHeader>

        {/* Animated step content */}
        <div className="relative overflow-hidden min-h-[200px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.25, ease: 'easeInOut' }}
            >
              {stepRenderers[step]()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error */}
        {error && <p className="text-xs text-red-400">{error}</p>}

        {/* Footer navigation */}
        <div className="flex items-center justify-between pt-2">
          <div>
            {step > 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goBack}
                disabled={submitting}
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1" />
                Back
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
            )}
          </div>
          <div>
            {step < TOTAL_STEPS ? (
              <Button
                type="button"
                size="sm"
                onClick={goNext}
                className="bg-amber hover:bg-amber/90 text-black"
              >
                Next
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={submitting || !name.trim()}
                className="bg-amber hover:bg-amber/90 text-black"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Start Project
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
