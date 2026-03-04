'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  CreditCard,
  BarChart3,
  ScrollText,
  Settings,
  Shield,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

const navItems = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  { label: 'Users', icon: Users, href: '/admin/users' },
  { label: 'Projects', icon: FolderOpen, href: '/admin/projects' },
  { label: 'Billing', icon: CreditCard, href: '/admin/billing' },
  { label: 'Analytics', icon: BarChart3, href: '/admin/analytics' },
  { label: 'Audit Log', icon: ScrollText, href: '/admin/audit' },
  { label: 'Settings', icon: Settings, href: '/admin/settings' },
];

export function AdminSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 64 : 240 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-screen border-r border-border bg-[var(--sidebar)] select-none"
    >
      {/* Header */}
      <div className="px-3 h-14 border-b border-border shrink-0 flex items-center">
        <div className="flex items-center gap-2 w-full">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0 bg-[var(--admin-accent)]/15 border border-[var(--admin-accent)]/30">
            <Shield className="w-4 h-4 text-[var(--admin-accent)]" />
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
                <div className="text-sm font-semibold text-foreground">
                  Admin Panel
                </div>
                <div className="text-[10px] text-muted-foreground/60 -mt-0.5">
                  System Management
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin' && pathname?.startsWith(item.href));
          const Icon = item.icon;

          const linkContent = (
            <Link
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-2.5 py-2 rounded-md text-sm font-medium transition-all duration-150 group relative',
                isActive
                  ? 'bg-[var(--admin-accent)]/10 text-[var(--admin-accent)]'
                  : 'text-muted-foreground hover:text-foreground hover:bg-[var(--sidebar-accent)]'
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="admin-sidebar-active"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-[var(--admin-accent)]"
                  transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
                />
              )}
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0',
                  isActive && 'drop-shadow-[0_0_6px_rgba(99,102,241,0.5)]'
                )}
              />
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
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.href}>{linkContent}</div>;
        })}
      </nav>

      {/* Footer - Back to Projects */}
      <div className="px-3 py-3 border-t border-border">
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                href="/projects"
                className="flex items-center justify-center w-full p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-[var(--sidebar-accent)] transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="font-medium">
              Back to Projects
            </TooltipContent>
          </Tooltip>
        ) : (
          <Link
            href="/projects"
            className="flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-[var(--sidebar-accent)] transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Projects</span>
          </Link>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full border border-border bg-[var(--surface)] flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-[var(--admin-accent)]/30 transition-all z-10"
      >
        {collapsed ? (
          <ChevronRight className="w-3 h-3" />
        ) : (
          <ChevronLeft className="w-3 h-3" />
        )}
      </button>
    </motion.aside>
  );
}
