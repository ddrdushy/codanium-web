'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchDecisions } from '@/lib/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Decision } from '@/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  CheckCircle2, Clock, XCircle, ChevronRight,
  Zap, ArrowRight, Sparkles, Loader2, CircleDot,
  FileText, LayoutList, AlertCircle, ChevronDown, ChevronUp, Eye
} from 'lucide-react';

// ── Status Visual Config ─────────────────────────────────────────────────────

const statusConfig: Record<string, {
  label: string;
  color: string;
  dotColor: string;
  icon: React.ElementType;
}> = {
  'Drafted':            { label: 'Draft',             color: 'text-zinc-400',    dotColor: 'bg-zinc-500',    icon: Clock },
  'Options Collected':  { label: 'Options Ready',     color: 'text-zinc-400',    dotColor: 'bg-zinc-500',    icon: Clock },
  'Recommended':        { label: 'Recommended',       color: 'text-blue-400',    dotColor: 'bg-blue-500',    icon: ArrowRight },
  'Awaiting Approval':  { label: 'Needs Your Input',  color: 'text-amber',       dotColor: 'bg-amber',       icon: AlertCircle },
  'Approved':           { label: 'Approved',           color: 'text-emerald-400', dotColor: 'bg-emerald-500', icon: CheckCircle2 },
  'Rejected':           { label: 'Rejected',           color: 'text-red-400',     dotColor: 'bg-red-500',     icon: XCircle },
  'Implemented':        { label: 'Implemented',        color: 'text-emerald-400', dotColor: 'bg-emerald-500', icon: CheckCircle2 },
  'Verified':           { label: 'Verified',           color: 'text-blue-400',    dotColor: 'bg-blue-500',    icon: CheckCircle2 },
};

export default function DecisionsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [approving, setApproving] = useState(false);

  // Document viewer state
  const [docContent, setDocContent] = useState<string | null>(null);
  const [docLoading, setDocLoading] = useState(false);
  const [docExpanded, setDocExpanded] = useState(false);
  const [docTitle, setDocTitle] = useState<string>('');

  useEffect(() => {
    fetchDecisions(projectId)
      .then((data) => {
        // Sort: pending first, then by date
        const sorted = [...data].sort((a, b) => {
          if (a.status === 'Awaiting Approval' && b.status !== 'Awaiting Approval') return -1;
          if (b.status === 'Awaiting Approval' && a.status !== 'Awaiting Approval') return 1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        setDecisions(sorted);
        if (sorted.length > 0) setSelectedDecision(sorted[0]);
      })
      .catch(() => setDecisions([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  // Get document type badge from trigger
  const getDocType = (trigger: string): string | null => {
    if (/brd/i.test(trigger)) return 'BRD';
    if (/sdd/i.test(trigger)) return 'SDD';
    if (/ui/i.test(trigger)) return 'UI';
    if (/ux/i.test(trigger)) return 'UX';
    return null;
  };

  // Fetch the related document (BRD/SDD) when a decision is selected
  const fetchRelatedDocument = useCallback(async (decision: Decision) => {
    const docType = getDocType(decision.trigger);
    if (!docType) {
      setDocContent(null);
      return;
    }
    setDocLoading(true);
    setDocContent(null);
    setDocExpanded(true); // Auto-expand when loading
    try {
      const res = await fetch(`/api/projects/${projectId}/documents`);
      if (!res.ok) throw new Error('Failed to fetch documents');
      const docs = await res.json();
      // Find the matching document by type (BRD or SDD)
      const matchingDoc = docs.find((d: any) =>
        d.type === docType && d.content?.trim()
      );
      if (matchingDoc) {
        setDocContent(matchingDoc.content);
        setDocTitle(matchingDoc.title || `${docType} Document`);
      } else {
        setDocContent(null);
      }
    } catch {
      setDocContent(null);
    } finally {
      setDocLoading(false);
    }
  }, [projectId]);

  // Auto-fetch document when decision changes
  useEffect(() => {
    if (selectedDecision) {
      fetchRelatedDocument(selectedDecision);
    }
  }, [selectedDecision, fetchRelatedDocument]);

  const handleApprove = async (decisionId: string, optionName: string) => {
    setApproving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/decisions/${decisionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED', approvedOption: optionName }),
      });
      if (!res.ok) throw new Error('Failed');
      const updated = await fetchDecisions(projectId);
      const sorted = [...updated].sort((a, b) => {
        if (a.status === 'Awaiting Approval' && b.status !== 'Awaiting Approval') return -1;
        if (b.status === 'Awaiting Approval' && a.status !== 'Awaiting Approval') return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setDecisions(sorted);
      const sel = sorted.find(d => d.decision_id === decisionId);
      if (sel) setSelectedDecision(sel);
    } catch { /* silently fail */ }
    finally { setApproving(false); }
  };

  const handleReject = async (decisionId: string) => {
    try {
      await fetch(`/api/projects/${projectId}/decisions/${decisionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'DRAFTED' }),
      });
      const updated = await fetchDecisions(projectId);
      setDecisions(updated);
      const sel = updated.find(d => d.decision_id === decisionId);
      if (sel) setSelectedDecision(sel);
    } catch {}
  };

  const pendingCount = decisions.filter(d => d.status === 'Awaiting Approval').length;
  const isPending = selectedDecision?.status === 'Awaiting Approval';
  const isApproved = selectedDecision?.status === 'Approved';

  // Extract a clean title (remove "Approval:" prefix if present)
  const cleanTitle = (trigger: string) => {
    return trigger
      .replace(/^(BRD|SDD|UI|UX)\s+Approval:\s*/i, '')
      .replace(/\s+Approval$/i, '');
  };

  return (
    <div className="flex h-full bg-[var(--background)]">

      {/* ── Left Panel: Decision List ──────────────────────────────────── */}
      <div className="w-[340px] border-r border-border flex flex-col shrink-0">
        {/* Header */}
        <div className="px-5 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-amber/10 flex items-center justify-center">
                <LayoutList className="w-4 h-4 text-amber" />
              </div>
              <div>
                <h1 className="text-sm font-bold tracking-tight">My Decisions</h1>
                <p className="text-[11px] text-muted-foreground/60">
                  {pendingCount > 0 ? `${pendingCount} awaiting your input` : 'All caught up'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-border mx-4" />

        {/* Decision Items */}
        <div className="flex-1 overflow-y-auto py-2">
          {loading && (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="w-5 h-5 text-muted-foreground/30 animate-spin" />
            </div>
          )}

          {decisions.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8 py-12">
              <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mb-4">
                <CheckCircle2 className="w-6 h-6 text-muted-foreground/20" />
              </div>
              <p className="text-sm font-medium text-muted-foreground/40 mb-1">No decisions yet</p>
              <p className="text-xs text-muted-foreground/25 leading-relaxed">
                Your AI team will create decisions here when they need your input on important choices
              </p>
            </div>
          )}

          {decisions.map((dec, i) => {
            const config = statusConfig[dec.status] || statusConfig['Drafted'];
            const isSelected = selectedDecision?.decision_id === dec.decision_id;
            const isPendingItem = dec.status === 'Awaiting Approval';
            const docType = getDocType(dec.trigger);

            return (
              <motion.button
                key={dec.decision_id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.2 }}
                onClick={() => setSelectedDecision(dec)}
                className={cn(
                  'w-full text-left mx-2 mb-1 rounded-xl px-3.5 py-3 transition-all group',
                  'hover:bg-white/[0.03]',
                  isSelected && 'bg-white/[0.05] shadow-sm',
                  isPendingItem && !isSelected && 'bg-amber/[0.03]',
                )}
                style={{ width: 'calc(100% - 16px)' }}
              >
                <div className="flex items-start gap-3">
                  {/* Status dot */}
                  <div className="mt-1.5 relative">
                    <div className={cn('w-2 h-2 rounded-full', config.dotColor)} />
                    {isPendingItem && (
                      <div className={cn('absolute inset-0 w-2 h-2 rounded-full animate-ping', config.dotColor, 'opacity-40')} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {docType && (
                        <span className="text-[10px] font-bold tracking-wider text-amber/70 uppercase">{docType}</span>
                      )}
                      <span className={cn('text-[10px] font-medium', config.color)}>{config.label}</span>
                    </div>
                    <p className="text-[13px] font-medium text-foreground/90 line-clamp-1">{cleanTitle(dec.trigger)}</p>
                    <p className="text-[11px] text-muted-foreground/50 mt-0.5 line-clamp-1">
                      {new Date(dec.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {dec.owner && ` · ${dec.owner}`}
                    </p>
                  </div>

                  <ChevronRight className={cn(
                    'w-3.5 h-3.5 mt-1.5 text-muted-foreground/20 transition-all',
                    isSelected && 'text-amber/50',
                    'group-hover:text-muted-foreground/40'
                  )} />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* ── Right Panel: Decision Detail ───────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedDecision ? (
            <motion.div
              key={selectedDecision.decision_id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="p-8 max-w-2xl mx-auto"
            >
              {/* ── Document Type + Status Header ──────────────────── */}
              <div className="mb-8">
                <div className="flex items-center gap-2.5 mb-3">
                  {getDocType(selectedDecision.trigger) && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber/10 text-amber text-[11px] font-bold tracking-wider uppercase">
                      <FileText className="w-3 h-3" />
                      {getDocType(selectedDecision.trigger)} Review
                    </span>
                  )}
                  <span className={cn(
                    'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium',
                    isPending && 'bg-amber/10 text-amber',
                    isApproved && 'bg-emerald-500/10 text-emerald-400',
                    !isPending && !isApproved && 'bg-white/[0.05] text-muted-foreground',
                  )}>
                    {isPending && <CircleDot className="w-3 h-3" />}
                    {isApproved && <CheckCircle2 className="w-3 h-3" />}
                    {statusConfig[selectedDecision.status]?.label || selectedDecision.status}
                  </span>
                </div>

                <h2 className="text-2xl font-bold tracking-tight mb-2">
                  {cleanTitle(selectedDecision.trigger)}
                </h2>
                <p className="text-sm text-muted-foreground/70 leading-relaxed">
                  {selectedDecision.context}
                </p>

                <div className="flex items-center gap-3 mt-3 text-[11px] text-muted-foreground/40">
                  <span>{new Date(selectedDecision.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  {selectedDecision.approved_at && (
                    <>
                      <span className="w-1 h-1 rounded-full bg-muted-foreground/20" />
                      <span className="text-emerald-400/60">
                        Approved {new Date(selectedDecision.approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* ── Document Viewer (BRD/SDD Content) ──────────── */}
              {getDocType(selectedDecision.trigger) && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="mb-8"
                >
                  <button
                    onClick={() => setDocExpanded(!docExpanded)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-amber/20 bg-amber/[0.04] hover:bg-amber/[0.07] transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-amber/15 flex items-center justify-center">
                        <Eye className="w-4 h-4 text-amber" />
                      </div>
                      <div className="text-left">
                        <p className="text-[11px] font-semibold text-amber/70 uppercase tracking-wider">
                          Review {getDocType(selectedDecision.trigger)} Document
                        </p>
                        <p className="text-xs text-muted-foreground/50">
                          {docLoading ? 'Loading...' : docContent ? docTitle : 'No document found'}
                        </p>
                      </div>
                    </div>
                    {docExpanded ? (
                      <ChevronUp className="w-4 h-4 text-amber/50" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-amber/50" />
                    )}
                  </button>

                  <AnimatePresence>
                    {docExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 rounded-xl border border-border/50 bg-[var(--surface-raised)] max-h-[500px] overflow-y-auto">
                          {docLoading && (
                            <div className="flex items-center justify-center py-12">
                              <Loader2 className="w-5 h-5 text-amber/50 animate-spin" />
                            </div>
                          )}
                          {!docLoading && docContent && (
                            <div className="p-5">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  h1: ({ children }) => (
                                    <h1 className="text-base font-bold text-foreground/90 border-b border-border/30 pb-2 mb-4 mt-6 first:mt-0">{children}</h1>
                                  ),
                                  h2: ({ children }) => (
                                    <h2 className="text-[13px] font-bold text-amber/90 mt-6 mb-2 pb-1.5 border-b border-amber/10 first:mt-0">{children}</h2>
                                  ),
                                  h3: ({ children }) => (
                                    <h3 className="text-xs font-semibold text-foreground/80 mt-4 mb-1.5">{children}</h3>
                                  ),
                                  h4: ({ children }) => (
                                    <h4 className="text-[11px] font-semibold text-foreground/70 mt-3 mb-1">{children}</h4>
                                  ),
                                  p: ({ children }) => (
                                    <p className="text-xs text-foreground/60 leading-relaxed mb-2.5">{children}</p>
                                  ),
                                  ul: ({ children }) => (
                                    <ul className="list-disc list-outside ml-4 mb-3 space-y-1">{children}</ul>
                                  ),
                                  ol: ({ children }) => (
                                    <ol className="list-decimal list-outside ml-4 mb-3 space-y-1">{children}</ol>
                                  ),
                                  li: ({ children }) => (
                                    <li className="text-xs text-foreground/60 leading-relaxed pl-1">{children}</li>
                                  ),
                                  strong: ({ children }) => (
                                    <strong className="font-semibold text-foreground/80">{children}</strong>
                                  ),
                                  em: ({ children }) => (
                                    <em className="italic text-foreground/70">{children}</em>
                                  ),
                                  table: ({ children }) => (
                                    <div className="overflow-x-auto my-3 rounded-lg border border-border/30">
                                      <table className="w-full text-xs">{children}</table>
                                    </div>
                                  ),
                                  thead: ({ children }) => (
                                    <thead className="bg-white/[0.03]">{children}</thead>
                                  ),
                                  th: ({ children }) => (
                                    <th className="text-left px-3 py-2 text-[11px] font-semibold text-foreground/70 border-b border-border/30">{children}</th>
                                  ),
                                  td: ({ children }) => (
                                    <td className="px-3 py-1.5 text-foreground/55 border-b border-border/15">{children}</td>
                                  ),
                                  code: ({ children, className }) => {
                                    const isInline = !className;
                                    return isInline ? (
                                      <code className="text-amber/80 bg-amber/[0.08] px-1.5 py-0.5 rounded text-[11px]">{children}</code>
                                    ) : (
                                      <code className={cn('block bg-black/30 border border-border/30 rounded-lg p-3 text-[11px] text-foreground/60 overflow-x-auto', className)}>{children}</code>
                                    );
                                  },
                                  pre: ({ children }) => (
                                    <pre className="my-3">{children}</pre>
                                  ),
                                  blockquote: ({ children }) => (
                                    <blockquote className="border-l-2 border-amber/30 pl-3 my-3 text-foreground/50 italic">{children}</blockquote>
                                  ),
                                  hr: () => (
                                    <hr className="border-border/30 my-4" />
                                  ),
                                  a: ({ href, children }) => (
                                    <a href={href} className="text-amber/80 underline underline-offset-2 hover:text-amber" target="_blank" rel="noopener noreferrer">{children}</a>
                                  ),
                                }}
                              >
                                {docContent}
                              </ReactMarkdown>
                            </div>
                          )}
                          {!docLoading && !docContent && (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                              <FileText className="w-6 h-6 text-muted-foreground/20 mb-2" />
                              <p className="text-xs text-muted-foreground/40">
                                {getDocType(selectedDecision.trigger)} document not found or empty.
                              </p>
                              <p className="text-[10px] text-muted-foreground/25 mt-1">
                                The AI team may still be generating it.
                              </p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* ── Options ────────────────────────────────────────── */}
              {selectedDecision.options.length > 0 && (
                <div className="mb-8">
                  <p className="text-[11px] font-semibold text-muted-foreground/40 uppercase tracking-wider mb-4">
                    {isPending ? 'Or choose an option' : 'Options'}
                  </p>

                  <div className="space-y-3">
                    {selectedDecision.options.map((option, i) => {
                      const isOptionApproved = selectedDecision.approved_option === option.name;
                      const isRecommended = selectedDecision.recommendation?.includes(option.name);

                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.05 * i + 0.15 }}
                          className={cn(
                            'rounded-xl border p-4 transition-all',
                            isOptionApproved && 'border-emerald-500/30 bg-emerald-500/[0.04]',
                            isRecommended && !isOptionApproved && 'border-amber/25 bg-amber/[0.03]',
                            !isOptionApproved && !isRecommended && 'border-border/60 hover:border-border',
                          )}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1.5">
                                <h4 className="text-sm font-semibold">{option.name}</h4>
                                {isOptionApproved && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
                                    <CheckCircle2 className="w-3 h-3" /> Selected
                                  </span>
                                )}
                                {isRecommended && !isOptionApproved && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber">
                                    <Zap className="w-3 h-3" /> Recommended
                                  </span>
                                )}
                              </div>
                              {option.description && (
                                <p className="text-xs text-muted-foreground/60 mb-3">{option.description}</p>
                              )}

                              {/* Pros & Cons inline */}
                              <div className="flex gap-6">
                                {option.pros.length > 0 && (
                                  <div className="flex-1">
                                    {option.pros.map((pro, j) => (
                                      <p key={j} className="text-[11px] text-emerald-400/70 flex items-start gap-1.5 mb-0.5">
                                        <span className="mt-0.5 w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                                        {pro}
                                      </p>
                                    ))}
                                  </div>
                                )}
                                {option.cons.length > 0 && (
                                  <div className="flex-1">
                                    {option.cons.map((con, j) => (
                                      <p key={j} className="text-[11px] text-red-400/60 flex items-start gap-1.5 mb-0.5">
                                        <span className="mt-0.5 w-1 h-1 rounded-full bg-red-500/60 shrink-0" />
                                        {con}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Action button */}
                            {isPending && !isOptionApproved && (
                              <Button
                                size="sm"
                                disabled={approving}
                                onClick={() => handleApprove(selectedDecision.decision_id, option.name)}
                                className={cn(
                                  'h-8 text-[11px] font-semibold px-4 rounded-lg shrink-0',
                                  isRecommended
                                    ? 'bg-amber text-black hover:bg-amber/90'
                                    : 'bg-white/[0.06] text-foreground hover:bg-white/[0.1] border border-border/50'
                                )}
                              >
                                {approving ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Choose'}
                              </Button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── Reject / More Options ──────────────────────────── */}
              {isPending && (
                <div className="mb-8 text-center">
                  <button
                    onClick={() => handleReject(selectedDecision.decision_id)}
                    className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                  >
                    None of these work? Ask the team for more options
                  </button>
                </div>
              )}

              {/* ── Related Items ──────────────────────────────────── */}
              {(selectedDecision.impacted_cards.length > 0 || selectedDecision.impacted_artifacts.length > 0) && (
                <div className="pt-6 border-t border-border/40">
                  <p className="text-[11px] font-semibold text-muted-foreground/30 uppercase tracking-wider mb-3">Related</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedDecision.impacted_cards.map(card => (
                      <span key={card} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/50 bg-white/[0.03] px-2.5 py-1 rounded-md border border-border/30">
                        <LayoutList className="w-3 h-3" />
                        {card}
                      </span>
                    ))}
                    {selectedDecision.impacted_artifacts.map(art => (
                      <span key={art} className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground/50 bg-white/[0.03] px-2.5 py-1 rounded-md border border-border/30 font-mono">
                        <FileText className="w-3 h-3" />
                        {art}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <div className="w-14 h-14 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                <LayoutList className="w-7 h-7 text-muted-foreground/15" />
              </div>
              <p className="text-sm text-muted-foreground/30">Select a decision to review</p>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
