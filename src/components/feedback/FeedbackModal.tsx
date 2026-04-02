'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Bug, Lightbulb, TrendingUp, MessageSquare, Star, Loader2, CheckCircle2 } from 'lucide-react';

const CATEGORIES = [
  { id: 'BUG', label: 'Bug Report', icon: Bug, color: 'text-red-400', bg: 'bg-red-400/10' },
  { id: 'FEATURE', label: 'Feature Request', icon: Lightbulb, color: 'text-amber', bg: 'bg-amber/10' },
  { id: 'IMPROVEMENT', label: 'Improvement', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 'GENERAL', label: 'General', icon: MessageSquare, color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
];

export function FeedbackModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [category, setCategory] = useState('GENERAL');
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          rating: rating || null,
          title: title.trim(),
          description: description.trim(),
          pageUrl: window.location.pathname,
        }),
      });
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        setSubmitted(false);
        setCategory('GENERAL');
        setRating(0);
        setTitle('');
        setDescription('');
      }, 1500);
    } catch { /* silent */ }
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Feedback</DialogTitle>
        </DialogHeader>

        {submitted ? (
          <div className="flex flex-col items-center py-8 gap-3">
            <CheckCircle2 className="w-10 h-10 text-emerald-500" />
            <p className="text-sm font-medium text-foreground">Thank you for your feedback!</p>
            <p className="text-xs text-muted-foreground">We&apos;ll review it soon.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Category */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Category</label>
              <div className="grid grid-cols-2 gap-2">
                {CATEGORIES.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategory(c.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                      category === c.id
                        ? `${c.bg} ${c.color} border-current`
                        : 'border-border text-muted-foreground hover:border-muted-foreground/30'
                    }`}
                  >
                    <c.icon className="w-3.5 h-3.5" />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Rating (optional)</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    onClick={() => setRating(n === rating ? 0 : n)}
                    className="p-1 transition-colors"
                  >
                    <Star
                      className={`w-5 h-5 ${n <= rating ? 'text-amber fill-amber' : 'text-muted-foreground/30'}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Title</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary..."
                className="w-full h-8 px-3 rounded-md border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-amber/50"
              />
            </div>

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us more..."
                rows={4}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-amber/50"
              />
            </div>

            {/* Submit */}
            <Button
              onClick={handleSubmit}
              disabled={submitting || !title.trim() || !description.trim()}
              className="w-full gap-1.5 bg-amber hover:bg-amber/90 text-black"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
              {submitting ? 'Sending...' : 'Submit Feedback'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
