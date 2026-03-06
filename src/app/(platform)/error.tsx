'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { ServerCrash, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function PlatformError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Platform Error Boundary]', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl border border-border bg-[var(--surface)] p-8 max-w-md w-full text-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="w-16 h-16 rounded-2xl bg-amber/10 border border-amber/20 flex items-center justify-center mx-auto mb-6"
        >
          <ServerCrash className="w-8 h-8 text-amber" />
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h1 className="text-xl font-bold tracking-tight mb-2">
            We hit a snag
          </h1>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            Something went wrong loading this page. Your data is safe — try refreshing or head back to your projects.
          </p>

          {error.digest && (
            <div className="mb-6 rounded-lg bg-white/[0.03] border border-border px-3 py-2">
              <p className="text-[10px] text-muted-foreground/50 font-mono">
                Error ID: {error.digest}
              </p>
            </div>
          )}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-3"
        >
          <Button
            onClick={reset}
            className="bg-amber text-background hover:bg-amber/90 font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Try Again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/projects">
              <Home className="w-3.5 h-3.5 mr-1.5" />
              Back to Projects
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
