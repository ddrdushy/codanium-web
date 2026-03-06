'use client';

import './globals.css';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body
        className="antialiased bg-[#09090b] text-[#fafafa]"
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="rounded-2xl border border-white/[0.06] bg-[#0f0f13] p-8 max-w-md w-full text-center">
            {/* Icon */}
            <div className="w-16 h-16 rounded-2xl bg-[#f59e0b]/10 border border-[#f59e0b]/20 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="w-8 h-8 text-[#f59e0b]" />
            </div>

            {/* Heading */}
            <h1 className="text-xl font-bold tracking-tight mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-[#71717a] mb-6">
              A critical error occurred. We&apos;re working on it.
            </p>

            {/* Error digest */}
            {error.digest && (
              <div className="mb-6 rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2">
                <p className="text-[10px] text-[#71717a] font-mono">
                  Error ID: {error.digest}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={reset}
                className="px-4 py-2 rounded-lg bg-[#f59e0b] text-[#09090b] text-sm font-semibold hover:bg-[#f59e0b]/90 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => { window.location.href = '/'; }}
                className="px-4 py-2 rounded-lg border border-white/[0.06] text-sm font-medium text-[#fafafa] hover:bg-white/[0.04] transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
