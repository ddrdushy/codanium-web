'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { fetchCards } from '@/lib/api';
import { mockCards } from '@/lib/mock-data';
import { Card, CardState, CardType } from '@/types';
import { BoardColumn } from './board-column';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ColumnSkeleton } from '@/components/ui/skeleton';
import {
  Filter, SlidersHorizontal, Layers, Box, Wrench,
  FlaskConical, AlertOctagon, LayoutGrid
} from 'lucide-react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core';
import { BoardCard } from './board-card';
import { CreateCardModal } from '@/components/modals/create-card-modal';

const STATES: CardState[] = ['Planned', 'In Progress', 'Under Review', 'Testing', 'Blocked', 'Done', 'Released'];

const typeFilters: { type: CardType | 'All'; icon: React.ElementType; label: string }[] = [
  { type: 'All', icon: LayoutGrid, label: 'All' },
  { type: 'Epic', icon: Layers, label: 'Epics' },
  { type: 'Feature', icon: Box, label: 'Features' },
  { type: 'Task', icon: Wrench, label: 'Tasks' },
  { type: 'QA', icon: FlaskConical, label: 'QA' },
  { type: 'DecisionBlocker', icon: AlertOctagon, label: 'Blockers' },
];

// Map frontend state names to DB enum values
const stateToDbEnum: Record<CardState, string> = {
  'Planned': 'PLANNED',
  'In Progress': 'IN_PROGRESS',
  'Under Review': 'UNDER_REVIEW',
  'Testing': 'TESTING',
  'Blocked': 'BLOCKED',
  'Done': 'DONE',
  'Released': 'RELEASED',
};

export function BoardView() {
  const params = useParams();
  const projectId = params.id as string;

  const [cards, setCards] = useState<Card[]>(mockCards);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<CardType | 'All'>('All');
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [createCardOpen, setCreateCardOpen] = useState(false);
  const [createCardState, setCreateCardState] = useState<CardState>('Planned');

  useEffect(() => {
    if (projectId) {
      fetchCards(projectId)
        .then(setCards)
        .catch(() => {/* keep mock data */})
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [projectId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const card = cards.find(c => c.card_id === event.active.id);
    setActiveCard(card ?? null);
  }, [cards]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const cardId = active.id as string;
    const targetState = over.id as CardState;

    // If dropping on the same state, do nothing
    const card = cards.find(c => c.card_id === cardId);
    if (!card || card.state === targetState) return;

    // Optimistic update
    setCards(prev => prev.map(c =>
      c.card_id === cardId ? { ...c, state: targetState } : c
    ));

    // Persist to DB
    fetch(`/api/projects/${projectId}/cards/${cardId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state: stateToDbEnum[targetState] }),
    }).catch(() => {
      // Revert on failure
      setCards(prev => prev.map(c =>
        c.card_id === cardId ? { ...c, state: card.state } : c
      ));
    });
  }, [cards, projectId]);

  const filteredCards = activeFilter === 'All'
    ? cards
    : cards.filter(c => c.type === activeFilter);

  const cardsByState = STATES.reduce((acc, state) => {
    acc[state] = filteredCards.filter(c => c.state === state);
    return acc;
  }, {} as Record<CardState, typeof cards>);

  const totalCards = cards.length;
  const blockedCount = cards.filter(c => c.state === 'Blocked').length;
  const doneCount = cards.filter(c => c.state === 'Done' || c.state === 'Released').length;

  return (
    <div className="flex flex-col h-full">
      {/* Board Header */}
      <div className="px-6 py-4 border-b border-border bg-[var(--surface)]/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Work Board</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalCards} tasks · {blockedCount > 0 && <span className="text-red-400">{blockedCount} blocked</span>}
              {blockedCount > 0 && ' · '}{doneCount} completed
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border bg-white/[0.02]">
              <Filter className="w-3 h-3" />
              Filter
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 border-border bg-white/[0.02]">
              <SlidersHorizontal className="w-3 h-3" />
              Group
            </Button>
          </div>
        </div>

        {/* Type Filters */}
        <div className="flex items-center gap-1.5">
          {typeFilters.map(({ type, icon: Icon, label }) => (
            <button
              key={type}
              onClick={() => setActiveFilter(type)}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all',
                activeFilter === type
                  ? 'bg-amber/15 text-amber border border-amber/20'
                  : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] border border-transparent'
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
              {type !== 'All' && (
                <span className="text-[10px] opacity-60">
                  {cards.filter(c => c.type === type).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        {loading ? (
          <div className="flex gap-3 p-4 h-full min-w-max">
            {STATES.slice(0, 5).map(state => (
              <ColumnSkeleton key={state} />
            ))}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex gap-3 p-4 h-full min-w-max">
              {STATES.map(state => (
                <BoardColumn
                  key={state}
                  state={state}
                  cards={cardsByState[state] || []}
                  onAddCard={(s) => { setCreateCardState(s); setCreateCardOpen(true); }}
                />
              ))}
            </div>
            <DragOverlay>
              {activeCard && (
                <div className="w-[280px] opacity-90 rotate-2">
                  <BoardCard card={activeCard} index={0} isDragOverlay />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <CreateCardModal
        open={createCardOpen}
        onOpenChange={setCreateCardOpen}
        projectId={projectId}
        defaultState={createCardState}
        onCardCreated={(card) => setCards(prev => [...prev, card])}
      />
    </div>
  );
}
