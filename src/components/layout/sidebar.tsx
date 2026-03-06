'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Kanban, GitBranch, MessageSquare,
  Users, FileText, PenTool, BarChart3, Settings,
  ChevronLeft, ChevronRight, Workflow, Scale,
  ChevronDown, ChevronUp, Zap, Bot, FolderOpen,
  Check, Plus, Code2, Play
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { useProjectStore } from '@/lib/project-store';
import { mockProjects } from '@/lib/mock-data';
import { ProjectSelectorSkeleton } from '@/components/ui/skeleton';
import { CreateProjectModal } from '@/components/modals/create-project-modal';
import { usePreviewStore } from '@/hooks/use-preview';

const getNavItems = (projectId: string) => [
  { label: 'Chat', icon: MessageSquare, href: `/project/${projectId}/chat`, section: 'main' },
  { label: 'Overview', icon: LayoutDashboard, href: `/project/${projectId}`, section: 'main' },
  { label: 'Work Board', icon: Kanban, href: `/project/${projectId}/board`, section: 'main' },
  { label: 'My Decisions', icon: Scale, href: `/project/${projectId}/decisions`, section: 'main' },
  { label: 'AI Team', icon: Bot, href: `/project/${projectId}/agents`, section: 'main' },
  { label: 'Live Preview', icon: Play, href: `__preview__`, section: 'deliverables' },
  { label: 'Generated Code', icon: Code2, href: `/project/${projectId}/code`, section: 'deliverables' },
  { label: 'Documents', icon: FileText, href: `/project/${projectId}/docs`, section: 'deliverables' },
  { label: 'Designs', icon: PenTool, href: `/project/${projectId}/wireframes`, section: 'deliverables' },
  { label: 'Delivery Progress', icon: Workflow, href: `/project/${projectId}/pipeline`, section: 'reports' },
  { label: 'Code & Releases', icon: GitBranch, href: `/project/${projectId}/git`, section: 'reports' },
  { label: 'Reports', icon: BarChart3, href: `/project/${projectId}/kpi`, section: 'reports' },
  { label: 'Settings', icon: Settings, href: `/project/${projectId}/settings`, section: 'settings' },
];

const sections = [
  { key: 'main', label: 'Project' },
  { key: 'deliverables', label: 'Deliverables' },
  { key: 'reports', label: 'Progress' },
  { key: 'settings', label: '' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { projects: storeProjects, loading, fetchProjects } = useProjectStore();
  const previewOpen = usePreviewStore((s) => s.isOpen);
  const togglePreview = usePreviewStore((s) => s.toggle);

  // Fetch real projects on mount
  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  // Use store projects if available, fall back to mock
  const projects = storeProjects.length > 0 ? storeProjects : mockProjects;

  // Extract current project ID from URL
  const pathParts = pathname?.split('/') || [];
  const projectIdx = pathParts.indexOf('project');
  const currentProjectId = projectIdx !== -1 && pathParts[projectIdx + 1] ? pathParts[projectIdx + 1] : projects[0]?.id ?? 'prj-001';

  // Find current project
  const currentProject = projects.find(p => p.id === currentProjectId) || projects[0];

  // Generate nav items for current project
  const navItems = getNavItems(currentProjectId);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setSelectorOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProjectSwitch = (projectId: string) => {
    const currentSubPath = pathname?.replace(`/project/${currentProjectId}`, '') || '';
    router.push(`/project/${projectId}${currentSubPath}`);
    setSelectorOpen(false);
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-screen border-r border-border bg-[var(--sidebar)] select-none"
    >
      {/* Project Selector */}
      <div className="relative px-3 h-14 border-b border-border shrink-0 flex items-center" ref={dropdownRef}>
        <div className="flex items-center gap-2 w-full">
          {/* Project color avatar */}
          <div
            className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 text-xs font-bold"
            style={{
              backgroundColor: currentProject.color + '15',
              borderColor: currentProject.color + '30',
              borderWidth: 1,
              color: currentProject.color,
            }}
          >
            {currentProject.name.charAt(0)}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                transition={{ duration: 0.15 }}
                className="flex-1 min-w-0 overflow-hidden"
              >
                <button
                  onClick={() => setSelectorOpen(!selectorOpen)}
                  className="flex items-center gap-1 w-full text-left group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-foreground group-hover:text-amber transition-colors truncate">
                      {currentProject.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground/60 truncate -mt-0.5">
                      {currentProject.description}
                    </div>
                  </div>
                  <ChevronDown className={cn(
                    'w-3.5 h-3.5 text-muted-foreground/50 shrink-0 transition-transform duration-200',
                    selectorOpen && 'rotate-180'
                  )} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Project Selector Dropdown */}
        <AnimatePresence>
          {selectorOpen && !collapsed && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full left-2 right-2 mt-1 z-50 rounded-xl border border-border bg-[var(--surface)] shadow-xl shadow-black/20 overflow-hidden"
            >
              {/* Header */}
              <div className="px-3 py-2 border-b border-border">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  Switch Project
                </p>
              </div>

              {/* Project list */}
              <div className="py-1 max-h-64 overflow-y-auto">
                {loading && storeProjects.length === 0 ? (
                  <ProjectSelectorSkeleton />
                ) : (
                  projects.map((project) => {
                    const isSelected = project.id === currentProjectId;
                    return (
                      <button
                        key={project.id}
                        onClick={() => handleProjectSwitch(project.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-all',
                          isSelected
                            ? 'bg-amber/10'
                            : 'hover:bg-foreground/[0.04]'
                        )}
                      >
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                          style={{
                            backgroundColor: project.color + '20',
                            color: project.color,
                          }}
                        >
                          {project.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn(
                            'text-xs font-semibold truncate',
                            isSelected ? 'text-amber' : 'text-foreground'
                          )}>
                            {project.name}
                          </div>
                          <div className="text-[10px] text-muted-foreground/50 truncate">
                            {project.current_stage} · {project.completion}%
                          </div>
                        </div>
                        <div className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          project.status === 'active' && 'bg-emerald-400',
                          project.status === 'paused' && 'bg-amber',
                          project.status === 'completed' && 'bg-blue-400',
                          project.status === 'archived' && 'bg-zinc-400',
                        )} />
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-amber shrink-0" />
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Footer */}
              <div className="px-2 py-1.5 border-t border-border">
                <Link
                  href="/projects"
                  onClick={() => setSelectorOpen(false)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-foreground/[0.04] transition-all"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  All Projects
                </Link>
                <button
                  onClick={() => { setSelectorOpen(false); setCreateOpen(true); }}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-muted-foreground hover:text-amber hover:bg-amber/[0.04] transition-all w-full text-left"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Project
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {sections.map((section) => {
          const items = navItems.filter(item => item.section === section.key);
          if (items.length === 0) return null;
          return (
            <div key={section.key}>
              {section.label && !collapsed && (
                <div className="px-2 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {section.label}
                </div>
              )}
              {section.label && collapsed && <div className="my-2 mx-2 border-t border-border" />}
              {items.map((item) => {
                const isPreview = item.href === '__preview__';
                const basePath = `/project/${currentProjectId}`;
                const isActive = isPreview
                  ? previewOpen
                  : pathname === item.href || (item.href !== basePath && pathname?.startsWith(item.href));
                const Icon = item.icon;

                const itemElement = isPreview ? (
                  <button
                    onClick={() => togglePreview()}
                    className={cn(
                      'w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-all duration-150 group relative',
                      isActive
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : 'text-muted-foreground hover:text-foreground hover:bg-[var(--sidebar-accent)]'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-preview-active"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-emerald-400"
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                      />
                    )}
                    <Icon className={cn('w-4 h-4 shrink-0', isActive && 'drop-shadow-[0_0_6px_rgba(16,185,129,0.5)]')} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.1 }}
                          className="truncate flex-1"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-all duration-150 group relative',
                      isActive
                        ? 'bg-amber/10 text-amber'
                        : 'text-muted-foreground hover:text-foreground hover:bg-[var(--sidebar-accent)]'
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-amber"
                        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                      />
                    )}
                    <Icon className={cn('w-4 h-4 shrink-0', isActive && 'drop-shadow-[0_0_6px_rgba(245,158,11,0.5)]')} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.1 }}
                          className="truncate flex-1"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{itemElement}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return <div key={item.href}>{itemElement}</div>;
              })}
            </div>
          );
        })}
      </nav>

      {/* Agent Status Summary */}
      {!collapsed && currentProject && (
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full',
                currentProject.active_agents > 0 ? 'bg-emerald-400 pulse-dot' : 'bg-zinc-500'
              )} />
              {currentProject.active_agents} team members working
            </span>
            <span className="text-border">·</span>
            <span>{currentProject.card_count} tasks</span>
          </div>
        </div>
      )}

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full border border-border bg-[var(--surface)] flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-amber/30 transition-all z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      <CreateProjectModal open={createOpen} onOpenChange={setCreateOpen} />
    </motion.aside>
  );
}
