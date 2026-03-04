'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useToastStore, type ToastType } from '@/lib/toast-store';

// ── Icon + color config per toast type ────────────────────────────────
const toastConfig: Record<
  ToastType,
  { icon: React.ElementType; color: string; border: string; bg: string }
> = {
  success: {
    icon: CheckCircle2,
    color: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
  },
  error: {
    icon: XCircle,
    color: 'text-red-400',
    border: 'border-red-500/20',
    bg: 'bg-red-500/5',
  },
  warning: {
    icon: AlertTriangle,
    color: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
  },
  info: {
    icon: Info,
    color: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
  },
};

export function ToastProvider() {
  const { toasts, removeToast } = useToastStore();

  return (
    <div className="fixed bottom-4 right-4 z-[10000] flex flex-col-reverse gap-2 pointer-events-none max-w-sm w-full">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => {
          const config = toastConfig[toast.type];
          const Icon = config.icon;

          return (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.95 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className={cn(
                'pointer-events-auto',
                'flex items-start gap-3 px-4 py-3 rounded-xl',
                'bg-[var(--surface)]/90 backdrop-blur-xl',
                'border shadow-lg shadow-black/20',
                config.border,
                config.bg
              )}
            >
              {/* Icon */}
              <Icon className={cn('w-4 h-4 mt-0.5 shrink-0', config.color)} />

              {/* Message */}
              <p className="flex-1 text-sm text-foreground leading-snug">
                {toast.message}
              </p>

              {/* Actions */}
              <div className="flex items-center gap-1 shrink-0">
                {toast.actionLabel && toast.onAction && (
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={() => {
                      toast.onAction?.();
                      removeToast(toast.id);
                    }}
                    className="text-[10px] font-semibold text-amber-400 hover:text-amber-300"
                  >
                    {toast.actionLabel}
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => removeToast(toast.id)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
