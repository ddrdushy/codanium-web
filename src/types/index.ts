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
export interface Project {
  id: string;
  name: string;
  description: string;
  current_stage: SDLCStage;
  created_at: string;
  card_count: number;
  active_agents: number;
}

// ─── Event Types ───
export interface SystemEvent {
  event_id: string;
  type: string;
  actor: string;
  payload: Record<string, unknown>;
  timestamp: string;
}
