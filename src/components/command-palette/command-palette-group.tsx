'use client';

import { Command } from 'cmdk';
import { CommandPaletteItem } from './command-palette-item';
import type { CommandItem } from './use-command-palette-data';

interface CommandPaletteGroupProps {
  label: string;
  items: CommandItem[];
  onSelect: (item: CommandItem) => void;
}

export function CommandPaletteGroup({ label, items, onSelect }: CommandPaletteGroupProps) {
  return (
    <Command.Group
      heading={label}
      className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground/50 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
    >
      {items.map(item => (
        <CommandPaletteItem
          key={item.id}
          item={item}
          onSelect={() => onSelect(item)}
        />
      ))}
    </Command.Group>
  );
}
