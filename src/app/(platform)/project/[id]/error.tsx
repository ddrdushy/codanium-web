'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams } from 'next/navigation';
import { AlertTriangle, RefreshCw, LayoutDashboard, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function ProjectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const params = useParams();
  const projectId = params.id as string;

  useEffect(() => {
    console.error('[Project Error Boundary]', error);
  }, [error]);

  return (
    <div className="p-6 flex items-center justify-center min-h-[60vh]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
        className="rounded-2xl border border-border bg-[var(--surface)] p-8 max-w-lg w-full text-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="w-16 h-16 rounded-2xl bg-amber/10 border border-amber/20 flex items-center justify-center mx-auto mb-6"
        >
          <AlertTriangle className="w-8 h-8 text-amber" />
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h1 className="text-xl font-bold tracking-tight mb-2">
            Something went wrong with this project
          </h1>
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
            We couldn&apos;t load this page. Try again or switch to a different section using the sidebar.
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
          className="flex items-center justify-center gap-3 flex-wrap"
        >
          <Button
            onClick={reset}
            className="bg-amber text-background hover:bg-amber/90 font-semibold"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Try Again
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/project/${projectId}`}>
              <LayoutDashboard className="w-3.5 h-3.5 mr-1.5" />
              Project Overview
            </Link>
          </Button>
          <Button variant="ghost" asChild>
            <Link href="/projects">
              <FolderOpen className="w-3.5 h-3.5 mr-1.5" />
              All Projects
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
