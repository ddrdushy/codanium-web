'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { fetchProjects, deleteProject } from '@/lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

import { Project, ProjectStatus } from '@/types';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TooltipProvider } from '@/components/ui/tooltip';
import { TourGuide } from '@/components/tutorial/TourGuide';
import {
  Plus, Search, Zap, Bot, Kanban, Clock, CheckCircle2,
  Pause, Archive, TrendingUp, ArrowRight, BarChart3,
  FolderOpen, LayoutGrid, List, Filter, Settings,
  User, CreditCard, Key, Shield, LogOut, ChevronDown,
  Trash2, X, AlertCircle
} from 'lucide-react';
import { CreateProjectModal } from '@/components/modals/create-project-modal';
import { PlatformSettingsDrawer } from '@/components/modals/platform-settings-drawer';

const statusConfig: Record<ProjectStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  active: { label: 'Active', color: 'text-emerald-400', bg: 'bg-emerald-500/10 border-emerald-500/20', icon: Zap },
  paused: { label: 'Paused', color: 'text-amber', bg: 'bg-amber/10 border-amber/20', icon: Pause },
  completed: { label: 'Completed', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', icon: CheckCircle2 },
  archived: { label: 'Archived', color: 'text-zinc-400', bg: 'bg-zinc-500/10 border-zinc-500/20', icon: Archive },
};

type ViewMode = 'grid' | 'list';
type FilterMode = 'all' | 'active' | 'paused' | 'completed';

export default function ProjectsPage() {
  const { data: session } = useSession();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [byokStatus, setByokStatus] = useState<{ configured: boolean; requireBYOK: boolean } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchProjects()
      .then(setProjects)
      .catch(() => { setProjects([]); })
      .finally(() => setLoading(false));
  }, []);

  // Surface a banner when the user has no BYOK config — required for OSS
  // / self-host deployments running with REQUIRE_USER_BYOK=true, optional
  // (but encouraged) for hosted users who want to skip credit deduction.
  useEffect(() => {
    fetch('/api/account/llm-config')
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && typeof data.configured === 'boolean') {
          setByokStatus({ configured: data.configured, requireBYOK: !!data.requireBYOK });
        }
      })
      .catch(() => { /* non-blocking */ });
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const userName = session?.user?.name || 'User';
  const userEmail = session?.user?.email || '';
  const userInitials = userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  const isAdmin = (session?.user as { role?: string })?.role === 'admin';

  const handleDelete = useCallback(async (id: string) => {
    setDeleting(true);
    try {
      await deleteProject(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      setDeleteConfirm(null);
    } catch {
      // Could show a toast here
    } finally {
      setDeleting(false);
    }
  }, []);

  const filteredProjects = projects.filter(p => {
    if (filterMode !== 'all' && p.status !== filterMode) return false;
    if (searchQuery && !p.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const activeCount = projects.filter(p => p.status === 'active').length;
  const totalAgents = projects.reduce((a, p) => a + p.active_agents, 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Top Header */}
      <header className="border-b border-border bg-[var(--surface)]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber/10 border border-amber/20 flex items-center justify-center">
              <Zap className="w-5 h-5 text-amber" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight">Codanium</h1>
              <p className="text-[10px] text-muted-foreground -mt-0.5">Your AI Development Team</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <Bot className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-xs font-semibold text-emerald-400">{totalAgents} AI specialists working</span>
            </div>
            <button
              data-tour="settings"
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 rounded-lg bg-[var(--surface)] border border-border hover:border-amber/30 hover:bg-amber/5 flex items-center justify-center text-muted-foreground hover:text-amber transition-all"
              title="Platform Settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-1.5 py-1 rounded-lg hover:bg-foreground/[0.04] transition-all"
              >
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber/30 to-blue-500/30 border border-foreground/10 flex items-center justify-center text-xs font-bold text-foreground/80">
                  {userInitials}
                </div>
                <span className="hidden md:block text-sm font-medium text-foreground max-w-[100px] truncate">
                  {userName.split(' ')[0]}
                </span>
                <ChevronDown className={cn(
                  'hidden md:block w-3 h-3 text-muted-foreground transition-transform',
                  userMenuOpen && 'rotate-180'
                )} />
              </button>

              {/* User Dropdown Menu */}
              <AnimatePresence>
                {userMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -4, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -4, scale: 0.98 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 top-full mt-1.5 w-56 z-50 rounded-xl border border-border bg-[var(--surface)] shadow-xl shadow-black/20 overflow-hidden"
                  >
                    {/* User Info */}
                    <div className="px-3 py-3 border-b border-border">
                      <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                      <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
                      {isAdmin && (
                        <Badge className="mt-1.5 bg-[var(--admin-accent)]/15 text-[var(--admin-accent)] border-[var(--admin-accent)]/20 text-[10px]">
                          Admin
                        </Badge>
                      )}
                    </div>

                    {/* Menu Items */}
                    <div className="py-1">
                      <Link
                        href="/profile"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all"
                      >
                        <User className="w-3.5 h-3.5" />
                        Profile
                      </Link>
                    </div>

                    {/* Account */}
                    <div className="py-1 border-t border-border">
                      <Link
                        href="/billing"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Billing
                      </Link>
                      <Link
                        href="/account/api-keys"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all"
                      >
                        <Key className="w-3.5 h-3.5" />
                        API Keys
                      </Link>
                      {isAdmin && (
                        <Link
                          href="/admin"
                          onClick={() => setUserMenuOpen(false)}
                          className="flex items-center gap-2.5 px-3 py-2 text-sm text-[var(--admin-accent)] hover:bg-[var(--admin-accent)]/[0.06] transition-all"
                        >
                          <Shield className="w-3.5 h-3.5" />
                          Admin Panel
                        </Link>
                      )}
                    </div>

                    {/* Sign Out */}
                    <div className="py-1 border-t border-border">
                      <button
                        onClick={() => {
                          setUserMenuOpen(false);
                          signOut({ callbackUrl: '/' });
                        }}
                        className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/[0.06] transition-all w-full text-left"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </header>

      {/* Tutorial Tour Guide */}
      <TourGuide />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* BYOK status banner — shown when the user has no personal LLM provider key */}
        {byokStatus && !byokStatus.configured && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              'mb-6 rounded-xl border px-4 py-3 flex items-start gap-3',
              byokStatus.requireBYOK
                ? 'bg-red-500/[0.06] border-red-500/30 text-red-200'
                : 'bg-amber/[0.06] border-amber/30 text-amber',
            )}
          >
            {byokStatus.requireBYOK ? (
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            ) : (
              <Key className="w-5 h-5 flex-shrink-0 mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">
                {byokStatus.requireBYOK
                  ? 'AI provider required'
                  : 'Bring your own AI provider'}
              </p>
              <p className="text-xs opacity-90 mt-0.5">
                {byokStatus.requireBYOK
                  ? 'This deployment runs without platform-provided keys. Add your own OpenAI, Anthropic, Ollama, Mistral, Groq, or compatible provider to start using your AI team.'
                  : 'Configure your own API key to skip platform credit charges and use your preferred provider — OpenAI, Anthropic, Ollama, Mistral, Groq, and more.'}
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => setShowSettings(true)}
              className={cn(
                'flex-shrink-0 font-semibold',
                byokStatus.requireBYOK
                  ? 'bg-red-500 text-white hover:bg-red-500/90'
                  : 'bg-amber text-background hover:bg-amber/90',
              )}
            >
              <Settings className="w-3.5 h-3.5 mr-1.5" />
              Configure
            </Button>
          </motion.div>
        )}

        {/* Page Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-end justify-between mb-8"
        >
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Your Projects</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {projects.length} projects · {activeCount} active · {totalAgents} AI specialists assigned
            </p>
          </div>
          <Button data-tour="new-project" onClick={() => setShowCreateModal(true)} className="bg-amber text-background hover:bg-amber/90 font-semibold h-10 px-5">
            <Plus className="w-4 h-4 mr-2" />
            New Project
          </Button>
        </motion.div>

        {/* Controls */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex items-center justify-between mb-6"
        >
          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/40" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search projects..."
                className="pl-9 pr-4 py-2 text-sm bg-[var(--surface)] border border-border rounded-xl w-64 outline-none focus:border-amber/30 transition-colors text-foreground placeholder:text-muted-foreground/40"
              />
            </div>
            {/* Filter */}
            <div className="flex gap-0.5 bg-[var(--surface)] border border-border rounded-xl p-0.5">
              {([
                { key: 'all' as FilterMode, label: 'All' },
                { key: 'active' as FilterMode, label: 'Active' },
                { key: 'paused' as FilterMode, label: 'Paused' },
                { key: 'completed' as FilterMode, label: 'Done' },
              ]).map(f => (
                <button
                  key={f.key}
                  onClick={() => setFilterMode(f.key)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    filterMode === f.key
                      ? 'bg-amber/10 text-amber'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {/* View toggle */}
          <div className="flex gap-0.5 bg-[var(--surface)] border border-border rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-1.5 rounded-md transition-all',
                viewMode === 'grid' ? 'bg-foreground/[0.08] text-foreground' : 'text-muted-foreground/40'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={cn(
                'p-1.5 rounded-md transition-all',
                viewMode === 'list' ? 'bg-foreground/[0.08] text-foreground' : 'text-muted-foreground/40'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </motion.div>

        {/* Project Grid */}
        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project, i) => (
              <ProjectCard key={project.id} project={project} index={i} onDelete={(id) => setDeleteConfirm(id)} />
            ))}
            {/* New Project card */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: filteredProjects.length * 0.06 }}
            >
              <button onClick={() => setShowCreateModal(true)} className="w-full h-full min-h-[200px] rounded-2xl border-2 border-dashed border-border hover:border-amber/30 bg-[var(--surface)]/50 flex flex-col items-center justify-center gap-3 transition-all hover:bg-amber/[0.02] group">
                <div className="w-12 h-12 rounded-2xl bg-foreground/[0.04] group-hover:bg-amber/10 flex items-center justify-center transition-colors">
                  <Plus className="w-6 h-6 text-muted-foreground/30 group-hover:text-amber transition-colors" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-muted-foreground/50 group-hover:text-foreground transition-colors">Start a New Project</p>
                  <p className="text-[11px] text-muted-foreground/30 mt-0.5">Describe your idea and let our AI team build it</p>
                </div>
              </button>
            </motion.div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredProjects.map((project, i) => (
              <ProjectRow key={project.id} project={project} index={i} onDelete={(id) => setDeleteConfirm(id)} />
            ))}
          </div>
        )}
      </main>

      <CreateProjectModal open={showCreateModal} onOpenChange={setShowCreateModal} />
      <PlatformSettingsDrawer open={showSettings} onOpenChange={setShowSettings} />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setDeleteConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.15 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-2xl border border-border bg-[var(--surface)] p-6 shadow-2xl shadow-black/30"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Delete Project</h3>
                  <p className="text-xs text-muted-foreground">This action cannot be undone</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mb-6">
                Are you sure you want to delete <span className="font-semibold text-foreground">{projects.find(p => p.id === deleteConfirm)?.name}</span>? All cards, documents, agents, and generated code will be permanently removed.
              </p>
              <div className="flex items-center gap-2 justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteConfirm(null)}
                  disabled={deleting}
                  className="h-9 px-4"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleDelete(deleteConfirm)}
                  disabled={deleting}
                  className="h-9 px-4 bg-red-500 hover:bg-red-600 text-white border-0"
                >
                  {deleting ? 'Deleting...' : 'Delete Project'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ProjectCard({ project, index, onDelete }: { project: Project; index: number; onDelete: (id: string) => void }) {
  const status = statusConfig[project.status];
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="relative group/card"
    >
      <Link
        href={`/project/${project.id}`}
        className="block rounded-2xl border border-border bg-[var(--surface)] p-5 hover:border-foreground/10 transition-all card-lift group"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold"
              style={{ backgroundColor: project.color + '15', borderColor: project.color + '30', borderWidth: 1 }}
            >
              <span style={{ color: project.color }}>{project.name.charAt(0)}</span>
            </div>
            <div>
              <h3 className="text-sm font-bold group-hover:text-amber transition-colors">{project.name}</h3>
              <p className="text-[11px] text-muted-foreground/60 line-clamp-1">{project.description}</p>
            </div>
          </div>
          <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5 shrink-0', status.bg, status.color)}>
            <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
            {status.label}
          </Badge>
        </div>

        {/* Progress */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground/50">Progress</span>
            <span className="text-[10px] font-semibold" style={{ color: project.color }}>{project.completion}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${project.completion}%`, backgroundColor: project.color }}
            />
          </div>
        </div>

        {/* Stage badge */}
        <div className="flex items-center gap-2 mb-4">
          <Badge variant="outline" className="text-[9px] bg-foreground/[0.03]">
            Stage: {project.current_stage}
          </Badge>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground/50 pt-3 border-t border-border">
          <span className="flex items-center gap-1">
            <Kanban className="w-3 h-3" /> {project.card_count} cards
          </span>
          <span className="flex items-center gap-1">
            <Bot className="w-3 h-3" /> {project.active_agents}/{project.total_agents} agents
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {project.last_activity}
          </span>
        </div>
      </Link>
      {/* Delete button — appears on hover */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(project.id); }}
        className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-[var(--surface)] border border-border opacity-0 group-hover/card:opacity-100 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 text-muted-foreground/40 flex items-center justify-center transition-all z-10"
        title="Delete project"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

function ProjectRow({ project, index, onDelete }: { project: Project; index: number; onDelete: (id: string) => void }) {
  const status = statusConfig[project.status];
  const StatusIcon = status.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group/row"
    >
      <Link
        href={`/project/${project.id}`}
        className="flex items-center gap-4 rounded-xl border border-border bg-[var(--surface)] px-5 py-4 hover:border-foreground/10 transition-all group"
      >
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold shrink-0"
          style={{ backgroundColor: project.color + '15', borderColor: project.color + '30', borderWidth: 1 }}
        >
          <span style={{ color: project.color }}>{project.name.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold group-hover:text-amber transition-colors">{project.name}</h3>
            <Badge variant="outline" className={cn('text-[9px] h-4 px-1.5', status.bg, status.color)}>
              <StatusIcon className="w-2.5 h-2.5 mr-0.5" />
              {status.label}
            </Badge>
            <Badge variant="outline" className="text-[9px] bg-foreground/[0.03]">
              {project.current_stage}
            </Badge>
          </div>
          <p className="text-[11px] text-muted-foreground/60 mt-0.5 truncate">{project.description}</p>
        </div>
        {/* Progress bar */}
        <div className="w-32 shrink-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[9px] text-muted-foreground/40">Progress</span>
            <span className="text-[10px] font-semibold" style={{ color: project.color }}>{project.completion}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-foreground/[0.06] overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${project.completion}%`, backgroundColor: project.color }} />
          </div>
        </div>
        {/* Stats */}
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground/50 shrink-0">
          <span className="flex items-center gap-1"><Kanban className="w-3 h-3" />{project.card_count}</span>
          <span className="flex items-center gap-1"><Bot className="w-3 h-3" />{project.active_agents}/{project.total_agents}</span>
          <span className="flex items-center gap-1 w-20"><Clock className="w-3 h-3" />{project.last_activity}</span>
        </div>
        {/* Delete button */}
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(project.id); }}
          className="w-7 h-7 rounded-lg opacity-0 group-hover/row:opacity-100 hover:bg-red-500/10 hover:text-red-400 text-muted-foreground/30 flex items-center justify-center transition-all shrink-0"
          title="Delete project"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <ArrowRight className="w-4 h-4 text-muted-foreground/20 group-hover:text-amber transition-colors shrink-0" />
      </Link>
    </motion.div>
  );
}
