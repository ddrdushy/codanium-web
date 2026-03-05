'use client';

import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { CardState, CardType, Card } from '@/types';
import { Loader2 } from 'lucide-react';

// Map frontend state/type/priority names to DB enum values
const stateToDb: Record<CardState, string> = {
  'Planned': 'PLANNED', 'In Progress': 'IN_PROGRESS', 'Under Review': 'UNDER_REVIEW',
  'Testing': 'TESTING', 'Blocked': 'BLOCKED', 'Done': 'DONE', 'Released': 'RELEASED',
};
const typeToDb: Record<string, string> = {
  'Epic': 'EPIC', 'Feature': 'FEATURE', 'Task': 'TASK', 'QA': 'QA', 'DecisionBlocker': 'DECISION_BLOCKER',
};
const priorityToDb: Record<string, string> = {
  'low': 'LOW', 'medium': 'MEDIUM', 'high': 'HIGH', 'critical': 'CRITICAL',
};

// Reverse maps
const dbToType: Record<string, CardType> = {
  EPIC: 'Epic', FEATURE: 'Feature', TASK: 'Task', QA: 'QA', DECISION_BLOCKER: 'DecisionBlocker',
};
const dbToState: Record<string, CardState> = {
  PLANNED: 'Planned', IN_PROGRESS: 'In Progress', UNDER_REVIEW: 'Under Review',
  TESTING: 'Testing', BLOCKED: 'Blocked', DONE: 'Done', RELEASED: 'Released',
};
const dbToPriority: Record<string, string> = {
  LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical',
};

interface CreateCardModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  defaultState?: CardState;
  onCardCreated?: (card: Card) => void;
}

export function CreateCardModal({ open, onOpenChange, projectId, defaultState = 'Planned', onCardCreated }: CreateCardModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<string>('Task');
  const [priority, setPriority] = useState<string>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setTitle('');
    setDescription('');
    setType('Task');
    setPriority('medium');
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }

    setSubmitting(true);
    setError('');

    try {
      const res = await fetch(`/api/projects/${projectId}/cards`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          type: typeToDb[type] || 'TASK',
          state: stateToDb[defaultState] || 'PLANNED',
          priority: priorityToDb[priority] || 'MEDIUM',
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create card');
      }

      const raw = await res.json();

      // Map DB response to frontend Card type
      const newCard: Card = {
        card_id: raw.id,
        type: dbToType[raw.type] || 'Task',
        title: raw.title,
        description: raw.description ?? '',
        state: dbToState[raw.state] || defaultState,
        owner_agent: raw.ownerAgent?.shortName ?? raw.ownerAgentId ?? '',
        parent_id: raw.parentId ?? null,
        children: [],
        priority: (dbToPriority[raw.priority] || 'medium') as Card['priority'],
        created_at: raw.createdAt,
        updated_at: raw.updatedAt ?? raw.createdAt,
      };

      onCardCreated?.(newCard);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="bg-[var(--surface)] border-border sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-foreground">New Card</DialogTitle>
          <DialogDescription>
            Create a new card in <span className="font-medium text-foreground">{defaultState}</span>
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="card-title" className="text-xs text-muted-foreground">Title</Label>
            <Input
              id="card-title"
              placeholder="e.g. Implement user authentication"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-[var(--surface-raised)] border-border"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="card-desc" className="text-xs text-muted-foreground">Description</Label>
            <Textarea
              id="card-desc"
              placeholder="Describe the work to be done..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="bg-[var(--surface-raised)] border-border resize-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="bg-[var(--surface-raised)] border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Epic">Epic</SelectItem>
                  <SelectItem value="Feature">Feature</SelectItem>
                  <SelectItem value="Task">Task</SelectItem>
                  <SelectItem value="QA">QA</SelectItem>
                  <SelectItem value="DecisionBlocker">Blocker</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="bg-[var(--surface-raised)] border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !title.trim()} className="bg-amber hover:bg-amber/90 text-black">
              {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Create Card
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
