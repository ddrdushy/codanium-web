'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchDecisions } from '@/lib/api';

import { Decision, RiskRating } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Scale, CheckCircle2, Clock, AlertTriangle, XCircle,
  ChevronRight, Shield, Zap, ThumbsUp, ThumbsDown,
  ArrowRight, ExternalLink, Sparkles, Loader2
} from 'lucide-react';

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  'Drafted': { color: 'text-zinc-400', bg: 'bg-zinc-500/15 border-zinc-500/20', icon: Clock },
  'Options Collected': { color: 'text-zinc-400', bg: 'bg-zinc-500/15 border-zinc-500/20', icon: Clock },
  'Recommended': { color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/20', icon: ArrowRight },
  'Awaiting Approval': { color: 'text-amber', bg: 'bg-amber/15 border-amber/20', icon: Scale },
  'Approved': { color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/20', icon: CheckCircle2 },
  'Rejected': { color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/20', icon: XCircle },
  'Implemented': { color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/20', icon: CheckCircle2 },
  'Verified': { color: 'text-blue-400', bg: 'bg-blue-500/15 border-blue-500/20', icon: Shield },
};

const riskColors: Record<RiskRating, string> = {
  Low: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/20',
  Medium: 'text-amber bg-amber/15 border-amber/20',
  High: 'text-red-400 bg-red-500/15 border-red-500/20',
  Critical: 'text-red-400 bg-red-500/20 border-red-500/30',
};

// Map frontend status back to DB enum
const statusToDb: Record<string, string> = {
  'Drafted': 'DRAFTED', 'Options Collected': 'OPTIONS_COLLECTED',
  'Recommended': 'RECOMMENDED', 'Awaiting Approval': 'AWAITING_APPROVAL',
  'Approved': 'APPROVED', 'Rejected': 'REJECTED',
  'Implemented': 'IMPLEMENTED', 'Verified': 'VERIFIED',
};

export default function DecisionsPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDecision, setSelectedDecision] = useState<Decision | null>(null);
  const [approving, setApproving] = useState(false);

  useEffect(() => {
    fetchDecisions(projectId)
      .then((data) => {
        setDecisions(data);
        if (data.length > 0) setSelectedDecision(data[0]);
      })
      .catch(() => {
        setDecisions([]);
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  const handleApprove = async (decisionId: string, optionName: string) => {
    setApproving(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/decisions/${decisionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'APPROVED', approvedOption: optionName }),
      });
      if (!res.ok) throw new Error('Failed');

      // Refresh decisions
      const updated = await fetchDecisions(projectId);
      setDecisions(updated);
      const sel = updated.find(d => d.decision_id === decisionId);
      if (sel) setSelectedDecision(sel);
    } catch {
      // silently fail
    } finally {
      setApproving(false);
    }
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

  return (
    <div className="flex h-full">
      {/* Decision List */}
      <div className="w-[380px] border-r border-border flex flex-col shrink-0">
        <div className="px-4 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <h1 className="text-lg font-bold tracking-tight">My Decisions</h1>
            {pendingCount > 0 && (
              <Badge className="bg-amber/15 text-amber border-amber/20 text-[10px]">
                {pendingCount} pending
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Important choices that need your approval
          </p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {decisions.length === 0 && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
              <Scale className="w-10 h-10 text-muted-foreground/20 mb-3" />
              <p className="text-sm text-muted-foreground/40 mb-1">No decisions yet</p>
              <p className="text-xs text-muted-foreground/25">
                Decisions will appear here as your AI team identifies choices that need your input
              </p>
            </div>
          )}
          {decisions.map((dec, i) => {
            const config = statusConfig[dec.status] || statusConfig['Drafted'];
            const StatusIcon = config.icon;
            const isSelected = selectedDecision?.decision_id === dec.decision_id;

            return (
              <motion.button
                key={dec.decision_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedDecision(dec)}
                className={cn(
                  'w-full text-left px-4 py-3 border-b border-border transition-all',
                  isSelected
                    ? 'bg-amber/[0.06] border-l-2 border-l-amber'
                    : 'hover:bg-white/[0.02] border-l-2 border-l-transparent'
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-mono text-muted-foreground/50">{dec.decision_id}</span>
                  <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5', config.bg, config.color)}>
                    <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
                    {dec.status}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5', riskColors[dec.risk_rating])}>
                    {dec.risk_rating}
                  </Badge>
                </div>
                <p className="text-sm font-medium text-foreground line-clamp-1">{dec.trigger}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5 line-clamp-1">{dec.recommendation}</p>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Decision Detail */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {selectedDecision ? (
            <motion.div
              key={selectedDecision.decision_id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="p-6 max-w-3xl"
            >
              {/* AI Recommends Banner */}
              {selectedDecision.status === 'Awaiting Approval' && selectedDecision.recommendation && (
                <div className="mb-6 rounded-xl border-2 border-amber/30 bg-gradient-to-r from-amber/[0.08] to-orange-500/[0.05] p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles className="w-5 h-5 text-amber" />
                    <h3 className="text-base font-bold text-amber">Your AI Team Recommends</h3>
                  </div>
                  <p className="text-sm text-foreground mb-4">{selectedDecision.recommendation}</p>
                  <div className="flex items-center gap-3">
                    <Button
                      size="sm"
                      disabled={approving}
                      onClick={() => {
                        const recommended = selectedDecision.options.find(o => selectedDecision.recommendation?.includes(o.name));
                        if (recommended) handleApprove(selectedDecision.decision_id, recommended.name);
                      }}
                      className="bg-amber text-black hover:bg-amber/90 font-semibold px-6"
                    >
                      {approving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <>
                        <CheckCircle2 className="w-4 h-4 mr-1.5" />
                        Approve Recommendation
                      </>}
                    </Button>
                    <span className="text-xs text-muted-foreground">or review all options below</span>
                  </div>
                </div>
              )}

              {/* Header */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-mono text-muted-foreground/50">{selectedDecision.decision_id}</span>
                  <Badge variant="outline" className={cn(
                    'text-[10px]',
                    statusConfig[selectedDecision.status]?.bg,
                    statusConfig[selectedDecision.status]?.color
                  )}>
                    {selectedDecision.status}
                  </Badge>
                  <Badge variant="outline" className={cn('text-[10px]', riskColors[selectedDecision.risk_rating])}>
                    Risk: {selectedDecision.risk_rating}
                  </Badge>
                </div>
                <h2 className="text-xl font-bold tracking-tight">{selectedDecision.trigger}</h2>
                <p className="text-sm text-muted-foreground mt-1">{selectedDecision.context}</p>
                <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground/60">
                  <span>Owner: <strong className="text-foreground">{selectedDecision.owner}</strong></span>
                  <span>·</span>
                  <span>Created: {new Date(selectedDecision.created_at).toLocaleDateString()}</span>
                  {selectedDecision.approved_at && (
                    <>
                      <span>·</span>
                      <span>Approved: {new Date(selectedDecision.approved_at).toLocaleDateString()}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="mb-6">
                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <Scale className="w-4 h-4 text-amber" />
                  Available Options
                  <span className="text-xs font-normal text-muted-foreground">— compare and choose</span>
                </h3>
                <div className="space-y-3">
                  {selectedDecision.options.map((option, i) => {
                    const isApproved = selectedDecision.approved_option === option.name;
                    const isRecommended = selectedDecision.recommendation?.includes(option.name);

                    return (
                      <div
                        key={i}
                        className={cn(
                          'rounded-xl border p-4 transition-all',
                          isApproved && 'border-emerald-500/30 bg-emerald-500/[0.04] glow-green',
                          isRecommended && !isApproved && 'border-amber/30 bg-amber/[0.04] border-l-4 border-l-amber',
                          !isApproved && !isRecommended && 'border-border bg-[var(--surface)]'
                        )}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-semibold">{option.name}</h4>
                            {isApproved && (
                              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/20 text-[10px]">
                                <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> Approved
                              </Badge>
                            )}
                            {isRecommended && !isApproved && (
                              <Badge className="bg-amber/15 text-amber border-amber/20 text-[10px]">
                                <Zap className="w-2.5 h-2.5 mr-0.5" /> Recommended
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={cn('text-[9px]', riskColors[option.risk])}>
                              {option.risk}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] bg-white/[0.04]">
                              Timeline: {option.effort}
                            </Badge>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{option.description}</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">Pros</span>
                            <ul className="mt-1 space-y-0.5">
                              {option.pros.map((pro, j) => (
                                <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <ThumbsUp className="w-2.5 h-2.5 text-emerald-500 mt-0.5 shrink-0" />
                                  {pro}
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <span className="text-[10px] font-semibold text-red-400 uppercase tracking-wider">Cons</span>
                            <ul className="mt-1 space-y-0.5">
                              {option.cons.map((con, j) => (
                                <li key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                                  <ThumbsDown className="w-2.5 h-2.5 text-red-400 mt-0.5 shrink-0" />
                                  {con}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        {/* Approve button for pending decisions */}
                        {selectedDecision.status === 'Awaiting Approval' && !isApproved && (
                          <div className="mt-3 pt-3 border-t border-border flex items-center gap-3">
                            <Button
                              size="sm"
                              disabled={approving}
                              onClick={() => handleApprove(selectedDecision.decision_id, option.name)}
                              className={cn(
                                'h-8 text-xs font-semibold px-4',
                                isRecommended
                                  ? 'bg-amber text-black hover:bg-amber/90'
                                  : 'bg-white/[0.06] text-foreground hover:bg-white/[0.1] border border-border'
                              )}
                            >
                              {approving ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : isRecommended ? (
                                <>
                                  <Sparkles className="w-3 h-3 mr-1.5" />
                                  Choose Recommended
                                </>
                              ) : (
                                'Choose This Option'
                              )}
                            </Button>
                            {isRecommended && (
                              <span className="text-[10px] text-amber/60">Best match for your project</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Reject / Ask for more options */}
              {selectedDecision.status === 'Awaiting Approval' && (
                <div className="mb-6 flex items-center gap-3 text-xs text-muted-foreground/60">
                  <span>Not sure about any option?</span>
                  <button
                    onClick={() => handleReject(selectedDecision.decision_id)}
                    className="text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                  >
                    Ask for more options
                  </button>
                </div>
              )}

              {/* Recommendation */}
              {selectedDecision.recommendation && (
                <div className="mb-6 rounded-xl border border-amber/20 bg-amber/[0.04] p-4">
                  <h3 className="text-sm font-semibold mb-1 flex items-center gap-2 text-amber">
                    <Zap className="w-4 h-4" />
                    Recommendation
                  </h3>
                  <p className="text-sm text-muted-foreground">{selectedDecision.recommendation}</p>
                </div>
              )}

              {/* Impacted cards and artifacts */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2">Related Tasks</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDecision.impacted_cards.map(card => (
                      <Badge key={card} variant="outline" className="text-[10px] bg-white/[0.04]">{card}</Badge>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-border bg-[var(--surface)] p-4">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-2">Related Documents</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedDecision.impacted_artifacts.map(art => (
                      <Badge key={art} variant="outline" className="text-[10px] bg-white/[0.04] font-mono">{art}</Badge>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-full text-sm text-muted-foreground/40">
              Select a decision to view details
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
