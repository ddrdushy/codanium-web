'use client';

import { useState } from 'react';
import { MessageCircle } from 'lucide-react';
import { FeedbackModal } from './FeedbackModal';

export function FeedbackButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 px-3 py-2 rounded-full bg-amber text-black text-xs font-medium shadow-lg hover:bg-amber/90 transition-all hover:scale-105"
        title="Send Feedback"
      >
        <MessageCircle className="w-3.5 h-3.5" />
        Feedback
      </button>
      <FeedbackModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
