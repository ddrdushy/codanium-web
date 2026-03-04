'use client';

import { ArrowUp, ArrowDown, CornerDownLeft } from 'lucide-react';

export function CommandPaletteFooter() {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-[11px] text-muted-foreground/50">
      <span className="flex items-center gap-1">
        <ArrowUp className="w-3 h-3" />
        <ArrowDown className="w-3 h-3" />
        <span>Navigate</span>
      </span>
      <span className="flex items-center gap-1">
        <CornerDownLeft className="w-3 h-3" />
        <span>Select</span>
      </span>
      <span className="flex items-center gap-1">
        <kbd className="font-mono text-[10px] bg-foreground/[0.06] px-1 py-0.5 rounded">ESC</kbd>
        <span>Close</span>
      </span>
    </div>
  );
}
