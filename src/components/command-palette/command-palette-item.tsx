'use client';

import { Command } from 'cmdk';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CommandItem } from './use-command-palette-data';

interface CommandPaletteItemProps {
  item: CommandItem;
  onSelect: () => void;
}

export function CommandPaletteItem({ item, onSelect }: CommandPaletteItemProps) {
  const Icon = item.icon;

  return (
    <Command.Item
      value={[item.label, item.description, ...(item.keywords || [])].join(' ')}
      onSelect={onSelect}
      className={cn(
        'flex items-center gap-3 px-2.5 py-2 rounded-md text-sm cursor-pointer',
        'transition-colors duration-100',
        'data-[selected=true]:bg-amber/10 data-[selected=true]:text-amber',
        'text-foreground/80 hover:bg-foreground/[0.04]',
      )}
    >
      {/* Icon or Avatar */}
      <div className="flex items-center justify-center w-8 h-8 rounded-md bg-foreground/[0.04] border border-border/50 shrink-0">
        {item.meta?.avatar ? (
          <span className="text-base">{item.meta.avatar}</span>
        ) : (
          <Icon className="w-4 h-4 text-muted-foreground" />
        )}
      </div>

      {/* Text content */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{item.label}</div>
        {item.description && (
          <div className="text-xs text-muted-foreground/60 truncate">{item.description}</div>
        )}
      </div>

      {/* Badge */}
      {item.meta?.badge && (
        <Badge
          variant="secondary"
          className={cn(
            'h-5 px-1.5 text-[10px] font-semibold shrink-0',
            item.meta.badgeColor === 'amber' && 'bg-amber/15 text-amber border-amber/20',
            item.meta.badgeColor === 'green' && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
            item.meta.badgeColor === 'red' && 'bg-red-500/15 text-red-400 border-red-500/20',
            item.meta.badgeColor === 'indigo' && 'bg-[var(--admin-accent)]/15 text-[var(--admin-accent)] border-[var(--admin-accent)]/20',
            (!item.meta.badgeColor || item.meta.badgeColor === 'default') && 'bg-foreground/5 text-muted-foreground',
          )}
        >
          {item.meta.badge}
        </Badge>
      )}
    </Command.Item>
  );
}
