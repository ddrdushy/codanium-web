'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Kanban, GitBranch, MessageSquare,
  Users, FileText, PenTool, BarChart3, Settings,
  ChevronLeft, ChevronRight, Workflow, Scale,
  ChevronDown, Zap, Bot
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/project/prj-001', section: 'main' },
  { label: 'Board', icon: Kanban, href: '/project/prj-001/board', badge: '47', section: 'main' },
  { label: 'Pipeline', icon: Workflow, href: '/project/prj-001/pipeline', section: 'main' },
  { label: 'Decisions', icon: Scale, href: '/project/prj-001/decisions', badge: '1', badgeColor: 'amber', section: 'main' },
  { label: 'Agents', icon: Bot, href: '/project/prj-001/agents', badge: '8', badgeColor: 'green', section: 'main' },
  { label: 'Chat', icon: MessageSquare, href: '/project/prj-001/chat', section: 'collab' },
  { label: 'Docs', icon: FileText, href: '/project/prj-001/docs', section: 'collab' },
  { label: 'Wireframes', icon: PenTool, href: '/project/prj-001/wireframes', section: 'collab' },
  { label: 'Git', icon: GitBranch, href: '/project/prj-001/git', section: 'dev' },
  { label: 'KPIs', icon: BarChart3, href: '/project/prj-001/kpi', section: 'dev' },
  { label: 'Settings', icon: Settings, href: '/project/prj-001/settings', section: 'settings' },
];

const sections = [
  { key: 'main', label: 'Workspace' },
  { key: 'collab', label: 'Collaborate' },
  { key: 'dev', label: 'Engineering' },
  { key: 'settings', label: '' },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-screen border-r border-border bg-[var(--sidebar)] select-none"
    >
      {/* Logo + Project Selector */}
      <div className="flex items-center gap-2 px-3 h-14 border-b border-border shrink-0">
        <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber/10 shrink-0">
          <Zap className="w-4 h-4 text-amber" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: 'auto' }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-1 overflow-hidden"
            >
              <button className="flex items-center gap-1 text-sm font-semibold text-foreground hover:text-amber transition-colors truncate">
                <span className="truncate">AI Team Studio</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
              </button>
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
                const isActive = pathname === item.href || (item.href !== '/project/prj-001' && pathname?.startsWith(item.href));
                const Icon = item.icon;

                const linkContent = (
                  <Link
                    key={item.href}
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
                    {!collapsed && item.badge && (
                      <Badge
                        variant="secondary"
                        className={cn(
                          'h-5 min-w-5 px-1.5 text-[10px] font-semibold',
                          item.badgeColor === 'amber' && 'bg-amber/15 text-amber border-amber/20',
                          item.badgeColor === 'green' && 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
                          !item.badgeColor && 'bg-white/5 text-muted-foreground'
                        )}
                      >
                        {item.badge}
                      </Badge>
                    )}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.href}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" className="font-medium">
                        {item.label}
                        {item.badge && <span className="ml-1.5 text-muted-foreground">({item.badge})</span>}
                      </TooltipContent>
                    </Tooltip>
                  );
                }
                return <div key={item.href}>{linkContent}</div>;
              })}
            </div>
          );
        })}
      </nav>

      {/* Agent Status Summary */}
      {!collapsed && (
        <div className="px-3 py-3 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 pulse-dot" />
              8 agents active
            </span>
            <span className="text-border">·</span>
            <span>47 cards</span>
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
    </motion.aside>
  );
}
