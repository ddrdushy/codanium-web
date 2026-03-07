'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Monitor,
  Smartphone,
  Tablet,
  Loader2,
  AlertTriangle,
  PenTool,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DeviceType = 'DESKTOP' | 'MOBILE' | 'TABLET';
type WireframeStatus = 'DRAFT' | 'REVIEW' | 'APPROVED';

interface WireframeData {
  id: string;
  title: string;
  screen: string;
  status: string;
  device: string;
}

interface WireframeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  mode: 'create' | 'edit';
  wireframe?: WireframeData | null;
  onSuccess: (wireframe: any) => void;
}

interface DeleteWireframeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  wireframeId?: string;
  wireframeTitle?: string;
  onDeleted: () => void;
}

// ---------------------------------------------------------------------------
// Device + Status configs
// ---------------------------------------------------------------------------

const deviceOptions: { value: DeviceType; label: string; icon: React.ElementType }[] = [
  { value: 'DESKTOP', label: 'Desktop', icon: Monitor },
  { value: 'TABLET', label: 'Tablet', icon: Tablet },
  { value: 'MOBILE', label: 'Mobile', icon: Smartphone },
];

const statusOptions: { value: WireframeStatus; label: string; color: string; bg: string }[] = [
  { value: 'DRAFT', label: 'Draft', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20' },
  { value: 'REVIEW', label: 'In Review', color: 'text-amber', bg: 'bg-amber/10 border-amber/20' },
  { value: 'APPROVED', label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20' },
];

// Helper to normalize status from DB (UPPERCASE) or frontend (lowercase)
function normalizeStatus(s?: string): WireframeStatus {
  if (!s) return 'DRAFT';
  const upper = s.toUpperCase();
  if (['DRAFT', 'REVIEW', 'APPROVED'].includes(upper)) return upper as WireframeStatus;
  return 'DRAFT';
}

function normalizeDevice(d?: string): DeviceType {
  if (!d) return 'DESKTOP';
  const upper = d.toUpperCase();
  if (['DESKTOP', 'MOBILE', 'TABLET'].includes(upper)) return upper as DeviceType;
  return 'DESKTOP';
}

// ---------------------------------------------------------------------------
// Wireframe Modal (Create / Edit)
// ---------------------------------------------------------------------------

export function WireframeModal({
  open,
  onOpenChange,
  projectId,
  mode,
  wireframe,
  onSuccess,
}: WireframeModalProps) {
  const [title, setTitle] = useState('');
  const [screen, setScreen] = useState('');
  const [device, setDevice] = useState<DeviceType>('DESKTOP');
  const [status, setStatus] = useState<WireframeStatus>('DRAFT');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Pre-fill when editing
  useEffect(() => {
    if (mode === 'edit' && wireframe) {
      setTitle(wireframe.title ?? '');
      setScreen(wireframe.screen ?? '');
      setDevice(normalizeDevice(wireframe.device));
      setStatus(normalizeStatus(wireframe.status));
    } else if (mode === 'create') {
      setTitle('');
      setScreen('');
      setDevice('DESKTOP');
      setStatus('DRAFT');
    }
    setError(null);
  }, [mode, wireframe, open]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError('Title is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      if (mode === 'create') {
        const res = await fetch(`/api/projects/${projectId}/wireframes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: title.trim(),
            screen: screen.trim(),
            device,
            status,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to create wireframe');
        }

        const created = await res.json();
        onSuccess(created);
        onOpenChange(false);
      } else {
        const res = await fetch(`/api/projects/${projectId}/wireframes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            wireframeId: wireframe?.id,
            title: title.trim(),
            screen: screen.trim(),
            device,
            status,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? 'Failed to update wireframe');
        }

        const updated = await res.json();
        onSuccess(updated);
        onOpenChange(false);
      }
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-[var(--surface)] border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <PenTool className="w-4 h-4 text-amber" />
            {mode === 'create' ? 'New Wireframe' : 'Edit Wireframe'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {mode === 'create'
              ? 'Create a new wireframe design for your project.'
              : 'Update wireframe details.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Title</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Dashboard Overview"
              className="h-9 text-sm bg-background"
              autoFocus
            />
          </div>

          {/* Screen name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Screen Name</Label>
            <Input
              value={screen}
              onChange={(e) => setScreen(e.target.value)}
              placeholder="e.g., dashboard, settings, board"
              className="h-9 text-sm bg-background"
            />
            <p className="text-[10px] text-muted-foreground/60">
              Used to match wireframe preview templates
            </p>
          </div>

          {/* Device selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Device</Label>
            <div className="flex gap-1.5">
              {deviceOptions.map((opt) => {
                const Icon = opt.icon;
                const isActive = device === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDevice(opt.value)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-xs font-medium transition-all',
                      isActive
                        ? 'border-amber/30 bg-amber/10 text-amber'
                        : 'border-border bg-background text-muted-foreground hover:border-foreground/10'
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Status selector (edit mode only) */}
          {mode === 'edit' && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <div className="flex gap-1.5">
                {statusOptions.map((opt) => {
                  const isActive = status === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatus(opt.value)}
                      className={cn(
                        'flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                        isActive
                          ? cn(opt.bg, opt.color)
                          : 'border-border bg-background text-muted-foreground hover:border-foreground/10'
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={saving || !title.trim()}
            className="text-xs bg-amber/20 text-amber hover:bg-amber/30 border border-amber/20"
          >
            {saving && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
            {mode === 'create' ? 'Create Wireframe' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Delete Wireframe Dialog
// ---------------------------------------------------------------------------

export function DeleteWireframeDialog({
  open,
  onOpenChange,
  projectId,
  wireframeId,
  wireframeTitle,
  onDeleted,
}: DeleteWireframeDialogProps) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!wireframeId) return;

    setDeleting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/projects/${projectId}/wireframes?wireframeId=${wireframeId}`,
        { method: 'DELETE' },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? 'Failed to delete wireframe');
      }

      onDeleted();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message ?? 'Something went wrong');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-[var(--surface)] border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base text-red-400">
            <AlertTriangle className="w-4 h-4" />
            Delete Wireframe
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Are you sure you want to delete{' '}
            <span className="font-medium text-foreground">
              {wireframeTitle ?? 'this wireframe'}
            </span>
            ? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            {error}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={deleting}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleDelete}
            disabled={deleting}
            className="text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20"
          >
            {deleting && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
