'use client';

import { useDroppable } from '@dnd-kit/core';
import { CardState, Card } from '@/types';
import { cn } from '@/lib/utils';
import { BoardCard } from './board-card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus } from 'lucide-react';

const stateConfig: Record<CardState, { color: string; dot: string; glow?: string }> = {
  'Planned':           { color: 'text-zinc-400',     dot: 'bg-zinc-500' },
  'In Progress':       { color: 'text-blue-400',     dot: 'bg-blue-500',     glow: 'shadow-[0_0_8px_rgba(59,130,246,0.3)]' },
  'Under Review':      { color: 'text-violet-400',   dot: 'bg-violet-500' },
  'Testing':           { color: 'text-cyan-400',     dot: 'bg-cyan-500' },
  'Awaiting Signoff':  { color: 'text-orange-400',   dot: 'bg-orange-500',   glow: 'shadow-[0_0_8px_rgba(249,115,22,0.3)]' },
  'Blocked':           { color: 'text-red-400',      dot: 'bg-red-500',      glow: 'shadow-[0_0_8px_rgba(239,68,68,0.3)]' },
  'Done':              { color: 'text-emerald-400',  dot: 'bg-emerald-500' },
  'Released':          { color: 'text-amber',        dot: 'bg-amber',        glow: 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' },
};

interface BoardColumnProps {
  state: CardState;
  cards: Card[];
  onAddCard?: (state: CardState) => void;
}

export function BoardColumn({ state, cards, onAddCard }: BoardColumnProps) {
  const config = stateConfig[state];
  const { setNodeRef, isOver } = useDroppable({ id: state });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'kanban-column flex flex-col min-w-[280px] max-w-[320px] w-full rounded-xl border bg-[var(--surface)]/50 transition-all duration-200',
        isOver
          ? 'border-amber/40 bg-amber/[0.04] ring-1 ring-amber/20'
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
        {onAddCard && (
          <button
            onClick={() => onAddCard(state)}
            className="p-1 rounded-md hover:bg-foreground/[0.06] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            title={`Add card to ${state}`}
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Drop indicator */}
      {isOver && (
        <div className="mx-2 mt-2 py-2 border-2 border-dashed border-amber/30 rounded-lg flex items-center justify-center">
          <span className="text-[10px] text-amber/60 font-medium">Drop here</span>
        </div>
      )}

      {/* Cards */}
      <ScrollArea className="flex-1 max-h-[calc(100vh-12rem)]">
        <div className="p-2 space-y-2">
          {cards.length === 0 && !isOver ? (
            <div className="flex items-center justify-center py-8 text-xs border border-dashed rounded-lg text-muted-foreground/40 border-border">
              No cards
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
