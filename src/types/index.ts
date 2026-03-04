// ─── Card Types ───
export type CardType = 'Epic' | 'Feature' | 'Task' | 'QA' | 'DecisionBlocker';
export type CardState = 'Planned' | 'In Progress' | 'Under Review' | 'Testing' | 'Blocked' | 'Done' | 'Released';

export interface Card {
  card_id: string;
  type: CardType;
  title: string;
  description: string;
  state: CardState;
  owner_agent: string;
  parent_id: string | null;
  children: string[];
  priority: 'low' | 'medium' | 'high' | 'critical';
  created_at: string;
  updated_at: string;
  linked_decision_id?: string;
}

// ─── Decision Types ───
export type DecisionStatus = 'Drafted' | 'Options Collected' | 'Recommended' | 'Awaiting Approval' | 'Approved' | 'Rejected' | 'Implemented' | 'Verified';
export type RiskRating = 'Low' | 'Medium' | 'High' | 'Critical';

export interface Decision {
  decision_id: string;
  trigger: string;
  context: string;
  options: DecisionOption[];
  risk_rating: RiskRating;
  recommendation: string;
  approved_option: string | null;
  owner: string;
  impacted_cards: string[];
  impacted_artifacts: string[];
  status: DecisionStatus;
  created_at: string;
  approved_at: string | null;
}

export interface DecisionOption {
  name: string;
  description: string;
  pros: string[];
  cons: string[];
  risk: RiskRating;
  effort: 'Low' | 'Medium' | 'High';
}

// ─── Agent Types ───
export type AgentGroup = 'governance' | 'sdlc' | 'engineering' | 'platform' | 'ai_cost';
export type AgentStatus = 'idle' | 'working' | 'waiting' | 'blocked';

export interface Agent {
  id: string;
  name: string;
  shortName: string;
  group: AgentGroup;
  status: AgentStatus;
  currentTask: string | null;
  avatar: string;
}

// ─── SDLC Types ───
export type SDLCStage = 'Business Analysis' | 'Architecture' | 'UI/UX Design' | 'Planning' | 'Development' | 'Code Review' | 'Testing' | 'Release' | 'Monitoring' | 'Iteration';

export interface SDLCProgress {
  stage: SDLCStage;
  status: 'completed' | 'active' | 'pending' | 'blocked';
  gate_passed: boolean;
}

// ─── Project Types ───
export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Project {
  id: string;
  name: string;
  description: string;
  current_stage: SDLCStage;
  status: ProjectStatus;
  created_at: string;
  card_count: number;
  active_agents: number;
  total_agents: number;
  completion: number; // 0-100
  team_size: number;
  last_activity: string;
  color: string; // accent color for project
}

// ─── Event Types ───
export interface SystemEvent {
  event_id: string;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

// ─── Admin Types ───
export type UserRole = 'user' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'pending';
export type UserPlan = 'starter' | 'pro' | 'enterprise';

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  plan: UserPlan;
  projects_count: number;
  created_at: string;
  last_login: string;
  avatar_color: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  actor_email: string;
  action: string;
  target: string;
  details: string;
  timestamp: string;
  ip_address: string;
}

export interface BillingMetrics {
  mrr: number;
  total_revenue: number;
  active_subscriptions: number;
  churn_rate: number;
  plan_distribution: { plan: UserPlan; count: number; percentage: number }[];
}

export interface LLMUsageData {
  date: string;
  tokens_used: number;
  cost: number;
  provider: 'openai' | 'anthropic' | 'google';
  project_id: string;
  project_name: string;
}

export interface AdminTransaction {
  id: string;
  user_name: string;
  user_email: string;
  amount: number;
  plan: UserPlan;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  date: string;
}

export interface AdminStats {
  total_users: number;
  total_projects: number;
  monthly_llm_cost: number;
  active_agents: number;
  users_growth: number;
  projects_growth: number;
  cost_change: number;
  agents_change: number;
}
