'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { ArrowLeft, CreditCard, Key, BarChart3, User, LogOut, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';

const accountNav = [
  { label: 'Billing & Credits', href: '/account/billing', icon: CreditCard },
  { label: 'Usage', href: '/account/usage', icon: BarChart3 },
  { label: 'API Keys', href: '/account/api-keys', icon: Key },
  { label: 'Profile', href: '/profile', icon: User },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userName = session?.user?.name || 'User';
  const userEmail = session?.user?.email || '';

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-[var(--surface)] backdrop-blur-sm">
        <div className="mx-auto max-w-6xl flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-4">
            <Link
              href="/projects"
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Projects
            </Link>
            <div className="h-4 w-px bg-border" />
            <Link href="/" className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber" />
              <span className="font-semibold text-foreground text-sm">Codanium</span>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{userEmail}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-red-400 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Sign Out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {/* Account nav tabs */}
        <nav className="flex items-center gap-1 mb-8 border-b border-border pb-px">
          {accountNav.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2',
                  isActive
                    ? 'text-amber border-amber bg-amber/5'
                    : 'text-muted-foreground border-transparent hover:text-foreground hover:border-border'
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Page content */}
        {children}
      </div>
    </div>
  );
}
