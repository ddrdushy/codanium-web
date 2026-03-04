import { Card, Decision, Agent, SDLCProgress, Project } from '@/types';

export const mockProject: Project = {
  id: 'prj-001',
  name: 'AI Team Studio',
  description: 'AI-Powered Product Delivery OS',
  current_stage: 'Development',
  created_at: '2025-01-15T10:00:00Z',
  card_count: 47,
  active_agents: 8,
};

export const mockCards: Card[] = [
  // Planned
  { card_id: 'FEAT-012', type: 'Feature', title: 'Webhook Integration', description: 'Support incoming webhooks for external triggers', state: 'Planned', owner_agent: 'integration-engineer', parent_id: 'EPIC-003', children: [], priority: 'medium', created_at: '2025-03-01T08:00:00Z', updated_at: '2025-03-01T08:00:00Z' },
  { card_id: 'TASK-031', type: 'Task', title: 'Design webhook schema', description: 'Define JSON schema for webhook payloads', state: 'Planned', owner_agent: 'solution-architect', parent_id: 'FEAT-012', children: [], priority: 'medium', created_at: '2025-03-01T09:00:00Z', updated_at: '2025-03-01T09:00:00Z' },
  { card_id: 'FEAT-013', type: 'Feature', title: 'Export Dashboard PDF', description: 'Allow exporting KPI dashboard as PDF report', state: 'Planned', owner_agent: 'junior-developer', parent_id: 'EPIC-004', children: [], priority: 'low', created_at: '2025-03-01T10:00:00Z', updated_at: '2025-03-01T10:00:00Z' },

  // In Progress
  { card_id: 'EPIC-002', type: 'Epic', title: 'Decision Engine', description: 'Full decision lifecycle with approval workflows', state: 'In Progress', owner_agent: 'tech-lead', parent_id: null, children: ['FEAT-005', 'FEAT-006'], priority: 'high', created_at: '2025-02-10T10:00:00Z', updated_at: '2025-03-02T14:00:00Z' },
  { card_id: 'FEAT-006', type: 'Feature', title: 'Decision Approval Flow', description: 'Multi-option decision approval with risk scoring', state: 'In Progress', owner_agent: 'junior-developer', parent_id: 'EPIC-002', children: ['TASK-015', 'TASK-016'], priority: 'high', created_at: '2025-02-15T10:00:00Z', updated_at: '2025-03-03T16:00:00Z' },
  { card_id: 'TASK-016', type: 'Task', title: 'Implement decision API endpoints', description: 'CRUD endpoints for decisions with validation', state: 'In Progress', owner_agent: 'junior-developer', parent_id: 'FEAT-006', children: [], priority: 'high', created_at: '2025-02-20T08:00:00Z', updated_at: '2025-03-04T09:00:00Z' },
  { card_id: 'TASK-017', type: 'Task', title: 'Build LLM provider abstraction', description: 'Base class for multi-provider support', state: 'In Progress', owner_agent: 'junior-developer', parent_id: 'FEAT-007', children: [], priority: 'critical', created_at: '2025-02-22T08:00:00Z', updated_at: '2025-03-04T11:00:00Z' },

  // Under Review
  { card_id: 'FEAT-004', type: 'Feature', title: 'Card State Machine', description: 'Validate all card state transitions per rules', state: 'Under Review', owner_agent: 'senior-developer', parent_id: 'EPIC-001', children: ['TASK-010', 'TASK-011'], priority: 'critical', created_at: '2025-02-12T10:00:00Z', updated_at: '2025-03-03T18:00:00Z' },
  { card_id: 'TASK-018', type: 'Task', title: 'Agent authority validation middleware', description: 'Enforce persona write boundaries', state: 'Under Review', owner_agent: 'senior-developer', parent_id: 'FEAT-008', children: [], priority: 'high', created_at: '2025-02-25T08:00:00Z', updated_at: '2025-03-04T08:00:00Z' },

  // Testing
  { card_id: 'FEAT-003', type: 'Feature', title: 'Board CRUD Operations', description: 'Create, read, update board.json with atomic writes', state: 'Testing', owner_agent: 'qa-engineer', parent_id: 'EPIC-001', children: ['TASK-007', 'TASK-008'], priority: 'critical', created_at: '2025-02-11T10:00:00Z', updated_at: '2025-03-04T07:00:00Z' },
  { card_id: 'TASK-019', type: 'Task', title: 'Event bus message ordering', description: 'Ensure FIFO processing of events', state: 'Testing', owner_agent: 'qa-engineer', parent_id: 'FEAT-005', children: [], priority: 'high', created_at: '2025-02-26T08:00:00Z', updated_at: '2025-03-04T06:00:00Z' },

  // Blocked
  { card_id: 'DEC-BLK-001', type: 'DecisionBlocker', title: 'Choose OAuth Provider', description: 'Need to decide between Auth0, Firebase Auth, or Clerk', state: 'Blocked', owner_agent: 'decision-controller', parent_id: 'FEAT-009', children: [], priority: 'high', created_at: '2025-03-01T11:00:00Z', updated_at: '2025-03-01T11:00:00Z', linked_decision_id: 'DEC-003' },
  { card_id: 'TASK-020', type: 'Task', title: 'Implement SSO login', description: 'Blocked on OAuth provider decision', state: 'Blocked', owner_agent: 'junior-developer', parent_id: 'FEAT-009', children: [], priority: 'high', created_at: '2025-03-01T12:00:00Z', updated_at: '2025-03-01T12:00:00Z' },

  // Done
  { card_id: 'EPIC-001', type: 'Epic', title: 'State Engine Core', description: 'Board state management with atomic file operations', state: 'Done', owner_agent: 'tech-lead', parent_id: null, children: ['FEAT-001', 'FEAT-002', 'FEAT-003', 'FEAT-004'], priority: 'critical', created_at: '2025-02-01T10:00:00Z', updated_at: '2025-03-04T12:00:00Z' },
  { card_id: 'FEAT-001', type: 'Feature', title: 'Project Initialization', description: 'Create new project with scaffold files', state: 'Done', owner_agent: 'junior-developer', parent_id: 'EPIC-001', children: ['TASK-001', 'TASK-002'], priority: 'critical', created_at: '2025-02-05T10:00:00Z', updated_at: '2025-02-28T17:00:00Z' },
  { card_id: 'FEAT-002', type: 'Feature', title: 'Event Log System', description: 'Append-only event logging to events.jsonl', state: 'Done', owner_agent: 'junior-developer', parent_id: 'EPIC-001', children: ['TASK-004', 'TASK-005'], priority: 'high', created_at: '2025-02-08T10:00:00Z', updated_at: '2025-03-01T15:00:00Z' },

  // Released
  { card_id: 'FEAT-000', type: 'Feature', title: 'CLI Project Scaffold', description: 'npx create-ai-team-studio command', state: 'Released', owner_agent: 'devops-engineer', parent_id: null, children: [], priority: 'medium', created_at: '2025-01-20T10:00:00Z', updated_at: '2025-02-15T10:00:00Z' },
];

export const mockDecisions: Decision[] = [
  {
    decision_id: 'DEC-001',
    trigger: 'Need to choose frontend framework',
    context: 'Project requires state-driven UI with SSR, real-time updates, and enterprise performance',
    options: [
      { name: 'Next.js', description: 'React-based with SSR/SSG', pros: ['Largest ecosystem', 'Best SSR'], cons: ['React lock-in'], risk: 'Low', effort: 'Low' },
      { name: 'SvelteKit', description: 'Svelte-based with SSR', pros: ['Smaller bundles', 'Less boilerplate'], cons: ['Smaller ecosystem'], risk: 'Medium', effort: 'Medium' },
    ],
    risk_rating: 'Medium',
    recommendation: 'Next.js — largest ecosystem, team familiarity',
    approved_option: 'Next.js',
    owner: 'solution-architect',
    impacted_cards: ['EPIC-001', 'EPIC-002'],
    impacted_artifacts: ['sdd.md'],
    status: 'Implemented',
    created_at: '2025-02-01T09:00:00Z',
    approved_at: '2025-02-01T14:00:00Z',
  },
  {
    decision_id: 'DEC-002',
    trigger: 'Need to choose state persistence strategy',
    context: 'Must support atomic writes, concurrent access, and deterministic replay',
    options: [
      { name: 'File-based (JSON/JSONL)', description: 'Simple file I/O with locking', pros: ['No DB dependency', 'Git-friendly'], cons: ['Scaling limits'], risk: 'Low', effort: 'Low' },
      { name: 'SQLite', description: 'Embedded relational DB', pros: ['ACID transactions', 'Query support'], cons: ['Not git-friendly'], risk: 'Low', effort: 'Medium' },
    ],
    risk_rating: 'Low',
    recommendation: 'File-based — aligns with "files remember" principle',
    approved_option: 'File-based (JSON/JSONL)',
    owner: 'solution-architect',
    impacted_cards: ['EPIC-001'],
    impacted_artifacts: ['sdd.md', 'board.json'],
    status: 'Verified',
    created_at: '2025-02-02T10:00:00Z',
    approved_at: '2025-02-02T15:00:00Z',
  },
  {
    decision_id: 'DEC-003',
    trigger: 'Choose OAuth provider for authentication',
    context: 'Need enterprise SSO support, multi-provider auth, compliance certifications',
    options: [
      { name: 'Auth0', description: 'Enterprise auth platform', pros: ['SSO support', 'Compliance certs', 'Extensive docs'], cons: ['Cost at scale', 'Vendor lock-in'], risk: 'Low', effort: 'Low' },
      { name: 'Clerk', description: 'Developer-first auth', pros: ['Great DX', 'Fast setup', 'React components'], cons: ['Less enterprise features'], risk: 'Medium', effort: 'Low' },
      { name: 'Custom OAuth2', description: 'Build from scratch', pros: ['Full control', 'No vendor cost'], cons: ['High effort', 'Security risk'], risk: 'High', effort: 'High' },
    ],
    risk_rating: 'High',
    recommendation: 'Auth0 — enterprise SSO support, compliance ready',
    approved_option: null,
    owner: 'solution-architect',
    impacted_cards: ['FEAT-009', 'DEC-BLK-001'],
    impacted_artifacts: ['sdd.md', 'integration-config.json'],
    status: 'Awaiting Approval',
    created_at: '2025-03-01T11:00:00Z',
    approved_at: null,
  },
];

export const mockAgents: Agent[] = [
  // Governance
  { id: 'orchestrator', name: 'Orchestrator', shortName: 'ORC', group: 'governance', status: 'working', currentTask: 'Routing TASK-016 to Junior Developer', avatar: '🎯' },
  { id: 'state-controller', name: 'State Controller', shortName: 'STC', group: 'governance', status: 'working', currentTask: 'Validating FEAT-004 → Testing transition', avatar: '⚡' },
  { id: 'decision-controller', name: 'Decision Controller', shortName: 'DEC', group: 'governance', status: 'waiting', currentTask: 'Awaiting approval on DEC-003', avatar: '⚖️' },
  { id: 'audit-gatekeeper', name: 'Audit Gatekeeper', shortName: 'AUD', group: 'governance', status: 'idle', currentTask: null, avatar: '🛡️' },
  { id: 'security-compliance', name: 'Security & Compliance', shortName: 'SEC', group: 'governance', status: 'idle', currentTask: null, avatar: '🔒' },
  // SDLC
  { id: 'business-analyst', name: 'Business Analyst', shortName: 'BA', group: 'sdlc', status: 'idle', currentTask: null, avatar: '📋' },
  { id: 'solution-architect', name: 'Solution Architect', shortName: 'SA', group: 'sdlc', status: 'working', currentTask: 'Reviewing LLM Gateway architecture', avatar: '🏗️' },
  { id: 'ui-ux-designer', name: 'UI/UX Designer', shortName: 'UX', group: 'sdlc', status: 'idle', currentTask: null, avatar: '🎨' },
  { id: 'product-manager', name: 'Product Manager', shortName: 'PM', group: 'sdlc', status: 'idle', currentTask: null, avatar: '📊' },
  { id: 'tech-lead', name: 'Tech Lead', shortName: 'TL', group: 'sdlc', status: 'working', currentTask: 'Reviewing PR #42 — State Machine', avatar: '👑' },
  // Engineering
  { id: 'junior-developer', name: 'Junior Developer', shortName: 'JD', group: 'engineering', status: 'working', currentTask: 'Implementing decision API endpoints', avatar: '💻' },
  { id: 'senior-developer', name: 'Senior Developer', shortName: 'SD', group: 'engineering', status: 'working', currentTask: 'Reviewing agent authority middleware', avatar: '🔍' },
  { id: 'qa-engineer', name: 'QA Engineer', shortName: 'QA', group: 'engineering', status: 'working', currentTask: 'Testing board CRUD operations', avatar: '🧪' },
  { id: 'automation-test', name: 'Automation Test', shortName: 'AT', group: 'engineering', status: 'idle', currentTask: null, avatar: '🤖' },
  { id: 'performance-engineer', name: 'Performance Engineer', shortName: 'PF', group: 'engineering', status: 'idle', currentTask: null, avatar: '⚡' },
  // Platform
  { id: 'platform-engineer', name: 'Platform Engineer', shortName: 'PE', group: 'platform', status: 'idle', currentTask: null, avatar: '🔧' },
  { id: 'devops-engineer', name: 'DevOps Engineer', shortName: 'DO', group: 'platform', status: 'working', currentTask: 'Setting up CI pipeline', avatar: '🚀' },
  { id: 'integration-engineer', name: 'Integration Engineer', shortName: 'IE', group: 'platform', status: 'idle', currentTask: null, avatar: '🔌' },
  { id: 'secrets-manager', name: 'Secrets Manager', shortName: 'SM', group: 'platform', status: 'idle', currentTask: null, avatar: '🔑' },
  { id: 'sre', name: 'SRE', shortName: 'SR', group: 'platform', status: 'idle', currentTask: null, avatar: '📡' },
  // AI & Cost
  { id: 'llm-gateway', name: 'LLM Gateway Manager', shortName: 'LLM', group: 'ai_cost', status: 'working', currentTask: 'Routing requests to GPT-4o', avatar: '🧠' },
  { id: 'prompt-engineer', name: 'Prompt Engineer', shortName: 'PE', group: 'ai_cost', status: 'idle', currentTask: null, avatar: '✍️' },
  { id: 'cost-analyst', name: 'Cost Analyst', shortName: 'CA', group: 'ai_cost', status: 'idle', currentTask: null, avatar: '💰' },
];

export const mockSDLCProgress: SDLCProgress[] = [
  { stage: 'Business Analysis', status: 'completed', gate_passed: true },
  { stage: 'Architecture', status: 'completed', gate_passed: true },
  { stage: 'UI/UX Design', status: 'completed', gate_passed: true },
  { stage: 'Planning', status: 'completed', gate_passed: true },
  { stage: 'Development', status: 'active', gate_passed: false },
  { stage: 'Code Review', status: 'active', gate_passed: false },
  { stage: 'Testing', status: 'active', gate_passed: false },
  { stage: 'Release', status: 'pending', gate_passed: false },
  { stage: 'Monitoring', status: 'pending', gate_passed: false },
  { stage: 'Iteration', status: 'pending', gate_passed: false },
];
