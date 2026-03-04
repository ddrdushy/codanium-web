'use client';

import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Sun, Moon, ChevronRight, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCommandPaletteStore } from '@/lib/command-palette-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const pageTitles: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/users': 'Users',
  '/admin/projects': 'Projects',
  '/admin/billing': 'Billing',
  '/admin/analytics': 'Analytics',
  '/admin/audit': 'Audit Log',
  '/admin/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  // Exact match first
  if (pageTitles[pathname]) return pageTitles[pathname];

  // Try prefix match for nested routes
  const matchingKey = Object.keys(pageTitles)
    .filter((key) => key !== '/admin' && pathname.startsWith(key))
    .sort((a, b) => b.length - a.length)[0];

  if (matchingKey) return pageTitles[matchingKey];

  return 'Dashboard';
}

export function AdminTopbar() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const openPalette = useCommandPaletteStore((s) => s.open);

  useEffect(() => setMounted(true), []);

  const currentPage = getPageTitle(pathname || '/admin');

  return (
    <header className="h-14 border-b border-border bg-[var(--surface)]/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground font-medium">Admin</span>
        {currentPage !== 'Dashboard' && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
            <span className="text-foreground font-semibold">{currentPage}</span>
          </>
        )}
        {currentPage === 'Dashboard' && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
            <span className="text-foreground font-semibold">Dashboard</span>
          </>
        )}
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <button
          onClick={openPalette}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-foreground/[0.04] border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/10 transition-all"
        >
          <Search className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Search...</span>
          <kbd className="hidden sm:inline text-[10px] font-mono bg-foreground/[0.06] px-1.5 py-0.5 rounded">⌘K</kbd>
        </button>

        {/* Theme Toggle */}
        {mounted && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-md hover:bg-[var(--sidebar-accent)] border border-transparent hover:border-border transition-all"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-amber-400" />
                ) : (
                  <Moon className="w-4 h-4 text-muted-foreground" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              Switch to {theme === 'dark' ? 'light' : 'dark'} mode
            </TooltipContent>
          </Tooltip>
        )}

        {/* Admin Avatar */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--admin-accent)]/30 to-purple-500/30 border border-foreground/10 flex items-center justify-center text-xs font-bold text-foreground/80">
          A
        </div>
      </div>
    </header>
  );
}
