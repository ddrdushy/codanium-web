'use client';

import { useCallback, useEffect, useRef } from 'react';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Search } from 'lucide-react';
import { useCommandPaletteStore } from '@/lib/command-palette-store';
import { useCommandPaletteData, type CommandItem } from './use-command-palette-data';
import { CommandPaletteGroup } from './command-palette-group';
import { CommandPaletteFooter } from './command-palette-footer';
import { cn } from '@/lib/utils';

const categoryLabels: Record<string, string> = {
  navigation: 'Pages',
  'admin-nav': 'Admin',
  project: 'Projects',
  card: 'Tasks',
  agent: 'AI Team',
  decision: 'Decisions',
  'admin-user': 'Users',
};

const categoryOrder = ['navigation', 'admin-nav', 'project', 'card', 'agent', 'decision', 'admin-user'];

export function CommandPalette() {
  const { isOpen, close } = useCommandPaletteStore();
  const router = useRouter();
  const items = useCommandPaletteData();
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when opening
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleSelect = useCallback((item: CommandItem) => {
    close();
    if (item.href) {
      router.push(item.href);
    }
  }, [close, router]);

  // Group items by category
  const grouped = categoryOrder
    .map(cat => ({
      category: cat,
      label: categoryLabels[cat],
      items: items.filter(i => i.category === cat),
    }))
    .filter(g => g.items.length > 0);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-[10000] bg-black/60 backdrop-blur-sm"
            onClick={close}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
            className="fixed inset-0 z-[10001] flex items-start justify-center pt-[15vh] sm:pt-[20vh] px-4"
            onClick={(e) => { if (e.target === e.currentTarget) close(); }}
          >
            <Command
              className={cn(
                'w-full max-w-[640px] rounded-xl overflow-hidden',
                'border border-border',
                'bg-[var(--surface)] backdrop-blur-xl',
                'shadow-2xl shadow-black/40',
              )}
              loop
            >
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 border-b border-border">
                <Search className="w-4 h-4 text-muted-foreground shrink-0" />
                <Command.Input
                  ref={inputRef}
                  placeholder="Search pages, projects, tasks, team..."
                  className={cn(
                    'flex-1 h-12 bg-transparent text-sm text-foreground',
                    'placeholder:text-muted-foreground/50',
                    'outline-none border-0',
                  )}
                />
                <kbd className="hidden sm:inline text-[10px] font-mono text-muted-foreground/40 bg-foreground/[0.06] px-1.5 py-0.5 rounded border border-border/50">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <Command.List className="max-h-[400px] overflow-y-auto p-2">
                <Command.Empty className="py-12 text-center">
                  <div className="text-sm text-muted-foreground">No results found.</div>
                  <div className="text-xs text-muted-foreground/50 mt-1">Try a different search term</div>
                </Command.Empty>

                {grouped.map(group => (
                  <CommandPaletteGroup
                    key={group.category}
                    label={group.label}
                    items={group.items}
                    onSelect={handleSelect}
                  />
                ))}
              </Command.List>

              {/* Footer */}
              <CommandPaletteFooter />
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
