'use client';

import { CardState, Card } from '@/types';
import { cn } from '@/lib/utils';
import { BoardCard } from './board-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';

const stateConfig: Record<CardState, { color: string; dot: string; glow?: string }> = {
  'Planned':      { color: 'text-zinc-400',     dot: 'bg-zinc-500' },
  'In Progress':  { color: 'text-blue-400',     dot: 'bg-blue-500',     glow: 'shadow-[0_0_8px_rgba(59,130,246,0.3)]' },
  'Under Review': { color: 'text-violet-400',   dot: 'bg-violet-500' },
  'Testing':      { color: 'text-cyan-400',     dot: 'bg-cyan-500' },
  'Blocked':      { color: 'text-red-400',      dot: 'bg-red-500',      glow: 'shadow-[0_0_8px_rgba(239,68,68,0.3)]' },
  'Done':         { color: 'text-emerald-400',  dot: 'bg-emerald-500' },
  'Released':     { color: 'text-amber',        dot: 'bg-amber',        glow: 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' },
};

export function BoardColumn({ state, cards, onAddCard }: { state: CardState; cards: Card[]; onAddCard?: (state: CardState) => void }) {
  const config = stateConfig[state];
  const { setNodeRef, isOver } = useDroppable({ id: state });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'kanban-column flex flex-col min-w-[280px] max-w-[320px] w-full rounded-xl border bg-[var(--surface)]/50 transition-all duration-200',
        isOver
          ? 'border-amber/40 bg-amber/[0.03] shadow-[0_0_20px_rgba(245,158,11,0.08)]'
          : 'border-border'
      )}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', config.dot, config.glow)} />
          <h3 className={cn('text-xs font-semibold uppercase tracking-wider', config.color)}>
            {state}
          </h3>
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-white/[0.04] text-[10px] font-bold text-muted-foreground">
            {cards.length}
          </span>
        </div>
        <button
          onClick={() => onAddCard?.(state)}
          className="p-1 rounded-md hover:bg-white/[0.06] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Cards */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-12rem)]">
        <div className="p-2 space-y-2">
          {cards.length === 0 ? (
            <div className={cn(
              'flex items-center justify-center py-8 text-xs border border-dashed rounded-lg transition-colors',
              isOver
                ? 'text-amber/60 border-amber/30 bg-amber/[0.03]'
                : 'text-muted-foreground/40 border-border'
            )}>
              {isOver ? 'Drop here' : 'No cards'}
            </div>
          ) : (
            cards.map((card, i) => (
              <BoardCard key={card.card_id} card={card} index={i} />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
