'use client';

import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { Card } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  Layers, Box, Wrench, FlaskConical, AlertOctagon,
  Clock, AlertTriangle, Flame, ChevronRight, MessageSquare, GripVertical
} from 'lucide-react';

const typeConfig: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  Epic: { icon: Layers, color: 'text-violet-400', bg: 'bg-violet-500/15 border-violet-500/20' },
  Feature: { icon: Box, color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/20' },
  Task: { icon: Wrench, color: 'text-zinc-400', bg: 'bg-zinc-500/15 border-zinc-500/20' },
  QA: { icon: FlaskConical, color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/20' },
  DecisionBlocker: { icon: AlertOctagon, color: 'text-amber', bg: 'bg-amber/15 border-amber/20' },
};

const priorityConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  low: { icon: Clock, color: 'text-zinc-500', label: 'Low' },
  medium: { icon: ChevronRight, color: 'text-blue-400', label: 'Med' },
  high: { icon: AlertTriangle, color: 'text-amber', label: 'High' },
  critical: { icon: Flame, color: 'text-red-400', label: 'Crit' },
};

export function BoardCard({ card, index }: { card: Card; index: number }) {
  const typeInfo = typeConfig[card.type] || typeConfig.Task;
  const priorityInfo = priorityConfig[card.priority] || priorityConfig.medium;
  const TypeIcon = typeInfo.icon;
  const PriorityIcon = priorityInfo.icon;
  const router = useRouter();
  const params = useParams();
  const projectId = params.id as string;

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.card_id,
    data: { card },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.5 : 1, y: 0 }}
      transition={{ delay: index * 0.03, duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      <div
        className={cn(
          'group rounded-lg border border-border bg-[var(--surface-raised)] p-3',
          'hover:border-white/10 transition-all duration-200',
          card.type === 'DecisionBlocker' && 'border-amber/20 bg-amber/[0.03]',
          card.type === 'Epic' && 'border-violet-500/15',
          isDragging && 'shadow-xl ring-2 ring-amber/30',
        )}
      >
        {/* Top: Drag handle + Type badge + Priority */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab active:cursor-grabbing p-0.5 -ml-1 rounded hover:bg-foreground/[0.06] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors"
              title="Drag to move"
            >
              <GripVertical className="w-3.5 h-3.5" />
            </button>
            <Badge variant="outline" className={cn('text-[10px] font-semibold px-1.5 py-0 h-5 gap-1 border', typeInfo.bg, typeInfo.color)}>
              <TypeIcon className="w-2.5 h-2.5" />
              {card.type === 'DecisionBlocker' ? 'Blocker' : card.type}
            </Badge>
          </div>
          <div className="flex items-center gap-1">
            <PriorityIcon className={cn('w-3 h-3', priorityInfo.color)} />
          </div>
        </div>

        {/* Card ID + Title */}
        <div className="mb-1.5">
          <span className="text-[10px] font-mono text-muted-foreground/60 block mb-0.5">{card.card_id}</span>
          <h4 className="text-sm font-medium text-foreground leading-tight line-clamp-2 group-hover:text-amber transition-colors">
            {card.title}
          </h4>
        </div>

        {/* Description preview */}
        {card.description && (
          <p className="text-xs text-muted-foreground/70 line-clamp-2 mb-2.5 leading-relaxed">
            {card.description}
          </p>
        )}

        {/* Module badge */}
        {card.module && (
          <div className="mb-2">
            <Badge variant="outline" className="text-[10px] text-amber border-amber/30 bg-amber/[0.06] px-1.5 py-0 h-4">
              {card.module}
            </Badge>
          </div>
        )}

        {/* Bottom: Agent + Children count + Chat button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {card.owner_agent && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground font-medium">{card.owner_agent}</span>
              </div>
            )}
            {card.children.length > 0 && (
              <span className="text-[10px] text-muted-foreground/50 font-mono">
                {card.children.length} sub
              </span>
            )}
            {card.linked_decision_id && (
              <Badge variant="outline" className="text-[10px] h-4 px-1 bg-amber/10 text-amber border-amber/20">
                {card.linked_decision_id}
              </Badge>
            )}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/project/${projectId}/chat?cardId=${card.card_id}`);
            }}
            className="opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-amber/10 text-muted-foreground hover:text-amber transition-all"
            title="Chat about this card"
          >
            <MessageSquare className="w-3 h-3" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
