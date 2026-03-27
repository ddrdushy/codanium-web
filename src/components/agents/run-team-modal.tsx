'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { dispatchTeam, type TeamTask, type TeamDispatchResult } from '@/lib/api';
import type { Agent } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  X, Plus, Trash2, Users, Zap, ChevronRight, CheckCircle2,
} from 'lucide-react';

interface RunTeamModalProps {
  projectId: string;
  agents: Agent[];
  onClose: () => void;
  onDispatched: (result: TeamDispatchResult) => void;
}

interface DraftTask {
  id: string;
  agentShortName: string;
  instruction: string;
}

export function RunTeamModal({ projectId, agents, onClose, onDispatched }: RunTeamModalProps) {
  const [goal, setGoal] = useState('');
  const [tasks, setTasks] = useState<DraftTask[]>([
    { id: crypto.randomUUID(), agentShortName: '', instruction: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addTask = () => {
    if (tasks.length >= 10) return;
    setTasks(prev => [...prev, { id: crypto.randomUUID(), agentShortName: '', instruction: '' }]);
  };

  const removeTask = (id: string) => {
    if (tasks.length === 1) return;
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTask = (id: string, field: 'agentShortName' | 'instruction', value: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
  };

  const handleSubmit = async () => {
    if (!goal.trim()) { setError('Please describe the goal for this team run'); return; }
    const valid = tasks.filter(t => t.agentShortName && t.instruction.trim());
    if (valid.length === 0) { setError('At least one task with an agent and instruction is required'); return; }

    setError(null);
    setSubmitting(true);
    try {
      const teamTasks: TeamTask[] = valid.map(t => ({
        agentShortName: t.agentShortName,
        instruction: t.instruction.trim(),
      }));
      const result = await dispatchTeam(projectId, goal.trim(), teamTasks);
      onDispatched(result);
      onClose();
    } catch (err: any) {
      setError(err.message ?? 'Failed to start team run');
    } finally {
      setSubmitting(false);
    }
  };

  const validTaskCount = tasks.filter(t => t.agentShortName && t.instruction.trim()).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-xl bg-[var(--surface)] border border-border rounded-2xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber/10 border border-amber/20 flex items-center justify-center">
              <Users className="w-4 h-4 text-amber" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">Run Team in Parallel</h2>
              <p className="text-[11px] text-muted-foreground">Assign tasks to multiple agents — they'll all start at once</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Goal */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1.5">
              Overall Goal
            </label>
            <textarea
              value={goal}
              onChange={e => setGoal(e.target.value)}
              placeholder="e.g. Build a complete authentication system with login, signup, and password reset"
              rows={2}
              className="w-full text-sm bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 resize-none outline-none focus:border-amber/40 placeholder:text-muted-foreground/40 transition-colors"
            />
          </div>

          {/* Tasks */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Tasks ({validTaskCount} ready)
              </label>
              <button
                onClick={addTask}
                disabled={tasks.length >= 10}
                className="text-[11px] text-amber hover:underline flex items-center gap-0.5 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-3 h-3" /> Add task
              </button>
            </div>

            <div className="space-y-2">
              {tasks.map((task, index) => (
                <div key={task.id} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1.5">
                    {/* Agent picker */}
                    <select
                      value={task.agentShortName}
                      onChange={e => updateTask(task.id, 'agentShortName', e.target.value)}
                      className="w-full text-xs bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-amber/40 transition-colors appearance-none"
                    >
                      <option value="">Select agent…</option>
                      {agents.map(a => (
                        <option key={a.id} value={a.shortName ?? a.name}>
                          {a.avatar} {a.name}
                        </option>
                      ))}
                    </select>
                    {/* Instruction */}
                    <input
                      type="text"
                      value={task.instruction}
                      onChange={e => updateTask(task.id, 'instruction', e.target.value)}
                      placeholder={`Task ${index + 1} instruction…`}
                      className="w-full text-xs bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-amber/40 placeholder:text-muted-foreground/40 transition-colors"
                    />
                  </div>
                  <button
                    onClick={() => removeTask(task.id)}
                    disabled={tasks.length === 1}
                    className="mt-0.5 p-1.5 rounded-md hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {/* Info */}
          {validTaskCount > 1 && (
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2">
              <Zap className="w-3.5 h-3.5 text-amber shrink-0" />
              {validTaskCount} agents will run simultaneously — results appear in the activity feed as they complete
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-border bg-white/[0.02]">
          <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || !goal.trim() || validTaskCount === 0}
            className="bg-amber text-black hover:bg-amber/90 text-xs h-8 px-4 gap-1.5"
          >
            {submitting ? (
              <>Starting…</>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Start {validTaskCount > 0 ? validTaskCount : ''} Agent{validTaskCount !== 1 ? 's' : ''}
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
