'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { AdminSidebar } from './admin-sidebar';
import { AdminTopbar } from './admin-topbar';

export function AdminLayoutShell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      router.replace('/login');
      return;
    }
    if ((session.user as any).role !== 'admin') {
      router.replace('/projects');
    }
  }, [session, status, router]);

  // Show nothing while checking auth
  if (status === 'loading' || !session?.user || (session.user as any).role !== 'admin') {
    return (
      <div className="flex items-center justify-center h-screen text-muted-foreground text-sm">
        Checking access...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden grain">
      <AdminSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <AdminTopbar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
