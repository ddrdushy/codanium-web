'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [checked, setChecked] = useState(false);
  const [shouldRedirect, setShouldRedirect] = useState(false);

  const sessionOnboarding = (session?.user as { onboardingCompleted?: boolean })?.onboardingCompleted;

  // Verify onboarding status against DB (handles stale JWT)
  useEffect(() => {
    if (status !== 'authenticated') return;

    // Session says already completed → redirect to projects
    if (sessionOnboarding) {
      setShouldRedirect(true);
      setChecked(true);
      return;
    }

    // Session says NOT done → double-check DB
    fetch('/api/onboarding/status')
      .then(r => r.json())
      .then(data => {
        if (data.completed) {
          // DB says done — stale JWT, redirect to projects
          setShouldRedirect(true);
        }
        setChecked(true);
      })
      .catch(() => {
        // API error — show onboarding (safe fallback)
        setChecked(true);
      });
  }, [status, sessionOnboarding]);

  if (status === 'loading' || (status === 'authenticated' && !checked)) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-amber" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    redirect('/login');
  }

  // Already completed onboarding → go to projects
  if (shouldRedirect) {
    redirect('/projects');
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        {children}
      </div>
    </div>
  );
}
