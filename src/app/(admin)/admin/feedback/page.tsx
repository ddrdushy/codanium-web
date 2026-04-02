'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MessageCircle, Bug, Lightbulb, TrendingUp, Star, RefreshCw, CheckCircle2, Clock, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface FeedbackItem {
  id: string;
  category: string;
  rating: number | null;
  title: string;
  description: string;
  pageUrl: string | null;
  status: string;
  adminReply: string | null;
  createdAt: string;
  user: { name: string; email: string; avatarColor: string };
}

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  NEW: { bg: 'bg-blue-500/10', text: 'text-blue-400' },
  IN_REVIEW: { bg: 'bg-amber/10', text: 'text-amber' },
  RESOLVED: { bg: 'bg-emerald-500/10', text: 'text-emerald-400' },
  CLOSED: { bg: 'bg-zinc-500/10', text: 'text-zinc-400' },
};

const CATEGORY_ICONS: Record<string, typeof Bug> = {
  BUG: Bug,
  FEATURE: Lightbulb,
  IMPROVEMENT: TrendingUp,
  GENERAL: MessageCircle,
};

export default function AdminFeedbackPage() {
  const [data, setData] = useState<{
    feedback: FeedbackItem[];
    total: number;
    avgRating: number;
    categoryBreakdown: Record<string, number>;
  } | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const fetchData = () => {
    const params = filter ? `?category=${filter}` : '';
    fetch(`/api/feedback${params}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  };

  useEffect(() => { fetchData(); }, [filter]);

  const updateStatus = async (id: string, status: string) => {
    await fetch(`/api/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  const submitReply = async (id: string) => {
    await fetch(`/api/feedback/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminReply: replyText, status: 'IN_REVIEW' }),
    });
    setReplyingTo(null);
    setReplyText('');
    fetchData();
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">User Feedback</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data ? `${data.total} feedback items` : 'Loading...'}
            {data && data.avgRating > 0 && (
              <span className="ml-2">
                &middot; Avg rating: <Star className="w-3 h-3 inline text-amber fill-amber" /> {data.avgRating.toFixed(1)}
              </span>
            )}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Stats */}
      {data?.categoryBreakdown && (
        <div className="grid grid-cols-4 gap-3">
          {[
            { key: 'BUG', label: 'Bugs', icon: Bug, color: '#ef4444' },
            { key: 'FEATURE', label: 'Features', icon: Lightbulb, color: '#f59e0b' },
            { key: 'IMPROVEMENT', label: 'Improvements', icon: TrendingUp, color: '#3b82f6' },
            { key: 'GENERAL', label: 'General', icon: MessageCircle, color: '#10b981' },
          ].map(({ key, label, icon: Icon, color }) => (
            <button
              key={key}
              onClick={() => setFilter(filter === key ? '' : key)}
              className={`p-3 rounded-lg border text-center transition-all ${
                filter === key ? 'border-amber bg-amber/5' : 'border-border bg-[var(--surface)] hover:border-muted-foreground/30'
              }`}
            >
              <Icon className="w-4 h-4 mx-auto mb-1" style={{ color }} />
              <div className="text-lg font-bold text-foreground">{data.categoryBreakdown[key] ?? 0}</div>
              <div className="text-[10px] text-muted-foreground">{label}</div>
            </button>
          ))}
        </div>
      )}

      {/* Feedback List */}
      <div className="space-y-3">
        {data?.feedback.map((item) => {
          const Icon = CATEGORY_ICONS[item.category] || MessageCircle;
          const statusStyle = STATUS_COLORS[item.status] || STATUS_COLORS.NEW;
          return (
            <div key={item.id} className="border border-border rounded-lg bg-[var(--surface)] p-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ backgroundColor: item.user.avatarColor }}
                >
                  {item.user.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-medium text-foreground">{item.title}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                    <Icon className="w-3 h-3 text-muted-foreground" />
                    {item.rating && (
                      <span className="flex items-center gap-0.5 text-[10px] text-amber">
                        <Star className="w-3 h-3 fill-amber" /> {item.rating}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{item.description}</p>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60">
                    <span>{item.user.name} &middot; {item.user.email}</span>
                    <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                    {item.pageUrl && <span>Page: {item.pageUrl}</span>}
                  </div>

                  {item.adminReply && (
                    <div className="mt-2 p-2 rounded bg-emerald-500/5 border border-emerald-500/10 text-xs text-emerald-400">
                      <strong>Admin reply:</strong> {item.adminReply}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    {item.status === 'NEW' && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => updateStatus(item.id, 'IN_REVIEW')}>
                        <Eye className="w-3 h-3" /> Review
                      </Button>
                    )}
                    {item.status !== 'RESOLVED' && item.status !== 'CLOSED' && (
                      <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => updateStatus(item.id, 'RESOLVED')}>
                        <CheckCircle2 className="w-3 h-3" /> Resolve
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => setReplyingTo(replyingTo === item.id ? null : item.id)}
                    >
                      Reply
                    </Button>
                  </div>

                  {replyingTo === item.id && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={replyText}
                        onChange={(e) => setReplyText(e.target.value)}
                        placeholder="Write a reply..."
                        className="flex-1 h-7 px-2 rounded border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-amber/50"
                      />
                      <Button size="sm" className="h-7 text-[10px]" onClick={() => submitReply(item.id)} disabled={!replyText.trim()}>
                        Send
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {data?.feedback.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            No feedback yet. Users can send feedback via the floating button on all platform pages.
          </div>
        )}
      </div>
    </motion.div>
  );
}
