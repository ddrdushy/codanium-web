'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { useNotificationStream } from '@/lib/hooks/use-notification-stream';
import { FeedbackButton } from '@/components/feedback/FeedbackButton';

function NotificationStreamProvider({ children }: { children: React.ReactNode }) {
  // Connect to SSE notification stream — runs silently in background
  useNotificationStream();
  return <>{children}</>;
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingOk, setOnboardingOk] = useState(false);

  // Check onboarding status from DB when session claims it's not completed
  // This handles stale JWT edge cases (e.g. after completing onboarding but JWT hasn't refreshed)
  const sessionOnboarding = (session?.user as { onboardingCompleted?: boolean })?.onboardingCompleted;

  useEffect(() => {
    if (status !== 'authenticated') return;

    // Session says onboarding is done → no need to verify
    if (sessionOnboarding) {
      setOnboardingOk(true);
      setOnboardingChecked(true);
      return;
    }

    // Session says NOT done → verify against DB (might be stale JWT)
    fetch('/api/onboarding/status')
      .then(r => r.json())
      .then(data => {
        if (data.completed) {
          // DB says completed — JWT was stale, let user through
          setOnboardingOk(true);
        } else {
          // DB also says not done — redirect to onboarding
          setOnboardingOk(false);
        }
        setOnboardingChecked(true);
      })
      .catch(() => {
        // API error — let user through (don't block on network failure)
        setOnboardingOk(true);
        setOnboardingChecked(true);
      });
  }, [status, sessionOnboarding]);

  if (status === 'loading' || (status === 'authenticated' && !onboardingChecked)) {
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

  // Admin users should only access the admin panel — not projects
  const isAdmin = (session?.user as { role?: string })?.role === 'admin';
  if (isAdmin) {
    redirect('/admin');
  }

  // Redirect users who haven't completed onboarding (verified against DB)
  if (!onboardingOk) {
    redirect('/onboarding');
  }

  return (
    <NotificationStreamProvider>
      {children}
      <FeedbackButton />
    </NotificationStreamProvider>
  );
}
