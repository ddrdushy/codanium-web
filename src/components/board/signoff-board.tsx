'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchCardsWithSignoffs } from '@/lib/api';
import { CardWithSignoffs, SignoffAgent, SignoffInfo, SignoffStatus } from '@/types';
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Search, RefreshCw, Check, X, Clock, ChevronLeft, ChevronRight,
  Shield, ShieldCheck, Server, Cpu, Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants ──────────────────────────────────────────────────────────────

const PAGE_SIZE = 10;

const AGENT_COLORS: Record<SignoffAgent, { bg: string; text: string; ring: string; icon: React.ElementType }> = {
  QA:  { bg: 'bg-emerald-500/15', text: 'text-emerald-400', ring: 'ring-emerald-500/30', icon: Check },
  SEC: { bg: 'bg-violet-500/15',  text: 'text-violet-400',  ring: 'ring-violet-500/30',  icon: Shield },
  DO:  { bg: 'bg-blue-500/15',    text: 'text-blue-400',    ring: 'ring-blue-500/30',     icon: Server },
  PE:  { bg: 'bg-amber-500/15',   text: 'text-amber-400',   ring: 'ring-amber-500/30',    icon: Cpu },
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/15 text-red-400 border-red-500/20',
  high: 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  medium: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
};

// ─── Sub-components ─────────────────────────────────────────────────────────

function SignoffAvatar({ info }: { info: SignoffInfo }) {
  const config = AGENT_COLORS[info.agent];
  const Icon = config.icon;

  return (
    <div className="relative group/avatar flex items-center justify-center">
      <div
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold ring-1 transition-all',
          config.bg, config.text, config.ring,
          info.status === 'approved' && 'ring-2 ring-emerald-500/50',
          info.status === 'rejected' && 'ring-2 ring-red-500/50',
        )}
      >
        {info.agent}
      </div>
      {/* Status overlay */}
      {info.status === 'approved' && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 flex items-center justify-center ring-2 ring-[var(--surface)]">
          <Check className="w-2 h-2 text-white" strokeWidth={3} />
        </div>
      )}
      {info.status === 'rejected' && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-red-500 flex items-center justify-center ring-2 ring-[var(--surface)]">
          <X className="w-2 h-2 text-white" strokeWidth={3} />
        </div>
      )}
      {info.status === 'pending' && (
        <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-muted-foreground/30 flex items-center justify-center ring-2 ring-[var(--surface)]">
          <Clock className="w-2 h-2 text-muted-foreground" strokeWidth={3} />
        </div>
      )}
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1.5 rounded-md bg-[var(--surface-raised)] border border-border text-xs opacity-0 group-hover/avatar:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg">
        <span className={cn('font-semibold', config.text)}>{info.agentName}</span>
        <span className="text-muted-foreground ml-1.5">
          {info.status === 'approved' ? 'Approved' : info.status === 'rejected' ? 'Rejected' : 'Pending'}
        </span>
        {info.content && (
          <p className="text-muted-foreground/70 mt-0.5 max-w-[200px] truncate">{info.content}</p>
        )}
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  const color = value < 30 ? 'bg-red-500' : value < 70 ? 'bg-amber' : 'bg-emerald-500';
  const textColor = value < 30 ? 'text-red-400' : value < 70 ? 'text-amber' : 'text-emerald-400';

  return (
    <div className="flex items-center gap-2.5 min-w-[120px]">
      <div className="flex-1 h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color)}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
      <span className={cn('text-xs font-semibold tabular-nums w-8 text-right', textColor)}>
        {value}%
      </span>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5',
        PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.medium,
      )}
    >
      {priority}
    </Badge>
  );
}

function StatusLabel({ label }: { label: string }) {
  const colorMap: Record<string, string> = {
    'In Review': 'text-blue-400',
    'Approvals Pending': 'text-amber',
    'Needs Security Review': 'text-violet-400',
    'Finalizing': 'text-emerald-400',
    'Needs Rework': 'text-red-400',
  };

  return (
    <span className={cn('text-xs font-medium', colorMap[label] ?? 'text-muted-foreground')}>
      {label}
    </span>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

interface SignoffBoardProps {
  projectId: string;
}

export function SignoffBoard({ projectId }: SignoffBoardProps) {
  const [cards, setCards] = useState<CardWithSignoffs[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const loadCards = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    try {
      const data = await fetchCardsWithSignoffs(projectId);
      setCards(data);
    } catch {
      // keep existing data
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  // Initial load
  useEffect(() => {
    loadCards();
  }, [loadCards]);

  // Poll every 5s
  useEffect(() => {
    const interval = setInterval(() => loadCards(), 5000);
    return () => clearInterval(interval);
  }, [loadCards]);

  // Filter + paginate
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return cards;
    return cards.filter(c =>
      c.title.toLowerCase().includes(q) ||
      c.owner_agent.toLowerCase().includes(q) ||
      c.statusLabel.toLowerCase().includes(q)
    );
  }, [cards, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageCards = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const activeCount = cards.filter(c => c.state !== 'Done' && c.state !== 'Released').length;
  const completedCount = cards.filter(c => c.progress === 100).length;

  // Reset to page 1 when search changes
  useEffect(() => { setPage(1); }, [search]);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading sign-off data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header Bar */}
      <div className="px-6 py-3 flex items-center justify-between border-b border-border bg-[var(--surface)]/20">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-bold text-foreground tracking-tight uppercase">
            Software Development Task Progress
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2 h-2 rounded-full bg-blue-500" />
              <span className="text-muted-foreground">Active Tasks</span>
              <span className="font-semibold text-foreground">{activeCount}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-muted-foreground">Completed</span>
              <span className="font-semibold text-foreground">{completedCount}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 w-48 text-xs bg-foreground/[0.04] border-border"
            />
          </div>
          <button
            onClick={() => loadCards(true)}
            disabled={refreshing}
            className="p-1.5 rounded-md hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', refreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider w-[35%]">Task Name</TableHead>
              <TableHead className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider w-[8%]">Priority</TableHead>
              <TableHead className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider w-[15%]">Progress</TableHead>
              <TableHead className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider w-[12%]">Status</TableHead>
              <TableHead className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider text-center w-[7%]">QA</TableHead>
              <TableHead className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider text-center w-[7%]">SEC</TableHead>
              <TableHead className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider text-center w-[7%]">DO</TableHead>
              <TableHead className="text-[11px] text-muted-foreground font-semibold uppercase tracking-wider text-center w-[7%]">PE</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <AnimatePresence mode="popLayout">
              {pageCards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <p className="text-sm text-muted-foreground">
                      {search ? 'No tasks match your search.' : 'No tasks with sign-off tracking yet.'}
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                pageCards.map((card, i) => (
                  <motion.tr
                    key={card.card_id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    className="border-b border-border hover:bg-foreground/[0.02] transition-colors"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        {card.owner_agent && (
                          <div className="w-6 h-6 rounded-full bg-amber/10 text-amber flex items-center justify-center text-[9px] font-bold ring-1 ring-amber/20 shrink-0">
                            {card.owner_agent.slice(0, 2)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{card.title}</p>
                          {card.module && (
                            <p className="text-[10px] text-muted-foreground/60 mt-0.5">{card.module}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={card.priority} />
                    </TableCell>
                    <TableCell>
                      <ProgressBar value={card.progress} />
                    </TableCell>
                    <TableCell>
                      <StatusLabel label={card.statusLabel} />
                    </TableCell>
                    {(['QA', 'SEC', 'DO', 'PE'] as SignoffAgent[]).map((agent) => (
                      <TableCell key={agent} className="text-center">
                        <div className="flex justify-center">
                          <SignoffAvatar info={card.signoffs[agent]} />
                        </div>
                      </TableCell>
                    ))}
                  </motion.tr>
                ))
              )}
            </AnimatePresence>
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-6 py-3 flex items-center justify-between border-t border-border bg-[var(--surface)]/20">
          <p className="text-xs text-muted-foreground">
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length} tasks
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-md hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={cn(
                  'w-7 h-7 rounded-md text-xs font-medium transition-colors',
                  p === currentPage
                    ? 'bg-amber/15 text-amber border border-amber/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-foreground/[0.06]'
                )}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-md hover:bg-foreground/[0.06] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
