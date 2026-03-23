'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { fetchCards, updateCardState } from '@/lib/api';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  closestCenter,
} from '@dnd-kit/core';

import { Card, CardState, CardType } from '@/types';
import { BoardColumn } from './board-column';
import { BoardCard } from './board-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ColumnSkeleton } from '@/components/ui/skeleton';
import {
  Filter, SlidersHorizontal, Layers, Box, Wrench,
  FlaskConical, AlertOctagon, LayoutGrid, BarChart3,
  CheckCircle2, Circle, Minus, AlertTriangle, Bot, Plus, GripVertical,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

// ─── Milestone definitions ───
interface MilestonePhase {
  name: string;
  states: CardState[];
  order: number;
}

const MILESTONES: MilestonePhase[] = [
  { name: 'Planning', states: ['Planned'], order: 0 },
  { name: 'In Development', states: ['In Progress'], order: 1 },
  { name: 'Under Review', states: ['Under Review'], order: 2 },
  { name: 'Quality Testing', states: ['Testing'], order: 3 },
  { name: 'Completed', states: ['Done', 'Released'], order: 4 },
];

const viewModes = [
  { key: 'board' as const, label: 'Board', icon: LayoutGrid },
  { key: 'milestones' as const, label: 'Milestones', icon: BarChart3 },
];

// ─── Milestone Card Component ───
function MilestoneCard({
  phase,
  phaseTasks,
  cumulativeDone,
  cumulativeTotal,
  index,
}: {
  phase: MilestonePhase;
  phaseTasks: Card[];
  cumulativeDone: number;
  cumulativeTotal: number;
  index: number;
}) {
  const percentage = cumulativeTotal > 0 ? Math.round((cumulativeDone / cumulativeTotal) * 100) : 0;
  const allDone = cumulativeTotal > 0 && cumulativeDone === cumulativeTotal;
  const inProgress = phaseTasks.length > 0 && !allDone;

  let StatusIcon: React.ElementType;
  let statusColor: string;

  if (allDone) {
    StatusIcon = CheckCircle2;
    statusColor = 'text-emerald-400';
  } else if (inProgress) {
    StatusIcon = Circle;
    statusColor = 'text-blue-400';
  } else {
    StatusIcon = Minus;
    statusColor = 'text-muted-foreground/50';
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'rounded-xl border border-border bg-[var(--surface)] p-5',
        'hover:border-amber/20 transition-colors duration-200',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <StatusIcon className={cn('w-4.5 h-4.5', statusColor)} />
          <span className="text-sm font-semibold text-foreground">{phase.name}</span>
        </div>
        <span className="text-xs text-muted-foreground font-medium tabular-nums">
          {cumulativeDone} of {cumulativeTotal} tasks
        </span>
      </div>

      <div className="relative h-2 rounded-full bg-foreground/[0.06] overflow-hidden">
        <motion.div
          className={cn(
            'absolute inset-y-0 left-0 rounded-full',
            allDone
              ? 'bg-emerald-500'
              : inProgress
                ? 'bg-amber'
                : 'bg-transparent',
          )}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ delay: index * 0.08 + 0.2, duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      <div className="flex items-center justify-end mt-1.5">
        <span className={cn(
          'text-[11px] font-medium tabular-nums',
          allDone ? 'text-emerald-400' : inProgress ? 'text-amber' : 'text-muted-foreground/40',
        )}>
          {percentage}%
        </span>
      </div>
    </motion.div>
  );
}

// ─── Blocked Banner Component ───
function BlockedBanner({ blockedCards }: { blockedCards: Card[] }) {
  if (blockedCards.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-4 mb-4',
      )}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-300">
            {blockedCards.length} {blockedCards.length === 1 ? 'item needs' : 'items need'} attention
          </p>
          <ul className="mt-1.5 space-y-0.5">
            {blockedCards.slice(0, 5).map(card => (
              <li key={card.card_id} className="text-xs text-amber-200/70 truncate">
                &bull; {card.title}
              </li>
            ))}
            {blockedCards.length > 5 && (
              <li className="text-xs text-amber-200/50">
                &hellip; and {blockedCards.length - 5} more
              </li>
            )}
          </ul>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Milestones View Component ───
function MilestonesView({ cards }: { cards: Card[] }) {
  const nonBlockedCards = useMemo(() => cards.filter(c => c.state !== 'Blocked'), [cards]);
  const blockedCards = useMemo(() => cards.filter(c => c.state === 'Blocked'), [cards]);
  const totalNonBlocked = nonBlockedCards.length;

  const milestoneData = useMemo(() => {
    const stateOrder: Record<string, number> = {};
    MILESTONES.forEach(m => {
      m.states.forEach(s => { stateOrder[s] = m.order; });
    });

    return MILESTONES.map((phase) => {
      const phaseTasks = nonBlockedCards.filter(c => phase.states.includes(c.state));
      const cumulativeDone = nonBlockedCards.filter(c => {
        const cardOrder = stateOrder[c.state];
        return cardOrder !== undefined && cardOrder > phase.order;
      }).length;

      const adjustedDone = phase.order === MILESTONES.length - 1
        ? nonBlockedCards.filter(c => phase.states.includes(c.state)).length
        : cumulativeDone;

      return {
        phase,
        phaseTasks,
        cumulativeDone: adjustedDone,
        cumulativeTotal: totalNonBlocked,
      };
    });
  }, [nonBlockedCards, totalNonBlocked]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl mx-auto">
        <BlockedBanner blockedCards={blockedCards} />

        <div className="space-y-3">
          {milestoneData.map((data, index) => (
            <MilestoneCard
              key={data.phase.name}
              phase={data.phase}
              phaseTasks={data.phaseTasks}
              cumulativeDone={data.cumulativeDone}
              cumulativeTotal={data.cumulativeTotal}
              index={index}
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-6 text-center"
        >
          <p className="text-xs text-muted-foreground">
            {totalNonBlocked} total tasks tracked across {MILESTONES.length} milestones
            {blockedCards.length > 0 && (
              <> &middot; <span className="text-amber-400">{blockedCards.length} blocked</span></>
            )}
          </p>
        </motion.div>
      </div>
    </div>
  );
}

// ─── Main Board View ───
export function BoardView() {
  const params = useParams();
  const projectId = params.id as string;

  const [cards, setCards] = useState<Card[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<CardType | 'All'>('All');
  const [createCardOpen, setCreateCardOpen] = useState(false);
  const [createCardState, setCreateCardState] = useState<CardState>('Planned');
  const [viewMode, setViewMode] = useState<'board' | 'milestones'>('board');
  const [activeCard, setActiveCard] = useState<Card | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  // DnD sensors — require 8px movement before drag starts (avoids accidental drags)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    if (projectId) {
      fetchCards(projectId)
        .then(setCards)
        .catch(() => setCards([]))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [projectId]);

  // ─── Drag handlers ───
  const handleDragStart = useCallback((event: DragStartEvent) => {
    const card = event.active.data?.current?.card as Card | undefined;
    if (card) setActiveCard(card);
    setMoveError(null);
  }, []);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveCard(null);

    if (!over) return;

    const cardId = active.id as string;
    const newState = over.id as CardState;

    // Find the card
    const card = cards.find(c => c.card_id === cardId);
    if (!card || card.state === newState) return;

    // Optimistically update UI
    const previousCards = [...cards];
    setCards(prev =>
      prev.map(c => c.card_id === cardId ? { ...c, state: newState } : c)
    );

    // Persist to API
    try {
      await updateCardState(projectId, cardId, newState);
      setMoveError(null);
    } catch (err: any) {
      // Revert on failure
      setCards(previousCards);
      const message = err?.message || 'Failed to move card. The transition may not be allowed.';
      setMoveError(`Cannot move "${card.title}" to ${newState}: ${message}`);
      // Auto-clear error after 5s
      setTimeout(() => setMoveError(null), 5000);
    }
  }, [cards, projectId]);

  const handleDragCancel = useCallback(() => {
    setActiveCard(null);
  }, []);

  const handleAddCard = useCallback((state: CardState) => {
    setCreateCardState(state);
    setCreateCardOpen(true);
  }, []);

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
              <span className="ml-2 text-muted-foreground/40">·</span>
              <span className="ml-2 text-muted-foreground/50">
                <GripVertical className="w-3 h-3 inline-block mr-0.5 -mt-0.5" />
                Drag cards to update status
              </span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex items-center bg-foreground/[0.04] rounded-lg p-0.5 border border-border">
              {viewModes.map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => setViewMode(key)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all',
                    viewMode === key
                      ? 'bg-amber/15 text-amber border border-amber/20 shadow-sm'
                      : 'text-muted-foreground hover:text-foreground border border-transparent'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>

            <Button
              size="sm"
              onClick={() => { setCreateCardState('Planned'); setCreateCardOpen(true); }}
              className="h-8 text-xs gap-1.5 bg-amber hover:bg-amber/90 text-black"
            >
              <Plus className="w-3 h-3" />
              New Card
            </Button>
          </div>
        </div>

        {/* Type Filters — only show in Board view */}
        {viewMode === 'board' && (
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
        )}
      </div>

      {/* Error toast for invalid moves */}
      <AnimatePresence>
        {moveError && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="mx-6 mt-3 px-4 py-3 rounded-lg border border-red-500/30 bg-red-500/[0.08] text-sm text-red-300 flex items-start gap-2"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-400" />
            <span>{moveError}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* View content */}
      <AnimatePresence mode="wait">
        {viewMode === 'board' ? (
          <motion.div
            key="board"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-x-auto overflow-y-hidden"
          >
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragCancel={handleDragCancel}
            >
              {loading ? (
                <div className="flex gap-3 p-4 h-full min-w-max">
                  {STATES.slice(0, 5).map(state => (
                    <ColumnSkeleton key={state} />
                  ))}
                </div>
              ) : (
                <div className="flex gap-3 p-4 h-full min-w-max">
                  {STATES.map(state => (
                    <BoardColumn
                      key={state}
                      state={state}
                      cards={cardsByState[state] || []}
                      onAddCard={handleAddCard}
                    />
                  ))}
                </div>
              )}

              {/* Drag overlay — ghost card that follows the cursor */}
              <DragOverlay dropAnimation={null}>
                {activeCard ? (
                  <div className="w-[280px] opacity-90 rotate-2 scale-105">
                    <BoardCard card={activeCard} index={0} />
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          </motion.div>
        ) : (
          <motion.div
            key="milestones"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden flex flex-col"
          >
            {loading ? (
              <div className="flex flex-col gap-3 p-6 max-w-2xl mx-auto w-full">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-24 rounded-xl bg-foreground/[0.04] animate-pulse" />
                ))}
              </div>
            ) : (
              <MilestonesView cards={filteredCards} />
            )}
          </motion.div>
        )}
      </AnimatePresence>

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
