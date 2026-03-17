import type {
  Project,
  Card,
  Decision,
  Agent,
  AdminUser,
  AuditLogEntry,
  AdminStats,
  LLMUsageData,
  BillingMetrics,
  AdminTransaction,
} from '@/types';

// ─── Enum Mappers (DB UPPERCASE → Frontend lowercase/Title Case) ─────────────

export const mapProjectStatus = (s: string) =>
  s.toLowerCase() as Project['status'];

export const mapCardType = (t: string): Card['type'] => {
  const map: Record<string, Card['type']> = {
    EPIC: 'Epic', FEATURE: 'Feature', TASK: 'Task', QA: 'QA', DECISION_BLOCKER: 'DecisionBlocker',
  };
  return map[t] ?? 'Task';
};

export const mapCardState = (s: string): Card['state'] => {
  const map: Record<string, Card['state']> = {
    PLANNED: 'Planned', IN_PROGRESS: 'In Progress', UNDER_REVIEW: 'Under Review',
    TESTING: 'Testing', BLOCKED: 'Blocked', DONE: 'Done', RELEASED: 'Released',
  };
  return map[s] ?? 'Planned';
};

export const mapPriority = (p: string): Card['priority'] =>
  p.toLowerCase() as Card['priority'];

export const mapAgentGroup = (g: string): Agent['group'] =>
  g.toLowerCase() as Agent['group'];

export const mapAgentStatus = (s: string): Agent['status'] =>
  s.toLowerCase() as Agent['status'];

export const mapRisk = (r: string) => {
  const map: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };
  return map[r] ?? 'Medium';
};

export const mapEffort = (e: string) => {
  const map: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };
  return map[e] ?? 'Medium';
};

export const mapDecisionStatus = (s: string) => {
  const map: Record<string, string> = {
    DRAFTED: 'Drafted', OPTIONS_COLLECTED: 'Options Collected',
    RECOMMENDED: 'Recommended', AWAITING_APPROVAL: 'Awaiting Approval',
    APPROVED: 'Approved', REJECTED: 'Rejected',
    IMPLEMENTED: 'Implemented', VERIFIED: 'Verified',
  };
  return map[s] ?? 'Drafted';
};

// ─── Date Formatter ──────────────────────────────────────────────────────────

export function formatRelativeDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ─── API Fetch Helpers ───────────────────────────────────────────────────────

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}

// ─── Projects ────────────────────────────────────────────────────────────────

export async function fetchProjects(): Promise<Project[]> {
  const data = await apiFetch<any[]>('/api/projects');
  return data.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    current_stage: p.currentStage ?? 'Planning',
    status: mapProjectStatus(p.status),
    created_at: p.createdAt,
    card_count: p.cardCount ?? p._count?.cards ?? 0,
    active_agents: p.activeAgentCount ?? 0,
    total_agents: p.totalAgents ?? p._count?.agents ?? 0,
    completion: p.completion ?? 0,
    team_size: p.memberCount ?? p._count?.members ?? 1,
    last_activity: formatRelativeDate(p.updatedAt ?? p.createdAt),
    color: p.color ?? '#6366f1',
  }));
}

export async function deleteProject(id: string): Promise<void> {
  await fetch(`/api/projects/${id}`, { method: 'DELETE' }).then((res) => {
    if (!res.ok) throw new Error('Failed to delete project');
  });
}

export async function fetchProject(id: string): Promise<Project | null> {
  try {
    const p = await apiFetch<any>(`/api/projects/${id}`);
    return {
      id: p.id,
      name: p.name,
      description: p.description ?? '',
      current_stage: p.currentStage ?? 'Planning',
      status: mapProjectStatus(p.status),
      created_at: p.createdAt,
      card_count: p._count?.cards ?? p.cards?.length ?? 0,
      active_agents: p.agents?.filter((a: any) => a.status === 'WORKING').length ?? 0,
      total_agents: p._count?.agents ?? p.agents?.length ?? 0,
      completion: p.completion ?? 0,
      team_size: p._count?.members ?? p.members?.length ?? 1,
      last_activity: formatRelativeDate(p.updatedAt ?? p.createdAt),
      color: p.color ?? '#6366f1',
    };
  } catch {
    return null;
  }
}

// ─── Cards ───────────────────────────────────────────────────────────────────

export async function fetchCards(projectId: string): Promise<Card[]> {
  const data = await apiFetch<any[]>(`/api/projects/${projectId}/cards`);
  return data.map((c) => ({
    card_id: c.id,
    type: mapCardType(c.type),
    title: c.title,
    description: c.description ?? '',
    state: mapCardState(c.state),
    owner_agent: c.ownerAgent?.shortName ?? c.ownerAgentId ?? '',
    parent_id: c.parentId ?? null,
    children: c.children?.map((ch: any) => ch.id) ?? [],
    priority: mapPriority(c.priority),
    created_at: c.createdAt,
    updated_at: c.updatedAt,
    linked_decision_id: c.linkedDecisionId ?? undefined,
  }));
}

// ─── Agents ──────────────────────────────────────────────────────────────────

export async function fetchAgents(projectId: string): Promise<Agent[]> {
  const data = await apiFetch<any[]>(`/api/projects/${projectId}/agents`);
  return data.map((a) => ({
    id: a.id,
    name: a.name,
    shortName: a.shortName,
    group: mapAgentGroup(a.group),
    status: mapAgentStatus(a.status),
    currentTask: a.currentTask ?? null,
    avatar: a.avatar ?? '🤖',
  }));
}

// ─── Decisions ───────────────────────────────────────────────────────────────

export async function fetchDecisions(projectId: string): Promise<Decision[]> {
  const data = await apiFetch<any[]>(`/api/projects/${projectId}/decisions`);
  return data.map((d) => ({
    decision_id: d.id,
    trigger: d.trigger,
    context: d.context ?? '',
    options: (d.options ?? []).map((o: any) => ({
      name: o.name,
      description: o.description ?? '',
      pros: o.pros ?? [],
      cons: o.cons ?? [],
      risk: mapRisk(o.risk) as any,
      effort: mapEffort(o.effort) as any,
    })),
    risk_rating: mapRisk(d.riskRating) as any,
    recommendation: d.recommendation ?? '',
    approved_option: d.approvedOption ?? null,
    owner: d.owner?.name ?? '',
    impacted_cards: d.impactedCards ?? [],
    impacted_artifacts: d.impactedArtifacts ?? [],
    status: mapDecisionStatus(d.status) as any,
    created_at: d.createdAt,
    approved_at: d.approvedAt ?? null,
  }));
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export async function fetchAdminStats(): Promise<AdminStats> {
  const data = await apiFetch<any>('/api/admin/stats');
  return {
    total_users: data.users?.total ?? data.totalUsers ?? 0,
    total_projects: data.projects?.total ?? data.totalProjects ?? 0,
    monthly_llm_cost: data.costs?.totalLLMCost ?? data.monthlyLlmCost ?? 0,
    active_agents: data.agents?.active ?? data.activeAgents ?? 0,
    users_growth: data.usersGrowth ?? 12.5,
    projects_growth: data.projectsGrowth ?? 8.3,
    cost_change: data.costChange ?? -3.2,
    agents_change: data.agentsChange ?? 15.0,
  };
}

export async function fetchAdminUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
}): Promise<{ users: AdminUser[]; pagination: any }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.search) searchParams.set('search', params.search);
  if (params?.role) searchParams.set('role', params.role);

  const data = await apiFetch<any>(`/api/admin/users?${searchParams}`);
  return {
    users: (data.users ?? []).map((u: any) => ({
      id: u.id,
      name: u.name ?? '',
      email: u.email ?? '',
      role: (u.role ?? 'USER').toLowerCase() as AdminUser['role'],
      status: (u.status ?? 'ACTIVE').toLowerCase() as AdminUser['status'],
      plan: (u.plan ?? 'STARTER').toLowerCase() as AdminUser['plan'],
      projects_count: u.ownedProjectCount ?? u.membershipCount ?? 0,
      created_at: u.createdAt,
      last_login: u.lastLogin ?? u.createdAt,
      avatar_color: u.avatarColor ?? '#6366f1',
    })),
    pagination: data.pagination,
  };
}

export async function fetchAuditLog(params?: {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<{ logs: AuditLogEntry[]; pagination: any }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.startDate) searchParams.set('startDate', params.startDate);
  if (params?.endDate) searchParams.set('endDate', params.endDate);

  const data = await apiFetch<any>(`/api/admin/audit?${searchParams}`);
  return {
    logs: (data.logs ?? []).map((l: any) => ({
      id: l.id,
      actor: l.actor ?? '',
      actor_email: l.actorEmail ?? '',
      action: l.action ?? '',
      target: l.target ?? '',
      details: l.details ?? '',
      timestamp: l.createdAt ?? l.timestamp,
      ip_address: l.ipAddress ?? '',
    })),
    pagination: data.pagination,
  };
}

// ─── Billing ─────────────────────────────────────────────────────────────────

export async function fetchBilling(): Promise<{
  metrics: BillingMetrics;
  transactions: AdminTransaction[];
}> {
  const data = await apiFetch<any>('/api/admin/billing');
  return {
    metrics: {
      mrr: data.mrr ?? 0,
      total_revenue: data.total_revenue ?? 0,
      active_subscriptions: data.active_subscriptions ?? 0,
      churn_rate: data.churn_rate ?? 0,
      plan_distribution: (data.plan_distribution ?? []).map((p: any) => ({
        plan: p.plan as any,
        count: p.count,
        percentage: p.percentage,
      })),
    },
    transactions: (data.transactions ?? []).map((t: any) => ({
      id: t.id,
      user_name: t.user_name ?? '',
      user_email: t.user_email ?? '',
      amount: t.amount ?? 0,
      plan: t.plan as any,
      status: t.status as any,
      date: t.date,
    })),
  };
}

// ─── Analytics ───────────────────────────────────────────────────────────────

export async function fetchAnalytics(params?: {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  provider?: string;
}): Promise<{ usage: LLMUsageData[]; pagination?: { page: number; limit: number; total: number; totalPages: number } }> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set('page', String(params.page));
  if (params?.limit) searchParams.set('limit', String(params.limit));
  if (params?.from) searchParams.set('from', params.from);
  if (params?.to) searchParams.set('to', params.to);
  if (params?.provider) searchParams.set('provider', params.provider);

  const data = await apiFetch<any>(`/api/admin/analytics?${searchParams}`);
  return {
    usage: (data.usage ?? []).map((u: any) => ({
      date: u.date,
      tokens_used: u.tokens_used ?? 0,
      cost: u.cost ?? 0,
      provider: u.provider as any,
      project_id: u.project_id ?? '',
      project_name: u.project_name ?? '',
    })),
    pagination: data.pagination,
  };
}

// ─── Admin User Actions ─────────────────────────────────────────────────────

export async function adminUpdateUser(params: {
  userId: string;
  action: 'suspend' | 'unsuspend' | 'changeRole' | 'changePlan' | 'resetPassword';
  value?: string;
}): Promise<{ success: boolean; user?: any }> {
  const res = await fetch('/api/admin/users', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to update user');
  }
  return res.json();
}

// ─── Admin Settings ──────────────────────────────────────────────────────────

export async function fetchAdminSettings(): Promise<Record<string, any>> {
  return apiFetch('/api/admin/settings');
}

export async function saveAdminSettings(settings: Record<string, any>): Promise<{ success: boolean }> {
  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to save settings');
  return res.json();
}

// ─── System Health ───────────────────────────────────────────────────────────

export async function fetchSystemHealth(): Promise<any> {
  return apiFetch('/api/admin/health');
}

// ─── Recent Activity (from audit logs) ───────────────────────────────────────

export async function fetchRecentActivity(limit = 10): Promise<any[]> {
  const data = await apiFetch<any>(`/api/admin/audit?limit=${limit}`);
  return (data.logs ?? []).map((l: any) => ({
    id: l.id,
    type: mapAuditToActivityType(l.action),
    actor: l.actor ?? l.user?.name ?? 'System',
    action: l.details || `${l.action} on ${l.target}`,
    timestamp: l.createdAt ?? l.timestamp,
  }));
}

function mapAuditToActivityType(action: string): string {
  if (!action) return 'settings_change';
  if (action.startsWith('user.signup') || action.startsWith('user.invite')) return 'user_signup';
  if (action.startsWith('user.suspend') || action.startsWith('admin.suspend')) return 'user_suspended';
  if (action.startsWith('project.deploy')) return 'project_deploy';
  if (action.startsWith('project.create')) return 'project_create';
  if (action.startsWith('project.archive')) return 'project_archived';
  if (action.startsWith('billing.upgrade') || action.startsWith('admin.changePlan')) return 'billing_upgrade';
  if (action.startsWith('agent.')) return 'agent_created';
  if (action.startsWith('api_key.') || action.startsWith('settings.security')) return 'security_update';
  if (action.startsWith('settings.')) return 'settings_change';
  return 'settings_change';
}
