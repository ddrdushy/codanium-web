'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

import { useProjectStore } from '@/lib/project-store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Bell, Zap, Sun, Moon, Shield, LogOut, ChevronDown, User, FolderOpen, CreditCard, Key, BarChart2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCommandPaletteStore } from '@/lib/command-palette-store';
import { useNotificationStore, selectUnreadCount } from '@/lib/notification-store';
import { PresenceBar } from '@/components/collaboration/presence-bar';

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const { data: session } = useSession();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const openPalette = useCommandPaletteStore((s) => s.open);
  const openNotifications = useNotificationStore((s) => s.open);
  const unreadCount = useNotificationStore(selectUnreadCount);

  const { agents: storeAgents, sdlcStages: storeStages, fetchProjectContext } = useProjectStore();

  // Extract current project ID from URL
  const pathParts = pathname?.split('/') || [];
  const projectIdx = pathParts.indexOf('project');
  const currentProjectId = projectIdx !== -1 && pathParts[projectIdx + 1] ? pathParts[projectIdx + 1] : '';

  // Fetch project context (agents + SDLC stages) when project changes
  useEffect(() => {
    if (currentProjectId) {
      fetchProjectContext(currentProjectId);
    }
  }, [currentProjectId, fetchProjectContext]);

  // Poll SDLC stages every 10 seconds to keep header fresh
  useEffect(() => {
    if (!currentProjectId) return;
    const interval = setInterval(() => {
      fetchProjectContext(currentProjectId);
    }, 10000);
    return () => clearInterval(interval);
  }, [currentProjectId, fetchProjectContext]);

  // Use store data only (no mock fallback)
  const sdlcProgress = storeStages;
  const agents = storeAgents;
  const activeAgents = agents.filter(a => a.status === 'working');

  useEffect(() => setMounted(true), []);

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get user info from session
  const userName = session?.user?.name || 'User';
  const userEmail = session?.user?.email || '';
  const userInitials = userName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const isAdmin = (session?.user as { role?: string })?.role === 'admin';

  // Determine current active stage label
  const activeStage = sdlcProgress.find(s => s.status === 'active');
  const stageLabel = activeStage?.stage ?? 'Pipeline';

  return (
    <header className="h-14 border-b border-border bg-[var(--surface)]/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
      {/* SDLC Stage Progress (mini) */}
      <div className="flex items-center gap-1">
        {sdlcProgress.map((stage, i) => (
          <Tooltip key={stage.stage}>
            <TooltipTrigger>
              <div className="flex items-center gap-0">
                <div
                  className={cn(
                    'w-6 h-1.5 rounded-full transition-all duration-300',
                    stage.status === 'completed' && 'bg-emerald-500',
                    stage.status === 'active' && 'bg-amber animate-pulse',
                    stage.status === 'pending' && 'bg-foreground/[0.06]',
                    stage.status === 'blocked' && 'bg-red-500',
                  )}
                />
                {i < sdlcProgress.length - 1 && <div className="w-0.5" />}
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <span className="font-semibold">{stage.stage}</span>
              <span className="ml-1.5 text-muted-foreground capitalize">({stage.status})</span>
            </TooltipContent>
          </Tooltip>
        ))}
        <span className="ml-2 text-xs text-muted-foreground font-medium">{stageLabel}</span>

        {/* Presence Bar — shows when on a project page */}
        {currentProjectId && (
          <div className="ml-4 hidden lg:block">
            <PresenceBar projectId={currentProjectId} />
          </div>
        )}
      </div>

      {/* Right side controls */}
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
                  <Sun className="w-4 h-4 text-amber" />
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

        {/* Active agents indicator */}
        <Tooltip>
          <TooltipTrigger>
            <div className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
              <Zap className="w-3 h-3 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">{activeAgents.length}</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <div className="font-semibold text-xs">{activeAgents.length} agents working</div>
              {activeAgents.slice(0, 4).map(a => (
                <div key={a.id} className="text-xs text-muted-foreground">
                  {a.avatar} {a.name}
                </div>
              ))}
              {activeAgents.length > 4 && (
                <div className="text-xs text-muted-foreground">+{activeAgents.length - 4} more</div>
              )}
            </div>
          </TooltipContent>
        </Tooltip>

        {/* Notifications */}
        <button
          onClick={openNotifications}
          className="relative p-2 rounded-md hover:bg-foreground/[0.04] transition-colors"
        >
          <Bell className="w-4 h-4 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex items-center justify-center">
              {unreadCount > 9 ? (
                <span className="w-4 h-4 rounded-full bg-amber text-[9px] font-bold text-black flex items-center justify-center">
                  9+
                </span>
              ) : unreadCount > 0 ? (
                <span className="min-w-[14px] h-3.5 rounded-full bg-amber text-[9px] font-bold text-black flex items-center justify-center px-0.5">
                  {unreadCount}
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-amber pulse-dot" />
              )}
            </span>
          )}
        </button>

        {/* User Avatar + Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            data-tour="user-menu"
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-foreground/[0.04] transition-all"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber/30 to-blue-500/30 border border-foreground/10 flex items-center justify-center text-xs font-bold text-foreground/80">
              {userInitials}
            </div>
            <span className="hidden md:block text-sm font-medium text-foreground max-w-[100px] truncate">
              {userName.split(' ')[0]}
            </span>
            <ChevronDown className={cn(
              'hidden md:block w-3 h-3 text-muted-foreground transition-transform',
              userMenuOpen && 'rotate-180'
            )} />
          </button>

          {/* Dropdown Menu */}
          <AnimatePresence>
            {userMenuOpen && (
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
                  {isAdmin && (
                    <Badge className="mt-1.5 bg-[var(--admin-accent)]/15 text-[var(--admin-accent)] border-[var(--admin-accent)]/20 text-[10px]">
                      Admin
                    </Badge>
                  )}
                </div>

                {/* Menu Items */}
                <div className="py-1">
                  <Link
                    href="/profile"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all"
                  >
                    <User className="w-3.5 h-3.5" />
                    Profile
                  </Link>
                  <Link
                    href="/projects"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    My Projects
                  </Link>
                </div>

                {/* Account */}
                <div className="py-1 border-t border-border">
                  <Link
                    href="/account/billing"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all"
                  >
                    <CreditCard className="w-3.5 h-3.5" />
                    Credits & Billing
                  </Link>
                  <Link
                    href="/account/usage"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all"
                  >
                    <BarChart2 className="w-3.5 h-3.5" />
                    Usage & Reports
                  </Link>
                  <Link
                    href="/account/api-keys"
                    onClick={() => setUserMenuOpen(false)}
                    className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all"
                  >
                    <Key className="w-3.5 h-3.5" />
                    API Keys
                  </Link>
                  {isAdmin && (
                    <Link
                      href="/admin"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--admin-accent)] hover:bg-[var(--admin-accent)]/[0.06] transition-all"
                    >
                      <Shield className="w-3.5 h-3.5" />
                      Admin Panel
                    </Link>
                  )}
                </div>

                {/* Sign Out */}
                <div className="py-1 border-t border-border">
                  <button
                    onClick={() => {
                      setUserMenuOpen(false);
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
