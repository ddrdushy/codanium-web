'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useProjectStore } from '@/lib/project-store';
import { Loader2 } from 'lucide-react';

const PROJECT_COLORS = [
  '#f59e0b', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444',
  '#ec4899', '#06b6d4', '#f97316', '#14b8a6', '#6366f1',
];

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(PROJECT_COLORS[0]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setName('');
    setDescription('');
    setColor(PROJECT_COLORS[0]);
    setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required'); return; }

    setSubmitting(true);
    setError('');

    try {
      // Get first user as owner (since auth session may not be available)
      const usersRes = await fetch('/api/admin/users?limit=1');
      const usersData = await usersRes.json();
      const ownerId = usersData.users?.[0]?.id;
      if (!ownerId) throw new Error('No users found');

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim(), color, ownerId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create project');
      }

      const project = await res.json();

      // Refresh project store
      useProjectStore.setState({ projects: [] });
      await useProjectStore.getState().fetchProjects();

      reset();
      onOpenChange(false);
      router.push(`/project/${project.id}`);
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
          <DialogTitle className="text-foreground">New Project</DialogTitle>
          <DialogDescription>Tell us what you want built. Our AI team will take it from here.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="project-name" className="text-xs text-muted-foreground">Project Name</Label>
            <Input
              id="project-name"
              placeholder="e.g. My Mobile App"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-[var(--surface-raised)] border-border"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-desc" className="text-xs text-muted-foreground">What do you want built?</Label>
            <Textarea
              id="project-desc"
              placeholder="Describe your idea — it can be rough. Our AI team will help refine it."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="bg-[var(--surface-raised)] border-border resize-none"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Color</Label>
            <div className="flex gap-2">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'w-7 h-7 rounded-lg border-2 transition-all',
                    color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !name.trim()} className="bg-amber hover:bg-amber/90 text-black">
              {submitting && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              Start Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
