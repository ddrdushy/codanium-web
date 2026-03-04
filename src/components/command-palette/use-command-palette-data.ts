'use client';

import { useSession } from 'next-auth/react';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';
import {
  LayoutDashboard, Kanban, Workflow, Scale, Bot,
  MessageSquare, FileText, PenTool, GitBranch, BarChart3,
  Settings, Users, FolderOpen, CreditCard, ScrollText,
  Layers, CircleDot
} from 'lucide-react';
import { mockProjects, mockCards, mockDecisions, mockAgents } from '@/lib/mock-data';
import { mockAdminUsers } from '@/lib/mock-admin-data';
import type { LucideIcon } from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  category: 'navigation' | 'project' | 'card' | 'agent' | 'decision' | 'admin-nav' | 'admin-user';
  href?: string;
  keywords?: string[];
  meta?: {
    badge?: string;
    badgeColor?: string;
    avatar?: string;
    status?: string;
  };
}

export function useCommandPaletteData(): CommandItem[] {
  const { data: session } = useSession();
  const pathname = usePathname();

  const isAdmin = (session?.user as { role?: string })?.role === 'admin';

  // Extract current project ID from URL
  const currentProjectId = useMemo(() => {
    const parts = pathname?.split('/') || [];
    const idx = parts.indexOf('project');
    return idx !== -1 && parts[idx + 1] ? parts[idx + 1] : null;
  }, [pathname]);

  return useMemo(() => {
    const items: CommandItem[] = [];

    // ── Workspace Navigation (when inside a project) ──
    if (currentProjectId) {
      const pid = currentProjectId;
      const nav = [
        { label: 'Dashboard', icon: LayoutDashboard, path: `/project/${pid}`, kw: ['home', 'overview'] },
        { label: 'Board', icon: Kanban, path: `/project/${pid}/board`, kw: ['kanban', 'cards', 'tasks'] },
        { label: 'Pipeline', icon: Workflow, path: `/project/${pid}/pipeline`, kw: ['flow', 'stages', 'sdlc'] },
        { label: 'Decisions', icon: Scale, path: `/project/${pid}/decisions`, kw: ['approve', 'review'] },
        { label: 'Agents', icon: Bot, path: `/project/${pid}/agents`, kw: ['ai', 'team'] },
        { label: 'Chat', icon: MessageSquare, path: `/project/${pid}/chat`, kw: ['message', 'talk'] },
        { label: 'Docs', icon: FileText, path: `/project/${pid}/docs`, kw: ['documentation'] },
        { label: 'Wireframes', icon: PenTool, path: `/project/${pid}/wireframes`, kw: ['design', 'ui', 'mockup'] },
        { label: 'Git', icon: GitBranch, path: `/project/${pid}/git`, kw: ['code', 'repository'] },
        { label: 'KPIs', icon: BarChart3, path: `/project/${pid}/kpi`, kw: ['metrics', 'analytics'] },
        { label: 'Settings', icon: Settings, path: `/project/${pid}/settings`, kw: ['config'] },
      ];

      nav.forEach(n => {
        items.push({
          id: `nav-${n.label.toLowerCase()}`,
          label: n.label,
          description: `Go to ${n.label}`,
          icon: n.icon,
          category: 'navigation',
          href: n.path,
          keywords: n.kw,
        });
      });
    }

    // ── Always show All Projects nav ──
    items.push({
      id: 'nav-projects',
      label: 'All Projects',
      description: 'View all projects',
      icon: FolderOpen,
      category: 'navigation',
      href: '/projects',
      keywords: ['projects', 'list', 'browse'],
    });

    // ── Admin Navigation (only for admin users) ──
    if (isAdmin) {
      const adminNav = [
        { label: 'Admin Dashboard', icon: LayoutDashboard, path: '/admin', kw: ['admin', 'overview'] },
        { label: 'Admin Users', icon: Users, path: '/admin/users', kw: ['manage', 'accounts'] },
        { label: 'Admin Projects', icon: FolderOpen, path: '/admin/projects', kw: ['manage'] },
        { label: 'Admin Billing', icon: CreditCard, path: '/admin/billing', kw: ['payments', 'revenue'] },
        { label: 'Admin Analytics', icon: BarChart3, path: '/admin/analytics', kw: ['stats', 'tokens'] },
        { label: 'Admin Audit Log', icon: ScrollText, path: '/admin/audit', kw: ['history', 'activity'] },
        { label: 'Admin Settings', icon: Settings, path: '/admin/settings', kw: ['config'] },
      ];

      adminNav.forEach(n => {
        items.push({
          id: `admin-nav-${n.label.toLowerCase().replace(/\s/g, '-')}`,
          label: n.label,
          description: `Go to ${n.label}`,
          icon: n.icon,
          category: 'admin-nav',
          href: n.path,
          keywords: n.kw,
          meta: { badge: 'Admin', badgeColor: 'indigo' },
        });
      });
    }

    // ── Projects ──
    mockProjects.forEach(project => {
      items.push({
        id: `project-${project.id}`,
        label: project.name,
        description: project.description,
        icon: FolderOpen,
        category: 'project',
        href: `/project/${project.id}`,
        keywords: [project.current_stage, project.status],
        meta: { badge: project.current_stage, status: project.status },
      });
    });

    // ── Cards ──
    mockCards.forEach(card => {
      items.push({
        id: `card-${card.card_id}`,
        label: `${card.card_id}: ${card.title}`,
        description: card.description,
        icon: card.type === 'Epic' ? Layers : card.type === 'Feature' ? CircleDot : Kanban,
        category: 'card',
        href: currentProjectId ? `/project/${currentProjectId}/board` : undefined,
        keywords: [card.type, card.state, card.priority, card.owner_agent],
        meta: {
          badge: card.type,
          badgeColor: card.priority === 'critical' ? 'red' : card.priority === 'high' ? 'amber' : 'default',
        },
      });
    });

    // ── Agents ──
    mockAgents.forEach(agent => {
      items.push({
        id: `agent-${agent.id}`,
        label: agent.name,
        description: agent.currentTask || `${agent.group} group`,
        icon: Bot,
        category: 'agent',
        href: currentProjectId ? `/project/${currentProjectId}/agents` : undefined,
        keywords: [agent.shortName, agent.group, agent.status],
        meta: {
          avatar: agent.avatar,
          badge: agent.status,
          badgeColor: agent.status === 'working' ? 'green' : agent.status === 'waiting' ? 'amber' : 'default',
        },
      });
    });

    // ── Decisions ──
    mockDecisions.forEach(decision => {
      items.push({
        id: `decision-${decision.decision_id}`,
        label: `${decision.decision_id}: ${decision.trigger}`,
        description: decision.recommendation || decision.context,
        icon: Scale,
        category: 'decision',
        href: currentProjectId ? `/project/${currentProjectId}/decisions` : undefined,
        keywords: [decision.status, decision.risk_rating, decision.owner],
        meta: {
          badge: decision.status,
          badgeColor: decision.risk_rating === 'High' ? 'red' : decision.risk_rating === 'Medium' ? 'amber' : 'green',
        },
      });
    });

    // ── Admin Users (only for admin) ──
    if (isAdmin) {
      mockAdminUsers.forEach(user => {
        items.push({
          id: `admin-user-${user.id}`,
          label: user.name,
          description: `${user.email} · ${user.plan} plan`,
          icon: Users,
          category: 'admin-user',
          href: '/admin/users',
          keywords: [user.email, user.role, user.plan, user.status],
          meta: {
            badge: user.plan,
            badgeColor: user.plan === 'enterprise' ? 'indigo' : user.plan === 'pro' ? 'amber' : 'default',
          },
        });
      });
    }

    return items;
  }, [currentProjectId, isAdmin]);
}
