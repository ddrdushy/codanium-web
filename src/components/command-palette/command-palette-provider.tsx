'use client';

import { useEffect } from 'react';
import { useCommandPaletteStore } from '@/lib/command-palette-store';
import { CommandPalette } from './command-palette';

export function CommandPaletteProvider() {
  const { toggle, isOpen, close } = useCommandPaletteStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cmd+K (Mac) or Ctrl+K (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        toggle();
      }
      // Escape to close
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        close();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [toggle, isOpen, close]);

  return <CommandPalette />;
}
