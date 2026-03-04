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

const mapProjectStatus = (s: string) =>
  s.toLowerCase() as Project['status'];

const mapCardType = (t: string): Card['type'] => {
  const map: Record<string, Card['type']> = {
    EPIC: 'Epic', FEATURE: 'Feature', TASK: 'Task', QA: 'QA', DECISION_BLOCKER: 'DecisionBlocker',
  };
  return map[t] ?? 'Task';
};

const mapCardState = (s: string): Card['state'] => {
  const map: Record<string, Card['state']> = {
    PLANNED: 'Planned', IN_PROGRESS: 'In Progress', UNDER_REVIEW: 'Under Review',
    TESTING: 'Testing', BLOCKED: 'Blocked', DONE: 'Done', RELEASED: 'Released',
  };
  return map[s] ?? 'Planned';
};

const mapPriority = (p: string): Card['priority'] =>
  p.toLowerCase() as Card['priority'];

const mapAgentGroup = (g: string): Agent['group'] =>
  g.toLowerCase() as Agent['group'];

const mapAgentStatus = (s: string): Agent['status'] =>
  s.toLowerCase() as Agent['status'];

const mapRisk = (r: string) => {
  const map: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', CRITICAL: 'Critical' };
  return map[r] ?? 'Medium';
};

const mapEffort = (e: string) => {
  const map: Record<string, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };
  return map[e] ?? 'Medium';
};

const mapDecisionStatus = (s: string) => {
  const map: Record<string, string> = {
    DRAFTED: 'Drafted', OPTIONS_COLLECTED: 'Options Collected',
    RECOMMENDED: 'Recommended', AWAITING_APPROVAL: 'Awaiting Approval',
    APPROVED: 'Approved', REJECTED: 'Rejected',
    IMPLEMENTED: 'Implemented', VERIFIED: 'Verified',
  };
  return map[s] ?? 'Drafted';
};

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
    card_count: p._count?.cards ?? p.cardCount ?? 0,
    active_agents: p._count?.agents ?? p.activeAgents ?? 0,
    total_agents: p._count?.agents ?? p.totalAgents ?? 0,
    completion: p.completion ?? 0,
    team_size: p._count?.members ?? p.teamSize ?? 1,
    last_activity: p.updatedAt ?? p.createdAt,
    color: p.color ?? '#6366f1',
  }));
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
      last_activity: p.updatedAt ?? p.createdAt,
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
    total_users: data.totalUsers ?? 0,
    total_projects: data.totalProjects ?? 0,
    monthly_llm_cost: data.monthlyLlmCost ?? 0,
    active_agents: data.activeAgents ?? 0,
    users_growth: data.usersGrowth ?? 0,
    projects_growth: data.projectsGrowth ?? 0,
    cost_change: data.costChange ?? 0,
    agents_change: data.agentsChange ?? 0,
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
