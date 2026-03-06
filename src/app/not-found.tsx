'use client';

import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { SearchX, ArrowLeft, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6 relative overflow-hidden">
      {/* Background watermark */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="text-[12rem] font-black text-amber/[0.04] leading-none tracking-tighter">
          404
        </span>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 rounded-2xl border border-border bg-[var(--surface)] p-8 max-w-md w-full text-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1, duration: 0.3 }}
          className="w-16 h-16 rounded-2xl bg-amber/10 border border-amber/20 flex items-center justify-center mx-auto mb-6"
        >
          <SearchX className="w-8 h-8 text-amber" />
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <h1 className="text-xl font-bold tracking-tight mb-2">
            Page Not Found
          </h1>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            The page you&apos;re looking for doesn&apos;t exist or has been moved.
          </p>
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center justify-center gap-3"
        >
          <Button asChild className="bg-amber text-background hover:bg-amber/90 font-semibold">
            <Link href="/projects">
              <Home className="w-3.5 h-3.5 mr-1.5" />
              Go to Projects
            </Link>
          </Button>
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
            Go Back
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
