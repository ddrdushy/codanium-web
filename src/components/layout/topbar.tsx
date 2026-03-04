'use client';

import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { mockSDLCProgress, mockAgents } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Search, Bell, Zap, Sun, Moon } from 'lucide-react';

export function Topbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const activeAgents = mockAgents.filter(a => a.status === 'working');
  const pendingDecisions = 1;

  useEffect(() => setMounted(true), []);

  return (
    <header className="h-14 border-b border-border bg-[var(--surface)]/80 backdrop-blur-md flex items-center justify-between px-4 shrink-0">
      {/* SDLC Stage Progress (mini) */}
      <div className="flex items-center gap-1">
        {mockSDLCProgress.map((stage, i) => (
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
                {i < mockSDLCProgress.length - 1 && <div className="w-0.5" />}
              </div>
            </TooltipTrigger>
            <TooltipContent className="text-xs">
              <span className="font-semibold">{stage.stage}</span>
              <span className="ml-1.5 text-muted-foreground capitalize">({stage.status})</span>
            </TooltipContent>
          </Tooltip>
        ))}
        <span className="ml-2 text-xs text-muted-foreground font-medium">Development</span>
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-foreground/[0.04] border border-border text-sm text-muted-foreground hover:text-foreground hover:border-foreground/10 transition-all">
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
        <button className="relative p-2 rounded-md hover:bg-foreground/[0.04] transition-colors">
          <Bell className="w-4 h-4 text-muted-foreground" />
          {pendingDecisions > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber pulse-dot" />
          )}
        </button>

        {/* User Avatar */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber/30 to-blue-500/30 border border-foreground/10 flex items-center justify-center text-xs font-bold text-foreground/80">
          U
        </div>
      </div>
    </header>
  );
}
