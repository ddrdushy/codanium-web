'use client';

import { usePathname } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { Sun, Moon, ChevronRight, Search, LogOut, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCommandPaletteStore } from '@/lib/command-palette-store';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { motion, AnimatePresence } from 'framer-motion';

const pageTitles: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/users': 'Users',
  '/admin/billing': 'Billing',
  '/admin/analytics': 'Analytics',
  '/admin/audit': 'Audit Log',
  '/admin/health': 'System Health',
  '/admin/guardrails': 'Guardrails',
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
  const { data: session } = useSession();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const openPalette = useCommandPaletteStore((s) => s.open);

  useEffect(() => setMounted(true), []);

  // Close menu on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const currentPage = getPageTitle(pathname || '/admin');
  const userName = session?.user?.name || 'Admin';
  const userEmail = session?.user?.email || '';
  const userInitials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

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

        {/* Admin Avatar + Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-foreground/[0.04] transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-teal-500/30 to-cyan-600/30 dark:from-teal-400/30 dark:to-cyan-500/30 border border-foreground/10 flex items-center justify-center text-xs font-bold text-foreground/80">
              {userInitials}
            </div>
            <span className="hidden md:block text-sm font-medium text-foreground max-w-[100px] truncate">
              {userName.split(' ')[0]}
            </span>
            <ChevronDown className={cn(
              'hidden md:block w-3 h-3 text-muted-foreground transition-transform',
              menuOpen && 'rotate-180'
            )} />
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-1.5 w-56 z-50 rounded-xl border border-border bg-[var(--surface)] shadow-xl shadow-black/20 overflow-hidden"
              >
                {/* User Info */}
                <div className="px-3 py-3 border-b border-border">
                  <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                  <Badge className="mt-1.5 bg-[var(--admin-accent)]/15 text-[var(--admin-accent)] border-[var(--admin-accent)]/20 text-[10px]">
                    Super Admin
                  </Badge>
                </div>

                {/* Sign Out */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      signOut({ callbackUrl: '/login' });
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/[0.06] transition-all w-full text-left"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    Sign Out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}
