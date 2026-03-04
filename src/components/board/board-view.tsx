'use client';

import { useState } from 'react';
import { mockCards } from '@/lib/mock-data';
import { CardState, CardType } from '@/types';
import { BoardColumn } from './board-column';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Filter, SlidersHorizontal, Layers, Box, Wrench,
  FlaskConical, AlertOctagon, LayoutGrid
} from 'lucide-react';

const STATES: CardState[] = ['Planned', 'In Progress', 'Under Review', 'Testing', 'Blocked', 'Done', 'Released'];

const typeFilters: { type: CardType | 'All'; icon: React.ElementType; label: string }[] = [
  { type: 'All', icon: LayoutGrid, label: 'All' },
  { type: 'Epic', icon: Layers, label: 'Epics' },
  { type: 'Feature', icon: Box, label: 'Features' },
  { type: 'Task', icon: Wrench, label: 'Tasks' },
  { type: 'QA', icon: FlaskConical, label: 'QA' },
  { type: 'DecisionBlocker', icon: AlertOctagon, label: 'Blockers' },
];

export function BoardView() {
  const [activeFilter, setActiveFilter] = useState<CardType | 'All'>('All');

  const filteredCards = activeFilter === 'All'
    ? mockCards
    : mockCards.filter(c => c.type === activeFilter);

  const cardsByState = STATES.reduce((acc, state) => {
    acc[state] = filteredCards.filter(c => c.state === state);
    return acc;
  }, {} as Record<CardState, typeof mockCards>);

  const totalCards = mockCards.length;
  const blockedCount = mockCards.filter(c => c.state === 'Blocked').length;
  const doneCount = mockCards.filter(c => c.state === 'Done' || c.state === 'Released').length;

  return (
    <div className="flex flex-col h-full">
      {/* Board Header */}
      <div className="px-6 py-4 border-b border-border bg-[var(--surface)]/30">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight">Board</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totalCards} cards · {blockedCount > 0 && <span className="text-red-400">{blockedCount} blocked</span>}
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
                  : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.04] border border-transparent'
              )}
            >
              <Icon className="w-3 h-3" />
              {label}
              {type !== 'All' && (
                <span className="text-[10px] opacity-60">
                  {type === 'All' ? totalCards : mockCards.filter(c => c.type === type).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Kanban Columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-3 p-4 h-full min-w-max">
          {STATES.map(state => (
            <BoardColumn
              key={state}
              state={state}
              cards={cardsByState[state] || []}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
