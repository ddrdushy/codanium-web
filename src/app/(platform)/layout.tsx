'use client';

import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useNotificationStream } from '@/lib/hooks/use-notification-stream';

function NotificationStreamProvider({ children }: { children: React.ReactNode }) {
  // Connect to SSE notification stream — runs silently in background
  useNotificationStream();
  return <>{children}</>;
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();

  if (status === 'loading') {
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

  return (
    <NotificationStreamProvider>
      {children}
    </NotificationStreamProvider>
  );
}
