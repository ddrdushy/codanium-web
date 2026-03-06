import { PrismaClient } from '../src/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

// ─── Helpers ─────────────────────────────────────────────────────────────────

const hoursAgo = (h: number) => new Date(Date.now() - h * 60 * 60 * 1000);
const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000);

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// ─── Main Seed Function ──────────────────────────────────────────────────────

async function main() {
  console.log('Seeding database...\n');

  // ── 1. Clear all tables in correct FK order ──────────────────────────────

  console.log('Clearing existing data...');
  await prisma.$transaction([
    prisma.adminSetting.deleteMany(),
    prisma.userPresence.deleteMany(),
    prisma.deploymentRun.deleteMany(),
    prisma.deploymentPipeline.deleteMany(),
    prisma.orchestrationRun.deleteMany(),
    prisma.artifact.deleteMany(),
    prisma.event.deleteMany(),
    prisma.lLMProviderConfig.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.lLMUsage.deleteMany(),
    prisma.transaction.deleteMany(),
    prisma.chatMessage.deleteMany(),
    prisma.wireframe.deleteMany(),
    prisma.gitRelease.deleteMany(),
    prisma.gitPullRequest.deleteMany(),
    prisma.gitBranch.deleteMany(),
    prisma.decisionOption.deleteMany(),
    prisma.decision.deleteMany(),
    prisma.card.deleteMany(),
    prisma.agent.deleteMany(),
    prisma.sDLCStage.deleteMany(),
    prisma.document.deleteMany(),
    prisma.projectMember.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.verificationToken.deleteMany(),
    prisma.project.deleteMany(),
    prisma.user.deleteMany(),
  ]);
  console.log('All tables cleared.\n');

  // ── 2. Seed Users ────────────────────────────────────────────────────────

  console.log('Seeding users...');

  const userPassword = await hashPassword('password123');
  const adminPassword = await hashPassword('admin123');

  // Auth mock users (the login accounts)
  const authUsers = [
    {
      id: 'usr-001',
      name: 'Demo User',
      email: 'user@demo.com',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'STARTER' as const,
      avatarColor: '#f59e0b',
      lastLogin: new Date(),
      createdAt: new Date('2025-01-01T00:00:00Z'),
    },
    {
      id: 'usr-002',
      name: 'Admin User',
      email: 'admin@demo.com',
      passwordHash: adminPassword,
      role: 'ADMIN' as const,
      status: 'ACTIVE' as const,
      plan: 'ENTERPRISE' as const,
      avatarColor: '#3b82f6',
      lastLogin: new Date(),
      createdAt: new Date('2025-01-01T00:00:00Z'),
    },
  ];

  // Admin panel users (18 users from mock-admin-data)
  const adminUsers = [
    {
      id: 'usr_001',
      name: 'Sarah Chen',
      email: 'sarah.chen@techcorp.io',
      passwordHash: adminPassword,
      role: 'ADMIN' as const,
      status: 'ACTIVE' as const,
      plan: 'ENTERPRISE' as const,
      avatarColor: '#3b82f6',
      lastLogin: new Date('2026-03-04T08:15:00Z'),
      createdAt: new Date('2025-06-15T09:30:00Z'),
    },
    {
      id: 'usr_002',
      name: 'Marcus Johnson',
      email: 'marcus.j@devstudio.com',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'PRO' as const,
      avatarColor: '#f59e0b',
      lastLogin: new Date('2026-03-03T19:42:00Z'),
      createdAt: new Date('2025-08-22T14:00:00Z'),
    },
    {
      id: 'usr_003',
      name: 'Elena Rodriguez',
      email: 'elena.r@startup.co',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'STARTER' as const,
      avatarColor: '#ec4899',
      lastLogin: new Date('2026-03-02T11:30:00Z'),
      createdAt: new Date('2025-11-10T10:20:00Z'),
    },
    {
      id: 'usr_004',
      name: 'David Kim',
      email: 'david.kim@bigcorp.com',
      passwordHash: adminPassword,
      role: 'ADMIN' as const,
      status: 'ACTIVE' as const,
      plan: 'ENTERPRISE' as const,
      avatarColor: '#8b5cf6',
      lastLogin: new Date('2026-03-04T07:55:00Z'),
      createdAt: new Date('2025-05-01T08:00:00Z'),
    },
    {
      id: 'usr_005',
      name: 'Aisha Patel',
      email: 'aisha.patel@freelance.dev',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'PRO' as const,
      avatarColor: '#10b981',
      lastLogin: new Date('2026-03-03T22:10:00Z'),
      createdAt: new Date('2025-09-18T16:45:00Z'),
    },
    {
      id: 'usr_006',
      name: 'Tom Brennan',
      email: 'tom.b@agency.io',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'SUSPENDED' as const,
      plan: 'PRO' as const,
      avatarColor: '#ef4444',
      lastLogin: new Date('2026-02-14T09:00:00Z'),
      createdAt: new Date('2025-10-05T11:30:00Z'),
    },
    {
      id: 'usr_007',
      name: 'Yuki Tanaka',
      email: 'yuki.tanaka@designlab.jp',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'STARTER' as const,
      avatarColor: '#06b6d4',
      lastLogin: new Date('2026-03-03T15:20:00Z'),
      createdAt: new Date('2026-01-08T13:15:00Z'),
    },
    {
      id: 'usr_008',
      name: "James O'Connor",
      email: 'james.oc@enterprise.net',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'ENTERPRISE' as const,
      avatarColor: '#f97316',
      lastLogin: new Date('2026-03-04T06:30:00Z'),
      createdAt: new Date('2025-07-20T09:00:00Z'),
    },
    {
      id: 'usr_009',
      name: 'Lisa Wang',
      email: 'lisa.wang@quantumdev.io',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'PENDING' as const,
      plan: 'STARTER' as const,
      avatarColor: '#a855f7',
      lastLogin: new Date('2026-03-02T18:00:00Z'),
      createdAt: new Date('2026-03-02T18:00:00Z'),
    },
    {
      id: 'usr_010',
      name: 'Roberto Silva',
      email: 'roberto.s@latamtech.br',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'PRO' as const,
      avatarColor: '#14b8a6',
      lastLogin: new Date('2026-03-01T14:45:00Z'),
      createdAt: new Date('2025-12-01T10:00:00Z'),
    },
    {
      id: 'usr_011',
      name: 'Natasha Volkov',
      email: 'natasha.v@cloudops.eu',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'ENTERPRISE' as const,
      avatarColor: '#6366f1',
      lastLogin: new Date('2026-03-03T10:20:00Z'),
      createdAt: new Date('2025-08-10T12:00:00Z'),
    },
    {
      id: 'usr_012',
      name: 'Kevin Nguyen',
      email: 'kevin.ng@mobilefirst.app',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'STARTER' as const,
      avatarColor: '#eab308',
      lastLogin: new Date('2026-03-02T20:15:00Z'),
      createdAt: new Date('2026-02-15T09:30:00Z'),
    },
    {
      id: 'usr_013',
      name: 'Priya Sharma',
      email: 'priya.sharma@aiventures.in',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'PRO' as const,
      avatarColor: '#e11d48',
      lastLogin: new Date('2026-03-03T17:00:00Z'),
      createdAt: new Date('2025-11-25T07:45:00Z'),
    },
    {
      id: 'usr_014',
      name: 'Michael Torres',
      email: 'michael.t@devshop.us',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'SUSPENDED' as const,
      plan: 'STARTER' as const,
      avatarColor: '#64748b',
      lastLogin: new Date('2026-01-20T08:00:00Z'),
      createdAt: new Date('2025-10-30T15:00:00Z'),
    },
    {
      id: 'usr_015',
      name: 'Hannah Fischer',
      email: 'hannah.f@berlincode.de',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'PRO' as const,
      avatarColor: '#059669',
      lastLogin: new Date('2026-03-04T04:30:00Z'),
      createdAt: new Date('2025-09-05T11:00:00Z'),
    },
    {
      id: 'usr_016',
      name: 'Ahmed Hassan',
      email: 'ahmed.h@nexusai.sa',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'PENDING' as const,
      plan: 'ENTERPRISE' as const,
      avatarColor: '#0ea5e9',
      lastLogin: new Date('2026-03-03T10:00:00Z'),
      createdAt: new Date('2026-03-03T10:00:00Z'),
    },
    {
      id: 'usr_017',
      name: 'Sophie Martin',
      email: 'sophie.m@paristech.fr',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'STARTER' as const,
      avatarColor: '#d946ef',
      lastLogin: new Date('2026-03-02T09:45:00Z'),
      createdAt: new Date('2026-01-20T14:30:00Z'),
    },
    {
      id: 'usr_018',
      name: 'Chris Andersen',
      email: 'chris.a@nordicdev.no',
      passwordHash: userPassword,
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      plan: 'PRO' as const,
      avatarColor: '#2563eb',
      lastLogin: new Date('2026-03-03T21:00:00Z'),
      createdAt: new Date('2025-10-12T08:15:00Z'),
    },
  ];

  const allUsers = [...authUsers, ...adminUsers];

  for (const user of allUsers) {
    await prisma.user.create({ data: user });
  }
  console.log(`  Created ${allUsers.length} users`);

  // ── 3. Seed Projects ─────────────────────────────────────────────────────

  console.log('Seeding projects...');

  const projects = [
    {
      id: 'prj-001',
      name: 'AI Team Studio',
      description: 'Full-service AI platform that builds and delivers software from your ideas',
      status: 'ACTIVE' as const,
      currentStage: 'Development',
      completion: 48,
      color: '#f59e0b',
      ownerId: 'usr-001', // Demo User
      createdAt: new Date('2025-01-15T10:00:00Z'),
    },
    {
      id: 'prj-002',
      name: 'FinTrack Pro',
      description: 'Personal finance tracker with AI insights',
      status: 'ACTIVE' as const,
      currentStage: 'Architecture',
      completion: 22,
      color: '#3b82f6',
      ownerId: 'usr_002', // Marcus Johnson
      createdAt: new Date('2025-02-20T10:00:00Z'),
    },
    {
      id: 'prj-003',
      name: 'MedConnect',
      description: 'Telemedicine platform with HIPAA compliance',
      status: 'ACTIVE' as const,
      currentStage: 'Planning',
      completion: 15,
      color: '#10b981',
      ownerId: 'usr_003', // Elena Rodriguez
      createdAt: new Date('2025-03-01T10:00:00Z'),
    },
    {
      id: 'prj-004',
      name: 'ShopWave',
      description: 'Headless e-commerce platform',
      status: 'PAUSED' as const,
      currentStage: 'Testing',
      completion: 72,
      color: '#8b5cf6',
      ownerId: 'usr_004', // David Kim
      createdAt: new Date('2024-11-10T10:00:00Z'),
    },
    {
      id: 'prj-005',
      name: 'DevOps Dashboard',
      description: 'Internal infrastructure monitoring tool',
      status: 'COMPLETED' as const,
      currentStage: 'Monitoring',
      completion: 100,
      color: '#ef4444',
      ownerId: 'usr_006', // Tom Wilson
      createdAt: new Date('2024-09-05T10:00:00Z'),
    },
  ];

  for (const project of projects) {
    await prisma.project.create({ data: project });
  }
  console.log(`  Created ${projects.length} projects`);

  // ── 4. Seed Project Members ──────────────────────────────────────────────

  console.log('Seeding project members...');

  const projectMembers = [
    // AI Team Studio: Demo User is owner
    { projectId: 'prj-001', userId: 'usr-001', role: 'owner' },
    // FinTrack Pro: Marcus is owner, Elena is member
    { projectId: 'prj-002', userId: 'usr_002', role: 'owner' },
    { projectId: 'prj-002', userId: 'usr_003', role: 'member' },
    // MedConnect: Elena is owner, David and Aisha are members
    { projectId: 'prj-003', userId: 'usr_003', role: 'owner' },
    { projectId: 'prj-003', userId: 'usr_004', role: 'admin' },
    { projectId: 'prj-003', userId: 'usr_005', role: 'member' },
    // ShopWave: David is owner, Tom is member
    { projectId: 'prj-004', userId: 'usr_004', role: 'owner' },
    { projectId: 'prj-004', userId: 'usr_006', role: 'member' },
    // DevOps Dashboard: Tom is owner, Demo User is member
    { projectId: 'prj-005', userId: 'usr_006', role: 'owner' },
    { projectId: 'prj-005', userId: 'usr-001', role: 'member' },
  ];

  for (const member of projectMembers) {
    await prisma.projectMember.create({ data: member });
  }
  console.log(`  Created ${projectMembers.length} project members`);

  // ── 5. Seed Agents (23 agents for prj-001) ──────────────────────────────

  console.log('Seeding agents...');

  // Map mock group names to Prisma enum values
  const groupMap: Record<string, 'GOVERNANCE' | 'SDLC' | 'ENGINEERING' | 'PLATFORM' | 'AI_COST'> = {
    governance: 'GOVERNANCE',
    sdlc: 'SDLC',
    engineering: 'ENGINEERING',
    platform: 'PLATFORM',
    ai_cost: 'AI_COST',
  };

  // Map mock status names to Prisma enum values
  const agentStatusMap: Record<string, 'IDLE' | 'WORKING' | 'WAITING' | 'BLOCKED'> = {
    idle: 'IDLE',
    working: 'WORKING',
    waiting: 'WAITING',
    blocked: 'BLOCKED',
  };

  const agents = [
    // Governance
    { id: 'orchestrator', name: 'Orchestrator', shortName: 'ORC', group: 'GOVERNANCE' as const, status: 'WORKING' as const, currentTask: 'Routing TASK-016 to Junior Developer', avatar: '🎯', projectId: 'prj-001' },
    { id: 'state-controller', name: 'State Controller', shortName: 'STC', group: 'GOVERNANCE' as const, status: 'WORKING' as const, currentTask: 'Validating FEAT-004 → Testing transition', avatar: '⚡', projectId: 'prj-001' },
    { id: 'decision-controller', name: 'Decision Controller', shortName: 'DEC', group: 'GOVERNANCE' as const, status: 'WAITING' as const, currentTask: 'Awaiting approval on DEC-003', avatar: '⚖️', projectId: 'prj-001' },
    { id: 'audit-gatekeeper', name: 'Audit Gatekeeper', shortName: 'AUD', group: 'GOVERNANCE' as const, status: 'IDLE' as const, currentTask: null, avatar: '🛡️', projectId: 'prj-001' },
    { id: 'security-compliance', name: 'Security & Compliance', shortName: 'SEC', group: 'GOVERNANCE' as const, status: 'IDLE' as const, currentTask: null, avatar: '🔒', projectId: 'prj-001' },
    // SDLC
    { id: 'business-analyst', name: 'Business Analyst', shortName: 'BA', group: 'SDLC' as const, status: 'IDLE' as const, currentTask: null, avatar: '📋', projectId: 'prj-001' },
    { id: 'solution-architect', name: 'Solution Architect', shortName: 'SA', group: 'SDLC' as const, status: 'WORKING' as const, currentTask: 'Reviewing LLM Gateway architecture', avatar: '🏗️', projectId: 'prj-001' },
    { id: 'ui-ux-designer', name: 'UI/UX Designer', shortName: 'UX', group: 'SDLC' as const, status: 'IDLE' as const, currentTask: null, avatar: '🎨', projectId: 'prj-001' },
    { id: 'product-manager', name: 'Product Manager', shortName: 'PM', group: 'SDLC' as const, status: 'IDLE' as const, currentTask: null, avatar: '📊', projectId: 'prj-001' },
    { id: 'tech-lead', name: 'Tech Lead', shortName: 'TL', group: 'SDLC' as const, status: 'WORKING' as const, currentTask: 'Reviewing PR #42 — State Machine', avatar: '👑', projectId: 'prj-001' },
    // Engineering
    { id: 'junior-developer', name: 'Junior Developer', shortName: 'JD', group: 'ENGINEERING' as const, status: 'WORKING' as const, currentTask: 'Implementing decision API endpoints', avatar: '💻', projectId: 'prj-001' },
    { id: 'senior-developer', name: 'Senior Developer', shortName: 'SD', group: 'ENGINEERING' as const, status: 'WORKING' as const, currentTask: 'Reviewing agent authority middleware', avatar: '🔍', projectId: 'prj-001' },
    { id: 'qa-engineer', name: 'QA Engineer', shortName: 'QA', group: 'ENGINEERING' as const, status: 'WORKING' as const, currentTask: 'Testing board CRUD operations', avatar: '🧪', projectId: 'prj-001' },
    { id: 'automation-test', name: 'Automation Test', shortName: 'AT', group: 'ENGINEERING' as const, status: 'IDLE' as const, currentTask: null, avatar: '🤖', projectId: 'prj-001' },
    { id: 'performance-engineer', name: 'Performance Engineer', shortName: 'PF', group: 'ENGINEERING' as const, status: 'IDLE' as const, currentTask: null, avatar: '⚡', projectId: 'prj-001' },
    // Platform
    { id: 'platform-engineer', name: 'Platform Engineer', shortName: 'PE', group: 'PLATFORM' as const, status: 'IDLE' as const, currentTask: null, avatar: '🔧', projectId: 'prj-001' },
    { id: 'devops-engineer', name: 'DevOps Engineer', shortName: 'DO', group: 'PLATFORM' as const, status: 'WORKING' as const, currentTask: 'Setting up CI pipeline', avatar: '🚀', projectId: 'prj-001' },
    { id: 'integration-engineer', name: 'Integration Engineer', shortName: 'IE', group: 'PLATFORM' as const, status: 'IDLE' as const, currentTask: null, avatar: '🔌', projectId: 'prj-001' },
    { id: 'secrets-manager', name: 'Secrets Manager', shortName: 'SM', group: 'PLATFORM' as const, status: 'IDLE' as const, currentTask: null, avatar: '🔑', projectId: 'prj-001' },
    { id: 'sre', name: 'SRE', shortName: 'SR', group: 'PLATFORM' as const, status: 'IDLE' as const, currentTask: null, avatar: '📡', projectId: 'prj-001' },
    // AI & Cost
    { id: 'llm-gateway', name: 'LLM Gateway Manager', shortName: 'LLM', group: 'AI_COST' as const, status: 'WORKING' as const, currentTask: 'Routing requests to GPT-4o', avatar: '🧠', projectId: 'prj-001' },
    { id: 'prompt-engineer', name: 'Prompt Engineer', shortName: 'PRE', group: 'AI_COST' as const, status: 'IDLE' as const, currentTask: null, avatar: '✍️', projectId: 'prj-001' },
    { id: 'cost-analyst', name: 'Cost Analyst', shortName: 'CA', group: 'AI_COST' as const, status: 'IDLE' as const, currentTask: null, avatar: '💰', projectId: 'prj-001' },
  ];

  for (const agent of agents) {
    await prisma.agent.create({ data: agent });
  }
  console.log(`  Created ${agents.length} agents`);

  // ── 6. Seed Cards ────────────────────────────────────────────────────────

  console.log('Seeding cards...');

  // Map mock card types to Prisma enum values
  const cardTypeMap: Record<string, 'EPIC' | 'FEATURE' | 'TASK' | 'QA' | 'DECISION_BLOCKER'> = {
    Epic: 'EPIC',
    Feature: 'FEATURE',
    Task: 'TASK',
    QA: 'QA',
    DecisionBlocker: 'DECISION_BLOCKER',
  };

  // Map mock card states to Prisma enum values
  const cardStateMap: Record<string, 'PLANNED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'TESTING' | 'BLOCKED' | 'DONE' | 'RELEASED'> = {
    Planned: 'PLANNED',
    'In Progress': 'IN_PROGRESS',
    'Under Review': 'UNDER_REVIEW',
    Testing: 'TESTING',
    Blocked: 'BLOCKED',
    Done: 'DONE',
    Released: 'RELEASED',
  };

  // Map mock priorities to Prisma enum values
  const priorityMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
    low: 'LOW',
    medium: 'MEDIUM',
    high: 'HIGH',
    critical: 'CRITICAL',
  };

  // First pass: create all cards without parent references (to avoid FK issues)
  const cardData = [
    // Planned
    { id: 'FEAT-012', type: 'FEATURE' as const, title: 'Webhook Integration', description: 'Support incoming webhooks for external triggers', state: 'PLANNED' as const, ownerAgentId: 'integration-engineer', parentId: null as string | null, priority: 'MEDIUM' as const, projectId: 'prj-001', createdAt: new Date('2025-03-01T08:00:00Z') },
    { id: 'TASK-031', type: 'TASK' as const, title: 'Design webhook schema', description: 'Define JSON schema for webhook payloads', state: 'PLANNED' as const, ownerAgentId: 'solution-architect', parentId: 'FEAT-012', priority: 'MEDIUM' as const, projectId: 'prj-001', createdAt: new Date('2025-03-01T09:00:00Z') },
    { id: 'FEAT-013', type: 'FEATURE' as const, title: 'Export Dashboard PDF', description: 'Allow exporting KPI dashboard as PDF report', state: 'PLANNED' as const, ownerAgentId: 'junior-developer', parentId: null, priority: 'LOW' as const, projectId: 'prj-001', createdAt: new Date('2025-03-01T10:00:00Z') },

    // In Progress
    { id: 'EPIC-002', type: 'EPIC' as const, title: 'Decision Engine', description: 'Full decision lifecycle with approval workflows', state: 'IN_PROGRESS' as const, ownerAgentId: 'tech-lead', parentId: null, priority: 'HIGH' as const, projectId: 'prj-001', createdAt: new Date('2025-02-10T10:00:00Z') },
    { id: 'FEAT-006', type: 'FEATURE' as const, title: 'Decision Approval Flow', description: 'Multi-option decision approval with risk scoring', state: 'IN_PROGRESS' as const, ownerAgentId: 'junior-developer', parentId: 'EPIC-002', priority: 'HIGH' as const, projectId: 'prj-001', createdAt: new Date('2025-02-15T10:00:00Z') },
    { id: 'TASK-016', type: 'TASK' as const, title: 'Implement decision API endpoints', description: 'CRUD endpoints for decisions with validation', state: 'IN_PROGRESS' as const, ownerAgentId: 'junior-developer', parentId: 'FEAT-006', priority: 'HIGH' as const, projectId: 'prj-001', createdAt: new Date('2025-02-20T08:00:00Z') },
    { id: 'TASK-017', type: 'TASK' as const, title: 'Build LLM provider abstraction', description: 'Base class for multi-provider support', state: 'IN_PROGRESS' as const, ownerAgentId: 'junior-developer', parentId: null, priority: 'CRITICAL' as const, projectId: 'prj-001', createdAt: new Date('2025-02-22T08:00:00Z') },

    // Under Review
    { id: 'FEAT-004', type: 'FEATURE' as const, title: 'Card State Machine', description: 'Validate all card state transitions per rules', state: 'UNDER_REVIEW' as const, ownerAgentId: 'senior-developer', parentId: null, priority: 'CRITICAL' as const, projectId: 'prj-001', createdAt: new Date('2025-02-12T10:00:00Z') },
    { id: 'TASK-018', type: 'TASK' as const, title: 'Agent authority validation middleware', description: 'Enforce persona write boundaries', state: 'UNDER_REVIEW' as const, ownerAgentId: 'senior-developer', parentId: null, priority: 'HIGH' as const, projectId: 'prj-001', createdAt: new Date('2025-02-25T08:00:00Z') },

    // Testing
    { id: 'FEAT-003', type: 'FEATURE' as const, title: 'Board CRUD Operations', description: 'Create, read, update board.json with atomic writes', state: 'TESTING' as const, ownerAgentId: 'qa-engineer', parentId: null, priority: 'CRITICAL' as const, projectId: 'prj-001', createdAt: new Date('2025-02-11T10:00:00Z') },
    { id: 'TASK-019', type: 'TASK' as const, title: 'Event bus message ordering', description: 'Ensure FIFO processing of events', state: 'TESTING' as const, ownerAgentId: 'qa-engineer', parentId: null, priority: 'HIGH' as const, projectId: 'prj-001', createdAt: new Date('2025-02-26T08:00:00Z') },

    // Blocked
    { id: 'DEC-BLK-001', type: 'DECISION_BLOCKER' as const, title: 'Choose OAuth Provider', description: 'Need to decide between Auth0, Firebase Auth, or Clerk', state: 'BLOCKED' as const, ownerAgentId: 'decision-controller', parentId: null, priority: 'HIGH' as const, projectId: 'prj-001', createdAt: new Date('2025-03-01T11:00:00Z'), linkedDecisionId: 'DEC-003' },
    { id: 'TASK-020', type: 'TASK' as const, title: 'Implement SSO login', description: 'Blocked on OAuth provider decision', state: 'BLOCKED' as const, ownerAgentId: 'junior-developer', parentId: null, priority: 'HIGH' as const, projectId: 'prj-001', createdAt: new Date('2025-03-01T12:00:00Z') },

    // Done
    { id: 'EPIC-001', type: 'EPIC' as const, title: 'State Engine Core', description: 'Board state management with atomic file operations', state: 'DONE' as const, ownerAgentId: 'tech-lead', parentId: null, priority: 'CRITICAL' as const, projectId: 'prj-001', createdAt: new Date('2025-02-01T10:00:00Z') },
    { id: 'FEAT-001', type: 'FEATURE' as const, title: 'Project Initialization', description: 'Create new project with scaffold files', state: 'DONE' as const, ownerAgentId: 'junior-developer', parentId: 'EPIC-001', priority: 'CRITICAL' as const, projectId: 'prj-001', createdAt: new Date('2025-02-05T10:00:00Z') },
    { id: 'FEAT-002', type: 'FEATURE' as const, title: 'Event Log System', description: 'Append-only event logging to events.jsonl', state: 'DONE' as const, ownerAgentId: 'junior-developer', parentId: 'EPIC-001', priority: 'HIGH' as const, projectId: 'prj-001', createdAt: new Date('2025-02-08T10:00:00Z') },

    // Released
    { id: 'FEAT-000', type: 'FEATURE' as const, title: 'CLI Project Scaffold', description: 'npx create-ai-team-studio command', state: 'RELEASED' as const, ownerAgentId: 'devops-engineer', parentId: null, priority: 'MEDIUM' as const, projectId: 'prj-001', createdAt: new Date('2025-01-20T10:00:00Z') },
  ];

  // Create cards without parent references first
  for (const card of cardData) {
    const { parentId, linkedDecisionId, ...cardWithoutParent } = card;
    await prisma.card.create({
      data: {
        ...cardWithoutParent,
        // linkedDecisionId is just a string field, not a FK — set it now
        ...(linkedDecisionId ? { linkedDecisionId } : {}),
      },
    });
  }

  // Second pass: set parent references
  const parentUpdates = cardData
    .filter((c) => c.parentId !== null)
    .map((c) =>
      prisma.card.update({
        where: { id: c.id },
        data: { parentId: c.parentId },
      })
    );

  if (parentUpdates.length > 0) {
    await prisma.$transaction(parentUpdates);
  }
  console.log(`  Created ${cardData.length} cards`);

  // ── 7. Seed Decisions with Options ───────────────────────────────────────

  console.log('Seeding decisions...');

  // Map decision statuses to Prisma enum
  const decisionStatusMap: Record<string, 'DRAFTED' | 'OPTIONS_COLLECTED' | 'RECOMMENDED' | 'AWAITING_APPROVAL' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED' | 'VERIFIED'> = {
    Drafted: 'DRAFTED',
    'Options Collected': 'OPTIONS_COLLECTED',
    Recommended: 'RECOMMENDED',
    'Awaiting Approval': 'AWAITING_APPROVAL',
    Approved: 'APPROVED',
    Rejected: 'REJECTED',
    Implemented: 'IMPLEMENTED',
    Verified: 'VERIFIED',
  };

  // Map risk ratings
  const riskMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
    Low: 'LOW',
    Medium: 'MEDIUM',
    High: 'HIGH',
    Critical: 'CRITICAL',
  };

  // Map effort
  const effortMap: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
    Low: 'LOW',
    Medium: 'MEDIUM',
    High: 'HIGH',
  };

  // Decision 1: Frontend Framework
  const dec1 = await prisma.decision.create({
    data: {
      id: 'DEC-001',
      trigger: 'Need to choose frontend framework',
      context: 'Project requires state-driven UI with SSR, real-time updates, and enterprise performance',
      riskRating: 'MEDIUM',
      recommendation: 'Next.js — largest ecosystem, team familiarity',
      approvedOption: 'Next.js',
      status: 'IMPLEMENTED',
      ownerId: 'usr-001', // Demo User (acting as solution-architect)
      projectId: 'prj-001',
      createdAt: new Date('2025-02-01T09:00:00Z'),
      approvedAt: new Date('2025-02-01T14:00:00Z'),
    },
  });

  await prisma.decisionOption.createMany({
    data: [
      {
        decisionId: 'DEC-001',
        name: 'Next.js',
        description: 'React-based with SSR/SSG',
        pros: ['Largest ecosystem', 'Best SSR'],
        cons: ['React lock-in'],
        risk: 'LOW',
        effort: 'LOW',
      },
      {
        decisionId: 'DEC-001',
        name: 'SvelteKit',
        description: 'Svelte-based with SSR',
        pros: ['Smaller bundles', 'Less boilerplate'],
        cons: ['Smaller ecosystem'],
        risk: 'MEDIUM',
        effort: 'MEDIUM',
      },
    ],
  });

  // Decision 2: State Persistence
  const dec2 = await prisma.decision.create({
    data: {
      id: 'DEC-002',
      trigger: 'Need to choose state persistence strategy',
      context: 'Must support atomic writes, concurrent access, and deterministic replay',
      riskRating: 'LOW',
      recommendation: 'File-based — aligns with "files remember" principle',
      approvedOption: 'File-based (JSON/JSONL)',
      status: 'VERIFIED',
      ownerId: 'usr-001',
      projectId: 'prj-001',
      createdAt: new Date('2025-02-02T10:00:00Z'),
      approvedAt: new Date('2025-02-02T15:00:00Z'),
    },
  });

  await prisma.decisionOption.createMany({
    data: [
      {
        decisionId: 'DEC-002',
        name: 'File-based (JSON/JSONL)',
        description: 'Simple file I/O with locking',
        pros: ['No DB dependency', 'Git-friendly'],
        cons: ['Scaling limits'],
        risk: 'LOW',
        effort: 'LOW',
      },
      {
        decisionId: 'DEC-002',
        name: 'SQLite',
        description: 'Embedded relational DB',
        pros: ['ACID transactions', 'Query support'],
        cons: ['Not git-friendly'],
        risk: 'LOW',
        effort: 'MEDIUM',
      },
    ],
  });

  // Decision 3: OAuth Provider
  const dec3 = await prisma.decision.create({
    data: {
      id: 'DEC-003',
      trigger: 'Choose OAuth provider for authentication',
      context: 'Need enterprise SSO support, multi-provider auth, compliance certifications',
      riskRating: 'HIGH',
      recommendation: 'Auth0 — enterprise SSO support, compliance ready',
      approvedOption: null,
      status: 'AWAITING_APPROVAL',
      ownerId: 'usr-001',
      projectId: 'prj-001',
      createdAt: new Date('2025-03-01T11:00:00Z'),
      approvedAt: null,
    },
  });

  await prisma.decisionOption.createMany({
    data: [
      {
        decisionId: 'DEC-003',
        name: 'Auth0',
        description: 'Enterprise auth platform',
        pros: ['SSO support', 'Compliance certs', 'Extensive docs'],
        cons: ['Cost at scale', 'Vendor lock-in'],
        risk: 'LOW',
        effort: 'LOW',
      },
      {
        decisionId: 'DEC-003',
        name: 'Clerk',
        description: 'Developer-first auth',
        pros: ['Great DX', 'Fast setup', 'React components'],
        cons: ['Less enterprise features'],
        risk: 'MEDIUM',
        effort: 'LOW',
      },
      {
        decisionId: 'DEC-003',
        name: 'Custom OAuth2',
        description: 'Build from scratch',
        pros: ['Full control', 'No vendor cost'],
        cons: ['High effort', 'Security risk'],
        risk: 'HIGH',
        effort: 'HIGH',
      },
    ],
  });

  console.log('  Created 3 decisions with 7 options');

  // ── 8. Seed SDLC Stages (10 stages per project) ─────────────────────────

  console.log('Seeding SDLC stages...');

  const stageNames = [
    'Business Analysis',
    'Architecture',
    'UI/UX Design',
    'Planning',
    'Development',
    'Code Review',
    'Testing',
    'Release',
    'Monitoring',
    'Iteration',
  ];

  // Project-specific stage configs
  const projectStageConfigs: Record<string, { activeUpTo: number; activeStages: number[] }> = {
    'prj-001': { activeUpTo: 3, activeStages: [4, 5, 6] },    // Dev, Code Review, Testing active
    'prj-002': { activeUpTo: 0, activeStages: [1] },           // Architecture active
    'prj-003': { activeUpTo: -1, activeStages: [3] },          // Planning active (not much done)
    'prj-004': { activeUpTo: 5, activeStages: [6] },           // Testing active
    'prj-005': { activeUpTo: 7, activeStages: [8] },           // Monitoring active (completed project)
  };

  let sdlcCount = 0;
  for (const projectId of Object.keys(projectStageConfigs)) {
    const config = projectStageConfigs[projectId];
    for (let i = 0; i < stageNames.length; i++) {
      let status: 'COMPLETED' | 'ACTIVE' | 'PENDING' | 'BLOCKED';
      let gatePassed: boolean;

      if (i <= config.activeUpTo) {
        status = 'COMPLETED';
        gatePassed = true;
      } else if (config.activeStages.includes(i)) {
        status = 'ACTIVE';
        gatePassed = false;
      } else {
        status = 'PENDING';
        gatePassed = false;
      }

      await prisma.sDLCStage.create({
        data: {
          name: stageNames[i],
          order: i + 1,
          status,
          gatePassed,
          projectId,
        },
      });
      sdlcCount++;
    }
  }
  console.log(`  Created ${sdlcCount} SDLC stages`);

  // ── 9. Seed Documents (6 docs) ──────────────────────────────────────────

  console.log('Seeding documents...');

  // Map doc types to Prisma enum
  const docTypeMap: Record<string, 'BRD' | 'SDD' | 'API_SPEC' | 'RUNBOOK' | 'ADR'> = {
    brd: 'BRD',
    sdd: 'SDD',
    'api-spec': 'API_SPEC',
    runbook: 'RUNBOOK',
    adr: 'ADR',
  };

  const docStatusMap: Record<string, 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED'> = {
    draft: 'DRAFT',
    review: 'REVIEW',
    approved: 'APPROVED',
    published: 'PUBLISHED',
  };

  const documents = [
    { id: 'doc-001', title: 'Business Requirements Document', type: 'BRD' as const, status: 'APPROVED' as const, owner: 'Business Analyst', ownerAvatar: '📋', wordCount: 4200, sections: 12, locked: false, projectId: 'prj-001', createdAt: daysAgo(10) },
    { id: 'doc-002', title: 'Solution Design Document', type: 'SDD' as const, status: 'REVIEW' as const, owner: 'Solution Architect', ownerAvatar: '🏗️', wordCount: 8900, sections: 24, locked: true, projectId: 'prj-001', createdAt: daysAgo(7) },
    { id: 'doc-003', title: 'REST API Specification v2', type: 'API_SPEC' as const, status: 'DRAFT' as const, owner: 'Junior Developer', ownerAvatar: '💻', wordCount: 3100, sections: 18, locked: false, projectId: 'prj-001', createdAt: daysAgo(3) },
    { id: 'doc-004', title: 'Deployment Runbook', type: 'RUNBOOK' as const, status: 'DRAFT' as const, owner: 'DevOps Engineer', ownerAvatar: '🚀', wordCount: 1800, sections: 8, locked: false, projectId: 'prj-001', createdAt: daysAgo(5) },
    { id: 'doc-005', title: 'ADR-001: File-based Persistence', type: 'ADR' as const, status: 'PUBLISHED' as const, owner: 'Solution Architect', ownerAvatar: '🏗️', wordCount: 950, sections: 5, locked: false, projectId: 'prj-001', createdAt: daysAgo(14) },
    { id: 'doc-006', title: 'ADR-002: Multi-Provider LLM Gateway', type: 'ADR' as const, status: 'DRAFT' as const, owner: 'Solution Architect', ownerAvatar: '🏗️', wordCount: 620, sections: 5, locked: false, projectId: 'prj-001', createdAt: daysAgo(1) },
  ];

  for (const doc of documents) {
    await prisma.document.create({ data: doc });
  }
  console.log(`  Created ${documents.length} documents`);

  // ── 10. Seed Notifications (16 from notification store) ──────────────────

  console.log('Seeding notifications...');

  const notifications = [
    { id: 'n1', type: 'DECISION' as const, title: 'Decision Required', description: 'Decision DEC-004 needs your approval — API authentication strategy', read: false, actionLabel: 'Review', actionHref: '/decisions', userId: 'usr-001', projectId: 'prj-001', createdAt: hoursAgo(0.5) },
    { id: 'n2', type: 'COMPLETION' as const, title: 'Card Completed', description: 'FEAT-012 moved to Done by Senior Developer', read: false, userId: 'usr-001', projectId: 'prj-001', createdAt: hoursAgo(1) },
    { id: 'n3', type: 'AGENT' as const, title: 'Agent Blocked', description: 'QA Engineer blocked on missing test data for integration suite', read: false, actionLabel: 'Unblock', userId: 'usr-001', projectId: 'prj-001', createdAt: hoursAgo(2) },
    { id: 'n4', type: 'PR' as const, title: 'PR Merged', description: 'PR #40 merged to main — feat: add decision voting API', read: false, userId: 'usr-001', projectId: 'prj-001', createdAt: hoursAgo(3) },
    { id: 'n5', type: 'BUILD' as const, title: 'Build Passed', description: 'CI pipeline passed for feature/decision-api (4m 23s)', read: true, userId: 'usr-001', projectId: 'prj-001', createdAt: hoursAgo(4) },
    { id: 'n6', type: 'SECURITY' as const, title: 'Security Alert', description: 'Unusual API usage detected — 3x normal request volume from agent-04', read: false, actionLabel: 'Investigate', userId: 'usr-001', projectId: 'prj-001', createdAt: hoursAgo(5) },
    { id: 'n7', type: 'DEPLOY' as const, title: 'Deploy Successful', description: 'v0.2.0 deployed to staging environment', read: true, userId: 'usr-001', projectId: 'prj-001', createdAt: hoursAgo(6) },
    { id: 'n8', type: 'DECISION' as const, title: 'Decision Approved', description: 'DEC-003 approved — Database schema migration plan', read: true, userId: 'usr-001', projectId: 'prj-001', createdAt: hoursAgo(8) },
    { id: 'n9', type: 'COMPLETION' as const, title: 'Sprint Goal Reached', description: '8/10 story points completed in current sprint', read: true, userId: 'usr-001', projectId: 'prj-001', createdAt: hoursAgo(10) },
    { id: 'n10', type: 'AGENT' as const, title: 'Agent Completed Task', description: 'Frontend Developer finished UI component library setup', read: true, userId: 'usr-001', projectId: 'prj-001', createdAt: daysAgo(1) },
    { id: 'n11', type: 'PR' as const, title: 'PR Review Requested', description: 'PR #39 needs review — refactor: extract shared utils', read: false, actionLabel: 'Review', userId: 'usr-001', projectId: 'prj-001', createdAt: daysAgo(1) },
    { id: 'n12', type: 'FAILURE' as const, title: 'Build Failed', description: 'CI pipeline failed for feature/auth-flow — 2 test failures', read: true, actionLabel: 'View Logs', userId: 'usr-001', projectId: 'prj-001', createdAt: daysAgo(1) },
    { id: 'n13', type: 'DEPLOY' as const, title: 'Deploy Rolled Back', description: 'v0.1.9 rolled back from production — elevated error rate', read: true, userId: 'usr-001', projectId: 'prj-001', createdAt: daysAgo(2) },
    { id: 'n14', type: 'COMPLETION' as const, title: 'Milestone Reached', description: 'MVP feature set 80% complete — on track for release', read: true, userId: 'usr-001', projectId: 'prj-001', createdAt: daysAgo(2) },
    { id: 'n15', type: 'SECURITY' as const, title: 'Dependency Vulnerability', description: 'High severity CVE found in lodash@4.17.20 — update available', read: true, actionLabel: 'Update', userId: 'usr-001', projectId: 'prj-001', createdAt: daysAgo(3) },
    { id: 'n16', type: 'AGENT' as const, title: 'Agent Reassigned', description: 'DevOps Engineer reassigned from INFRA-005 to INFRA-008', read: true, userId: 'usr-001', projectId: 'prj-001', createdAt: daysAgo(3) },
  ];

  for (const notification of notifications) {
    await prisma.notification.create({ data: notification });
  }
  console.log(`  Created ${notifications.length} notifications`);

  // ── 11. Seed Audit Logs (20 entries from mock-admin-data) ────────────────

  console.log('Seeding audit logs...');

  // Map actor emails to user IDs
  const emailToUserId: Record<string, string> = {
    'sarah.chen@techcorp.io': 'usr_001',
    'marcus.j@devstudio.com': 'usr_002',
    'elena.r@startup.co': 'usr_003',
    'david.kim@bigcorp.com': 'usr_004',
    'aisha.patel@freelance.dev': 'usr_005',
    'tom.b@agency.io': 'usr_006',
    'yuki.tanaka@designlab.jp': 'usr_007',
    'james.oc@enterprise.net': 'usr_008',
    'lisa.wang@quantumdev.io': 'usr_009',
    'roberto.s@latamtech.br': 'usr_010',
    'natasha.v@cloudops.eu': 'usr_011',
    'kevin.ng@mobilefirst.app': 'usr_012',
    'priya.sharma@aiventures.in': 'usr_013',
    'michael.t@devshop.us': 'usr_014',
    'hannah.f@berlincode.de': 'usr_015',
    'ahmed.h@nexusai.sa': 'usr_016',
    'sophie.m@paristech.fr': 'usr_017',
    'chris.a@nordicdev.no': 'usr_018',
  };

  const auditLogs = [
    { id: 'audit_001', action: 'user.role_change', target: 'David Kim', details: 'Changed role from user to admin', ipAddress: '192.168.1.42', userId: 'usr_001', createdAt: new Date('2026-03-04T08:15:00Z') },
    { id: 'audit_002', action: 'project.create', target: 'E-Commerce Platform v2', details: 'Created new project with 3 initial agents', ipAddress: '10.0.0.155', userId: 'usr_002', createdAt: new Date('2026-03-04T07:50:00Z') },
    { id: 'audit_003', action: 'user.login', target: 'elena.r@startup.co', details: 'Successful login from Chrome/macOS', ipAddress: '203.45.67.89', userId: 'usr_003', createdAt: new Date('2026-03-04T07:30:00Z') },
    { id: 'audit_004', action: 'settings.update', target: 'Organization Settings', details: 'Updated default LLM provider to Anthropic', ipAddress: '172.16.0.33', userId: 'usr_004', createdAt: new Date('2026-03-04T06:45:00Z') },
    { id: 'audit_005', action: 'billing.upgrade', target: 'Subscription', details: 'Upgraded from starter to pro plan', ipAddress: '85.120.44.12', userId: 'usr_005', createdAt: new Date('2026-03-03T22:10:00Z') },
    { id: 'audit_006', action: 'user.suspend', target: 'Tom Brennan', details: 'Account suspended for TOS violation - excessive API abuse', ipAddress: '192.168.1.42', userId: 'usr_001', createdAt: new Date('2026-03-03T20:00:00Z') },
    { id: 'audit_007', action: 'project.deploy', target: 'Healthcare Dashboard', details: 'Deployed project to production environment', ipAddress: '10.50.0.77', userId: 'usr_008', createdAt: new Date('2026-03-03T18:30:00Z') },
    { id: 'audit_008', action: 'agent.create', target: 'QA Agent - Regression Suite', details: 'Created new QA testing agent with automated regression config', ipAddress: '189.33.21.45', userId: 'usr_010', createdAt: new Date('2026-03-03T16:15:00Z') },
    { id: 'audit_009', action: 'api_key.rotate', target: 'Production API Key', details: 'Rotated API key ending in ...7f3d', ipAddress: '91.210.33.18', userId: 'usr_011', createdAt: new Date('2026-03-03T14:00:00Z') },
    { id: 'audit_010', action: 'project.archive', target: 'Legacy Migration Tool', details: 'Archived completed project with 45 resolved cards', ipAddress: '122.176.55.90', userId: 'usr_013', createdAt: new Date('2026-03-03T12:45:00Z') },
    { id: 'audit_011', action: 'billing.invoice_download', target: 'Invoice #INV-2026-0215', details: 'Downloaded February 2026 invoice', ipAddress: '172.16.0.33', userId: 'usr_004', createdAt: new Date('2026-03-03T11:30:00Z') },
    { id: 'audit_012', action: 'user.login', target: 'hannah.f@berlincode.de', details: 'Successful login from Firefox/Linux', ipAddress: '88.77.66.55', userId: 'usr_015', createdAt: new Date('2026-03-03T10:20:00Z') },
    { id: 'audit_013', action: 'project.settings_update', target: 'Mobile Fitness App', details: 'Changed project visibility to team-only', ipAddress: '76.45.123.88', userId: 'usr_012', createdAt: new Date('2026-03-03T09:00:00Z') },
    { id: 'audit_014', action: 'user.invite', target: 'ahmed.h@nexusai.sa', details: 'Sent enterprise plan invitation', ipAddress: '192.168.1.42', userId: 'usr_001', createdAt: new Date('2026-03-03T08:30:00Z') },
    { id: 'audit_015', action: 'agent.configure', target: 'Code Review Agent', details: 'Updated review strictness to high, added TypeScript rules', ipAddress: '62.110.45.23', userId: 'usr_018', createdAt: new Date('2026-03-02T21:15:00Z') },
    { id: 'audit_016', action: 'project.create', target: 'Portfolio Website Redesign', details: 'Created new project with UI/UX Design starting stage', ipAddress: '212.55.33.44', userId: 'usr_017', createdAt: new Date('2026-03-02T17:45:00Z') },
    { id: 'audit_017', action: 'user.login_failed', target: 'michael.t@devshop.us', details: 'Failed login attempt - account suspended', ipAddress: '45.88.99.112', userId: 'usr_014', createdAt: new Date('2026-03-02T15:30:00Z') },
    { id: 'audit_018', action: 'billing.payment_method_update', target: 'Payment Settings', details: 'Updated payment method to Visa ending in 4242', ipAddress: '133.22.44.88', userId: 'usr_007', createdAt: new Date('2026-03-02T13:00:00Z') },
    { id: 'audit_019', action: 'settings.security_update', target: 'Organization Security', details: 'Enabled mandatory 2FA for all team members', ipAddress: '172.16.0.33', userId: 'usr_004', createdAt: new Date('2026-03-02T10:00:00Z') },
    { id: 'audit_020', action: 'user.signup', target: 'lisa.wang@quantumdev.io', details: 'New account registration - pending email verification', ipAddress: '115.67.88.43', userId: 'usr_009', createdAt: new Date('2026-03-02T09:00:00Z') },
  ];

  for (const log of auditLogs) {
    await prisma.auditLog.create({ data: log });
  }
  console.log(`  Created ${auditLogs.length} audit logs`);

  // ── 12. Seed LLM Usage Data (30 entries from mock-admin-data) ────────────

  console.log('Seeding LLM usage data...');

  const llmUsageData = [
    { tokensUsed: 1250000, cost: 187.50, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Solution Architect', projectId: 'prj-001', createdAt: new Date('2026-03-04T00:00:00Z') },
    { tokensUsed: 890000, cost: 44.50, provider: 'openai', model: 'gpt-4o', agentName: 'Junior Developer', projectId: 'prj-002', createdAt: new Date('2026-03-04T00:00:00Z') },
    { tokensUsed: 1450000, cost: 217.50, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Tech Lead', projectId: 'prj-001', createdAt: new Date('2026-03-03T00:00:00Z') },
    { tokensUsed: 560000, cost: 28.00, provider: 'openai', model: 'gpt-4o-mini', agentName: 'QA Engineer', projectId: 'prj-003', createdAt: new Date('2026-03-03T00:00:00Z') },
    { tokensUsed: 320000, cost: 8.00, provider: 'google', model: 'gemini-pro', agentName: 'Business Analyst', projectId: 'prj-004', createdAt: new Date('2026-03-03T00:00:00Z') },
    { tokensUsed: 980000, cost: 147.00, provider: 'anthropic', model: 'claude-3-sonnet', agentName: 'Senior Developer', projectId: 'prj-005', createdAt: new Date('2026-03-02T00:00:00Z') },
    { tokensUsed: 1120000, cost: 56.00, provider: 'openai', model: 'gpt-4o', agentName: 'Orchestrator', projectId: 'prj-002', createdAt: new Date('2026-03-02T00:00:00Z') },
    { tokensUsed: 445000, cost: 11.13, provider: 'google', model: 'gemini-pro', agentName: 'UI/UX Designer', projectId: 'prj-001', createdAt: new Date('2026-03-02T00:00:00Z') },
    { tokensUsed: 1680000, cost: 252.00, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Solution Architect', projectId: 'prj-001', createdAt: new Date('2026-03-01T00:00:00Z') },
    { tokensUsed: 720000, cost: 36.00, provider: 'openai', model: 'gpt-4o', agentName: 'DevOps Engineer', projectId: 'prj-003', createdAt: new Date('2026-03-01T00:00:00Z') },
    { tokensUsed: 1340000, cost: 201.00, provider: 'anthropic', model: 'claude-3-sonnet', agentName: 'Tech Lead', projectId: 'prj-005', createdAt: new Date('2026-02-28T00:00:00Z') },
    { tokensUsed: 890000, cost: 44.50, provider: 'openai', model: 'gpt-4o', agentName: 'Junior Developer', projectId: 'prj-001', createdAt: new Date('2026-02-28T00:00:00Z') },
    { tokensUsed: 560000, cost: 14.00, provider: 'google', model: 'gemini-pro', agentName: 'Product Manager', projectId: 'prj-003', createdAt: new Date('2026-02-27T00:00:00Z') },
    { tokensUsed: 1190000, cost: 178.50, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Solution Architect', projectId: 'prj-004', createdAt: new Date('2026-02-27T00:00:00Z') },
    { tokensUsed: 670000, cost: 33.50, provider: 'openai', model: 'gpt-4o-mini', agentName: 'QA Engineer', projectId: 'prj-002', createdAt: new Date('2026-02-26T00:00:00Z') },
    { tokensUsed: 1520000, cost: 228.00, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Senior Developer', projectId: 'prj-001', createdAt: new Date('2026-02-26T00:00:00Z') },
    { tokensUsed: 390000, cost: 9.75, provider: 'google', model: 'gemini-pro', agentName: 'Cost Analyst', projectId: 'prj-005', createdAt: new Date('2026-02-25T00:00:00Z') },
    { tokensUsed: 1050000, cost: 52.50, provider: 'openai', model: 'gpt-4o', agentName: 'Platform Engineer', projectId: 'prj-005', createdAt: new Date('2026-02-25T00:00:00Z') },
    { tokensUsed: 1780000, cost: 267.00, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Tech Lead', projectId: 'prj-003', createdAt: new Date('2026-02-24T00:00:00Z') },
    { tokensUsed: 430000, cost: 21.50, provider: 'openai', model: 'gpt-4o-mini', agentName: 'Automation Test', projectId: 'prj-003', createdAt: new Date('2026-02-24T00:00:00Z') },
    { tokensUsed: 910000, cost: 136.50, provider: 'anthropic', model: 'claude-3-sonnet', agentName: 'Solution Architect', projectId: 'prj-002', createdAt: new Date('2026-02-23T00:00:00Z') },
    { tokensUsed: 280000, cost: 7.00, provider: 'google', model: 'gemini-pro', agentName: 'Prompt Engineer', projectId: 'prj-004', createdAt: new Date('2026-02-23T00:00:00Z') },
    { tokensUsed: 1610000, cost: 241.50, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Senior Developer', projectId: 'prj-001', createdAt: new Date('2026-02-22T00:00:00Z') },
    { tokensUsed: 750000, cost: 37.50, provider: 'openai', model: 'gpt-4o', agentName: 'Integration Engineer', projectId: 'prj-004', createdAt: new Date('2026-02-22T00:00:00Z') },
    { tokensUsed: 520000, cost: 13.00, provider: 'google', model: 'gemini-pro', agentName: 'UI/UX Designer', projectId: 'prj-004', createdAt: new Date('2026-02-21T00:00:00Z') },
    { tokensUsed: 1390000, cost: 208.50, provider: 'anthropic', model: 'claude-3-sonnet', agentName: 'Tech Lead', projectId: 'prj-005', createdAt: new Date('2026-02-21T00:00:00Z') },
    { tokensUsed: 840000, cost: 42.00, provider: 'openai', model: 'gpt-4o', agentName: 'DevOps Engineer', projectId: 'prj-003', createdAt: new Date('2026-02-20T00:00:00Z') },
    { tokensUsed: 1150000, cost: 172.50, provider: 'anthropic', model: 'claude-3-opus', agentName: 'LLM Gateway Manager', projectId: 'prj-005', createdAt: new Date('2026-02-20T00:00:00Z') },
    { tokensUsed: 690000, cost: 34.50, provider: 'openai', model: 'gpt-4o-mini', agentName: 'Performance Engineer', projectId: 'prj-004', createdAt: new Date('2026-02-19T00:00:00Z') },
    { tokensUsed: 470000, cost: 11.75, provider: 'google', model: 'gemini-pro', agentName: 'Secrets Manager', projectId: 'prj-001', createdAt: new Date('2026-02-19T00:00:00Z') },
  ];

  await prisma.lLMUsage.createMany({ data: llmUsageData });
  console.log(`  Created ${llmUsageData.length} LLM usage records`);

  // ── 13. Seed Transactions (12 from mock-admin-data) ──────────────────────

  console.log('Seeding transactions...');

  const planMap: Record<string, 'STARTER' | 'PRO' | 'ENTERPRISE'> = {
    starter: 'STARTER',
    pro: 'PRO',
    enterprise: 'ENTERPRISE',
  };

  const txStatusMap: Record<string, 'COMPLETED' | 'PENDING' | 'FAILED' | 'REFUNDED'> = {
    completed: 'COMPLETED',
    pending: 'PENDING',
    failed: 'FAILED',
    refunded: 'REFUNDED',
  };

  const transactions = [
    { id: 'txn_001', userName: 'Sarah Chen', userEmail: 'sarah.chen@techcorp.io', amount: 299.00, plan: 'ENTERPRISE' as const, status: 'COMPLETED' as const, createdAt: new Date('2026-03-01T00:00:00Z') },
    { id: 'txn_002', userName: 'Marcus Johnson', userEmail: 'marcus.j@devstudio.com', amount: 49.00, plan: 'PRO' as const, status: 'COMPLETED' as const, createdAt: new Date('2026-03-01T00:00:00Z') },
    { id: 'txn_003', userName: 'Aisha Patel', userEmail: 'aisha.patel@freelance.dev', amount: 49.00, plan: 'PRO' as const, status: 'COMPLETED' as const, createdAt: new Date('2026-03-01T00:00:00Z') },
    { id: 'txn_004', userName: "James O'Connor", userEmail: 'james.oc@enterprise.net', amount: 299.00, plan: 'ENTERPRISE' as const, status: 'COMPLETED' as const, createdAt: new Date('2026-03-01T00:00:00Z') },
    { id: 'txn_005', userName: 'Tom Brennan', userEmail: 'tom.b@agency.io', amount: 49.00, plan: 'PRO' as const, status: 'REFUNDED' as const, createdAt: new Date('2026-02-28T00:00:00Z') },
    { id: 'txn_006', userName: 'Natasha Volkov', userEmail: 'natasha.v@cloudops.eu', amount: 299.00, plan: 'ENTERPRISE' as const, status: 'COMPLETED' as const, createdAt: new Date('2026-03-01T00:00:00Z') },
    { id: 'txn_007', userName: 'Roberto Silva', userEmail: 'roberto.s@latamtech.br', amount: 49.00, plan: 'PRO' as const, status: 'COMPLETED' as const, createdAt: new Date('2026-03-01T00:00:00Z') },
    { id: 'txn_008', userName: 'Hannah Fischer', userEmail: 'hannah.f@berlincode.de', amount: 49.00, plan: 'PRO' as const, status: 'PENDING' as const, createdAt: new Date('2026-03-03T00:00:00Z') },
    { id: 'txn_009', userName: 'Kevin Nguyen', userEmail: 'kevin.ng@mobilefirst.app', amount: 19.00, plan: 'STARTER' as const, status: 'COMPLETED' as const, createdAt: new Date('2026-03-01T00:00:00Z') },
    { id: 'txn_010', userName: 'Michael Torres', userEmail: 'michael.t@devshop.us', amount: 19.00, plan: 'STARTER' as const, status: 'FAILED' as const, createdAt: new Date('2026-02-25T00:00:00Z') },
    { id: 'txn_011', userName: 'Chris Andersen', userEmail: 'chris.a@nordicdev.no', amount: 49.00, plan: 'PRO' as const, status: 'COMPLETED' as const, createdAt: new Date('2026-03-01T00:00:00Z') },
    { id: 'txn_012', userName: 'Ahmed Hassan', userEmail: 'ahmed.h@nexusai.sa', amount: 299.00, plan: 'ENTERPRISE' as const, status: 'PENDING' as const, createdAt: new Date('2026-03-03T00:00:00Z') },
  ];

  await prisma.transaction.createMany({ data: transactions });
  console.log(`  Created ${transactions.length} transactions`);

  // ── 12. Seed Git Branches (6 for prj-001) ────────────────────────────────

  console.log('\nSeeding git branches...');
  const gitBranches = [
    { id: 'br-001', name: 'main', status: 'ACTIVE' as const, lastCommit: '2h ago', author: 'DevOps', behind: 0, ahead: 0, projectId: 'prj-001' },
    { id: 'br-002', name: 'feature/decision-api', status: 'ACTIVE' as const, lastCommit: '15min ago', author: 'Junior Dev', behind: 2, ahead: 8, projectId: 'prj-001' },
    { id: 'br-003', name: 'feature/state-machine', status: 'ACTIVE' as const, lastCommit: '1h ago', author: 'Senior Dev', behind: 1, ahead: 12, projectId: 'prj-001' },
    { id: 'br-004', name: 'feature/llm-gateway', status: 'ACTIVE' as const, lastCommit: '3h ago', author: 'Sol. Architect', behind: 4, ahead: 6, projectId: 'prj-001' },
    { id: 'br-005', name: 'fix/event-ordering', status: 'ACTIVE' as const, lastCommit: '4h ago', author: 'QA Engineer', behind: 3, ahead: 3, projectId: 'prj-001' },
    { id: 'br-006', name: 'feature/auth-setup', status: 'STALE' as const, lastCommit: '3d ago', author: 'Junior Dev', behind: 15, ahead: 2, projectId: 'prj-001' },
  ];
  for (const b of gitBranches) { await prisma.gitBranch.create({ data: b }); }
  console.log(`  Created ${gitBranches.length} git branches`);

  // ── 13. Seed Git Pull Requests (5 for prj-001) ─────────────────────────

  console.log('Seeding git pull requests...');
  const gitPRs = [
    { id: 'pr-043', number: 43, title: 'feat: implement decision approval workflow', branch: 'feature/decision-api', status: 'OPEN' as const, author: 'Junior Developer', avatar: '💻', reviewers: ['SD', 'TL'], checks: 'PASSING' as const, additions: 342, deletions: 28, comments: 5, projectId: 'prj-001' },
    { id: 'pr-042', number: 42, title: 'feat: card state machine with transition validation', branch: 'feature/state-machine', status: 'OPEN' as const, author: 'Senior Developer', avatar: '🔍', reviewers: ['TL'], checks: 'PENDING' as const, additions: 890, deletions: 156, comments: 12, projectId: 'prj-001' },
    { id: 'pr-041', number: 41, title: 'fix: event bus message ordering (FIFO)', branch: 'fix/event-ordering', status: 'OPEN' as const, author: 'QA Engineer', avatar: '🧪', reviewers: ['SD'], checks: 'PASSING' as const, additions: 67, deletions: 23, comments: 2, projectId: 'prj-001' },
    { id: 'pr-040', number: 40, title: 'feat: board CRUD with atomic file writes', branch: 'feature/board-crud', status: 'MERGED' as const, author: 'Junior Developer', avatar: '💻', reviewers: ['SD', 'TL'], checks: 'PASSING' as const, additions: 456, deletions: 12, comments: 8, projectId: 'prj-001' },
    { id: 'pr-039', number: 39, title: 'feat: event logging system (events.jsonl)', branch: 'feature/event-log', status: 'MERGED' as const, author: 'Junior Developer', avatar: '💻', reviewers: ['TL'], checks: 'PASSING' as const, additions: 234, deletions: 5, comments: 3, projectId: 'prj-001' },
  ];
  for (const pr of gitPRs) { await prisma.gitPullRequest.create({ data: pr }); }
  console.log(`  Created ${gitPRs.length} git pull requests`);

  // ── 14. Seed Git Releases (3 for prj-001) ──────────────────────────────

  console.log('Seeding git releases...');
  const gitReleases = [
    { id: 'rel-001', version: 'v0.3.0', date: 'Today', status: 'DRAFT' as const, changes: 24, features: ['Decision engine', 'State machine', 'LLM gateway'], projectId: 'prj-001' },
    { id: 'rel-002', version: 'v0.2.0', date: 'Feb 28', status: 'RELEASED' as const, changes: 18, features: ['Board CRUD', 'Event logging', 'Project scaffold'], projectId: 'prj-001' },
    { id: 'rel-003', version: 'v0.1.0', date: 'Feb 15', status: 'RELEASED' as const, changes: 12, features: ['Initial scaffold', 'CLI setup', 'Basic routing'], projectId: 'prj-001' },
  ];
  for (const r of gitReleases) { await prisma.gitRelease.create({ data: r }); }
  console.log(`  Created ${gitReleases.length} git releases`);

  // ── 15. Seed Wireframes (6 for prj-001) ────────────────────────────────

  console.log('Seeding wireframes...');
  const wireframes = [
    { id: 'wf-001', title: 'Dashboard Overview', screen: 'dashboard', status: 'APPROVED' as const, device: 'DESKTOP' as const, owner: 'UI/UX Designer', ownerAvatar: '🎨', components: 14, version: 3, projectId: 'prj-001', updatedAt: daysAgo(3) },
    { id: 'wf-002', title: 'Kanban Board', screen: 'board', status: 'APPROVED' as const, device: 'DESKTOP' as const, owner: 'UI/UX Designer', ownerAvatar: '🎨', components: 22, version: 5, projectId: 'prj-001', updatedAt: daysAgo(2) },
    { id: 'wf-003', title: 'Agent Chat Interface', screen: 'chat', status: 'REVIEW' as const, device: 'DESKTOP' as const, owner: 'UI/UX Designer', ownerAvatar: '🎨', components: 18, version: 2, projectId: 'prj-001', updatedAt: hoursAgo(6) },
    { id: 'wf-004', title: 'Decision Panel', screen: 'decisions', status: 'APPROVED' as const, device: 'DESKTOP' as const, owner: 'UI/UX Designer', ownerAvatar: '🎨', components: 16, version: 4, projectId: 'prj-001', updatedAt: daysAgo(4) },
    { id: 'wf-005', title: 'Mobile Dashboard', screen: 'dashboard-mobile', status: 'DRAFT' as const, device: 'MOBILE' as const, owner: 'UI/UX Designer', ownerAvatar: '🎨', components: 8, version: 1, projectId: 'prj-001', updatedAt: hoursAgo(1) },
    { id: 'wf-006', title: 'Settings - LLM Config', screen: 'settings', status: 'DRAFT' as const, device: 'DESKTOP' as const, owner: 'UI/UX Designer', ownerAvatar: '🎨', components: 12, version: 1, projectId: 'prj-001', updatedAt: hoursAgo(2) },
  ];
  for (const w of wireframes) { await prisma.wireframe.create({ data: w }); }
  console.log(`  Created ${wireframes.length} wireframes`);

  // ── 16. Seed LLM Provider Configs (BYOM) ─────────────────────────────────

  console.log('\nSeeding LLM provider configs...');
  const llmProviderConfigs = [
    {
      id: 'llm-cfg-001',
      provider: 'mock',
      displayName: 'Demo Mode (Built-in)',
      defaultModel: 'mock-standard',
      isActive: true,
      scope: 'USER' as const,
      userId: 'usr-001',
    },
    {
      id: 'llm-cfg-002',
      provider: 'mock',
      displayName: 'Demo Mode (Built-in)',
      defaultModel: 'mock-standard',
      isActive: true,
      scope: 'USER' as const,
      userId: 'usr-002',
    },
    {
      id: 'llm-cfg-003',
      provider: 'openai',
      displayName: 'OpenAI — GPT-4o',
      defaultModel: 'gpt-4o',
      isActive: false,
      scope: 'PROJECT' as const,
      projectId: 'prj-001',
    },
    {
      id: 'llm-cfg-004',
      provider: 'anthropic',
      displayName: 'Anthropic — Claude 3.5',
      defaultModel: 'claude-3-5-sonnet-20241022',
      isActive: false,
      scope: 'PROJECT' as const,
      projectId: 'prj-002',
    },
  ];
  for (const cfg of llmProviderConfigs) { await prisma.lLMProviderConfig.create({ data: cfg }); }
  console.log(`  Created ${llmProviderConfigs.length} LLM provider configs`);

  // ── 17. Seed Orchestration Events ───────────────────────────────────────

  console.log('Seeding orchestration events...');
  const orchestrationEvents = [
    { id: 'evt-001', type: 'MessageProcessed', actor: 'ORC', payload: JSON.stringify({ intent: 'new_requirement', routedTo: 'BA' }), projectId: 'prj-001', createdAt: hoursAgo(2) },
    { id: 'evt-002', type: 'TaskCreated', actor: 'BA', payload: JSON.stringify({ cardId: 'card-001', title: 'Gather login requirements' }), projectId: 'prj-001', createdAt: hoursAgo(2) },
    { id: 'evt-003', type: 'AgentDelegated', actor: 'BA', payload: JSON.stringify({ from: 'BA', to: 'SA', context: 'Architecture review for auth module' }), projectId: 'prj-001', createdAt: hoursAgo(1.5) },
    { id: 'evt-004', type: 'DecisionRequested', actor: 'SA', payload: JSON.stringify({ trigger: 'Auth approach selection', options: ['JWT', 'Session-based', 'OAuth2'] }), projectId: 'prj-001', createdAt: hoursAgo(1) },
    { id: 'evt-005', type: 'MessageProcessed', actor: 'ORC', payload: JSON.stringify({ intent: 'status_query', routedTo: 'ORC' }), projectId: 'prj-001', createdAt: hoursAgo(0.5) },
    { id: 'evt-006', type: 'TaskCreated', actor: 'PM', payload: JSON.stringify({ cardId: 'card-002', title: 'Define MVP scope' }), projectId: 'prj-002', createdAt: hoursAgo(4) },
    { id: 'evt-007', type: 'MessageProcessed', actor: 'ORC', payload: JSON.stringify({ intent: 'ui_feedback', routedTo: 'UX' }), projectId: 'prj-002', createdAt: hoursAgo(3) },
    { id: 'evt-008', type: 'MessageProcessed', actor: 'ORC', payload: JSON.stringify({ intent: 'bug_report', routedTo: 'QA' }), projectId: 'prj-003', createdAt: hoursAgo(5) },
    { id: 'evt-009', type: 'AgentDelegated', actor: 'QA', payload: JSON.stringify({ from: 'QA', to: 'SD', context: 'Fix critical login bug' }), projectId: 'prj-003', createdAt: hoursAgo(4.5) },
    { id: 'evt-010', type: 'MessageProcessed', actor: 'ORC', payload: JSON.stringify({ intent: 'cost_query', routedTo: 'CA' }), projectId: 'prj-005', createdAt: hoursAgo(6) },
  ];
  await prisma.event.createMany({ data: orchestrationEvents });
  console.log(`  Created ${orchestrationEvents.length} orchestration events`);

  // ── 18. Seed Artifacts ──────────────────────────────────────────────────

  console.log('Seeding artifacts...');
  const artifacts = [
    { id: 'art-001', name: 'auth-middleware.ts', type: 'CODE' as const, content: 'import { NextRequest, NextResponse } from \'next/server\';\nimport { verify } from \'jsonwebtoken\';\n\nexport function withAuth(handler: Function) {\n  return async (req: NextRequest) => {\n    const token = req.headers.get(\'authorization\')?.split(\' \')[1];\n    if (!token) {\n      return NextResponse.json({ error: \'Unauthorized\' }, { status: 401 });\n    }\n    try {\n      const decoded = verify(token, process.env.JWT_SECRET!);\n      return handler(req, decoded);\n    } catch {\n      return NextResponse.json({ error: \'Invalid token\' }, { status: 401 });\n    }\n  };\n}', ownerAgent: 'SD', version: 1, projectId: 'prj-001', createdAt: hoursAgo(2) },
    { id: 'art-002', name: 'user-service.ts', type: 'CODE' as const, content: 'import { prisma } from \'@/lib/prisma\';\nimport bcrypt from \'bcryptjs\';\n\nexport class UserService {\n  async create(email: string, password: string, name: string) {\n    const hash = await bcrypt.hash(password, 10);\n    return prisma.user.create({\n      data: { email, passwordHash: hash, name },\n    });\n  }\n\n  async findByEmail(email: string) {\n    return prisma.user.findUnique({ where: { email } });\n  }\n\n  async validatePassword(email: string, password: string) {\n    const user = await this.findByEmail(email);\n    if (!user || !user.passwordHash) return null;\n    const valid = await bcrypt.compare(password, user.passwordHash);\n    return valid ? user : null;\n  }\n}', ownerAgent: 'JD', version: 1, projectId: 'prj-001', createdAt: hoursAgo(1.5) },
    { id: 'art-003', name: 'auth.test.ts', type: 'TEST' as const, content: 'import { describe, it, expect, beforeEach } from \'vitest\';\nimport { UserService } from \'./user-service\';\n\ndescribe(\'UserService\', () => {\n  let service: UserService;\n\n  beforeEach(() => {\n    service = new UserService();\n  });\n\n  it(\'should create a user with hashed password\', async () => {\n    const user = await service.create(\'test@example.com\', \'pass123\', \'Test\');\n    expect(user.email).toBe(\'test@example.com\');\n    expect(user.passwordHash).not.toBe(\'pass123\');\n  });\n\n  it(\'should validate correct password\', async () => {\n    await service.create(\'test@example.com\', \'pass123\', \'Test\');\n    const result = await service.validatePassword(\'test@example.com\', \'pass123\');\n    expect(result).not.toBeNull();\n  });\n\n  it(\'should reject wrong password\', async () => {\n    await service.create(\'test@example.com\', \'pass123\', \'Test\');\n    const result = await service.validatePassword(\'test@example.com\', \'wrong\');\n    expect(result).toBeNull();\n  });\n});', ownerAgent: 'QA', version: 1, projectId: 'prj-001', createdAt: hoursAgo(1) },
    { id: 'art-004', name: 'docker-compose.yml', type: 'CONFIG' as const, content: 'version: "3.8"\nservices:\n  app:\n    build: .\n    ports:\n      - "3000:3000"\n    environment:\n      - DATABASE_URL=postgresql://user:pass@db:5432/app\n    depends_on:\n      - db\n      - redis\n  db:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_DB: ai_team_studio\n      POSTGRES_USER: ats_user\n      POSTGRES_PASSWORD: ats_secret\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n    ports:\n      - "5432:5432"\n  redis:\n    image: redis:7-alpine\n    ports:\n      - "6379:6379"\nvolumes:\n  pgdata:', ownerAgent: 'DO', version: 2, projectId: 'prj-001', createdAt: daysAgo(1) },
    { id: 'art-005', name: 'login.e2e.ts', type: 'TEST' as const, content: 'import { test, expect } from \'@playwright/test\';\n\ntest.describe(\'Login Flow\', () => {\n  test.beforeEach(async ({ page }) => {\n    await page.goto(\'/login\');\n  });\n\n  test(\'should display login form\', async ({ page }) => {\n    await expect(page.getByRole(\'heading\', { name: \'Sign In\' })).toBeVisible();\n    await expect(page.getByLabel(\'Email\')).toBeVisible();\n    await expect(page.getByLabel(\'Password\')).toBeVisible();\n  });\n\n  test(\'should login with valid credentials\', async ({ page }) => {\n    await page.getByLabel(\'Email\').fill(\'user@demo.com\');\n    await page.getByLabel(\'Password\').fill(\'password123\');\n    await page.getByRole(\'button\', { name: \'Sign In\' }).click();\n    await expect(page).toHaveURL(\'/projects\');\n  });\n\n  test(\'should show error for invalid credentials\', async ({ page }) => {\n    await page.getByLabel(\'Email\').fill(\'user@demo.com\');\n    await page.getByLabel(\'Password\').fill(\'wrong\');\n    await page.getByRole(\'button\', { name: \'Sign In\' }).click();\n    await expect(page.getByText(\'Invalid email or password\')).toBeVisible();\n  });\n});', ownerAgent: 'AT', version: 1, projectId: 'prj-001', createdAt: hoursAgo(0.5) },
    { id: 'art-006', name: 'architecture.yaml', type: 'CONFIG' as const, content: 'system:\n  name: AI Team Studio\n  version: "1.0"\n\nlayers:\n  presentation:\n    technology: "Next.js 16 / React 19"\n    pattern: "Server Components + Client Islands"\n  application:\n    technology: "Node.js / TypeScript"\n    pattern: "Service Layer + Repository Pattern"\n  data:\n    technology: "PostgreSQL 16 / Prisma ORM"\n    pattern: "Repository with Unit of Work"\n\nsecurity:\n  authentication: "JWT with refresh token rotation"\n  encryption: "AES-256-GCM for secrets at rest"\n  transport: "TLS 1.3 minimum"', ownerAgent: 'SA', version: 1, projectId: 'prj-001', createdAt: hoursAgo(3) },
    { id: 'art-007', name: 'main.tf', type: 'CONFIG' as const, content: 'terraform {\n  required_version = ">= 1.5"\n  required_providers {\n    aws = {\n      source  = "hashicorp/aws"\n      version = "~> 5.0"\n    }\n  }\n}\n\nprovider "aws" {\n  region = var.aws_region\n}\n\nvariable "aws_region" {\n  default = "us-east-1"\n}\n\nresource "aws_ecs_cluster" "main" {\n  name = "ai-team-studio-cluster"\n}\n\nresource "aws_db_instance" "postgres" {\n  identifier        = "ai-team-studio-db"\n  engine            = "postgres"\n  engine_version    = "16"\n  instance_class    = "db.t3.medium"\n  allocated_storage = 20\n  db_name           = "ai_team_studio"\n}', ownerAgent: 'PE', version: 1, projectId: 'prj-001', createdAt: daysAgo(2) },
    { id: 'art-008', name: 'LoginForm.tsx', type: 'CODE' as const, content: '// UI Component Specification — Login Form\n\ninterface LoginFormProps {\n  onSubmit: (email: string, password: string) => Promise<void>;\n  onForgotPassword: () => void;\n  isLoading?: boolean;\n  error?: string;\n}\n\nexport default function LoginForm({ onSubmit, onForgotPassword, isLoading, error }: LoginFormProps) {\n  const [email, setEmail] = useState(\'\');\n  const [password, setPassword] = useState(\'\');\n\n  const handleSubmit = async (e: FormEvent) => {\n    e.preventDefault();\n    await onSubmit(email, password);\n  };\n\n  return (\n    <form onSubmit={handleSubmit} className="space-y-4">\n      <Input label="Email" type="email" value={email} onChange={setEmail} />\n      <Input label="Password" type="password" value={password} onChange={setPassword} />\n      {error && <Alert variant="error">{error}</Alert>}\n      <Button type="submit" loading={isLoading}>Sign In</Button>\n      <button type="button" onClick={onForgotPassword}>Forgot password?</button>\n    </form>\n  );\n}', ownerAgent: 'UX', version: 1, projectId: 'prj-002', createdAt: hoursAgo(5) },
  ];
  for (const art of artifacts) { await prisma.artifact.create({ data: art }); }
  console.log(`  Created ${artifacts.length} artifacts`);

  // ── 19. Seed Orchestration Runs ─────────────────────────────────────────

  console.log('Seeding orchestration runs...');
  const orchestrationRuns = [
    { id: 'run-001', status: 'COMPLETED' as const, userMessage: 'I want to build a web app with user authentication', routedTo: 'BA', autoRouted: true, delegations: ['BA', 'SA'], tokensTotal: 3200, costTotal: 0.048, latencyMs: 2400, projectId: 'prj-001', userId: 'usr-001', createdAt: hoursAgo(2), completedAt: hoursAgo(1.9) },
    { id: 'run-002', status: 'COMPLETED' as const, userMessage: 'What architecture should we use for the auth system?', routedTo: 'SA', autoRouted: true, delegations: [], tokensTotal: 4100, costTotal: 0.062, latencyMs: 3100, projectId: 'prj-001', userId: 'usr-001', createdAt: hoursAgo(1.5), completedAt: hoursAgo(1.4) },
    { id: 'run-003', status: 'COMPLETED' as const, userMessage: 'What is the current project status?', routedTo: 'ORC', autoRouted: true, delegations: [], tokensTotal: 1800, costTotal: 0.027, latencyMs: 1200, projectId: 'prj-001', userId: 'usr-001', createdAt: hoursAgo(0.5), completedAt: hoursAgo(0.45) },
    { id: 'run-004', status: 'COMPLETED' as const, userMessage: 'Define the MVP scope for the e-commerce platform', routedTo: 'PM', autoRouted: true, delegations: ['PM'], tokensTotal: 2900, costTotal: 0.044, latencyMs: 2800, projectId: 'prj-002', userId: 'usr-001', createdAt: hoursAgo(4), completedAt: hoursAgo(3.9) },
    { id: 'run-005', status: 'COMPLETED' as const, userMessage: 'The login page has a layout bug on mobile', routedTo: 'QA', autoRouted: true, delegations: ['QA', 'SD'], tokensTotal: 3600, costTotal: 0.054, latencyMs: 3400, projectId: 'prj-003', userId: 'usr-001', createdAt: hoursAgo(5), completedAt: hoursAgo(4.8) },
    { id: 'run-006', status: 'COMPLETED' as const, userMessage: 'How much are we spending on LLM calls this month?', routedTo: 'CA', autoRouted: true, delegations: [], tokensTotal: 1500, costTotal: 0.023, latencyMs: 1100, projectId: 'prj-005', userId: 'usr-002', createdAt: hoursAgo(6), completedAt: hoursAgo(5.9) },
    { id: 'run-007', status: 'FAILED' as const, userMessage: 'Generate the full deployment pipeline', routedTo: 'DO', autoRouted: true, delegations: [], tokensTotal: 800, costTotal: 0.012, latencyMs: 30000, errorMessage: 'LLM request timed out after 30s', projectId: 'prj-003', userId: 'usr-001', createdAt: hoursAgo(8), completedAt: hoursAgo(7.9) },
    { id: 'run-008', status: 'COMPLETED' as const, userMessage: 'Review the code quality of the auth module', routedTo: 'SD', autoRouted: false, delegations: [], tokensTotal: 5200, costTotal: 0.078, latencyMs: 4200, projectId: 'prj-001', userId: 'usr-001', createdAt: hoursAgo(3), completedAt: hoursAgo(2.8) },
  ];
  await prisma.orchestrationRun.createMany({ data: orchestrationRuns });
  console.log(`  Created ${orchestrationRuns.length} orchestration runs`);

  // ── 20. Seed Deployment Pipelines & Runs ────────────────────────────────

  console.log('Seeding deployment pipelines...');

  const deploymentPipelines = [
    {
      id: 'pipe-001',
      name: 'staging-deploy',
      environment: 'STAGING' as const,
      trigger: 'MANUAL' as const,
      config: JSON.stringify({ buildCmd: 'npm run build', testCmd: 'npm test', deployCmd: 'docker compose up -d' }),
      projectId: 'prj-001',
      createdAt: daysAgo(14),
    },
    {
      id: 'pipe-002',
      name: 'production-deploy',
      environment: 'PRODUCTION' as const,
      trigger: 'MANUAL' as const,
      config: JSON.stringify({ buildCmd: 'npm run build', testCmd: 'npm test && npm run e2e', deployCmd: 'kubectl apply -f k8s/' }),
      projectId: 'prj-001',
      createdAt: daysAgo(10),
    },
    {
      id: 'pipe-003',
      name: 'staging-deploy',
      environment: 'STAGING' as const,
      trigger: 'AUTO_ON_MERGE' as const,
      config: JSON.stringify({ buildCmd: 'npm run build', testCmd: 'npm test', deployCmd: 'fly deploy' }),
      projectId: 'prj-002',
      createdAt: daysAgo(7),
    },
    {
      id: 'pipe-004',
      name: 'dev-deploy',
      environment: 'DEVELOPMENT' as const,
      trigger: 'AGENT' as const,
      config: JSON.stringify({ buildCmd: 'npm run build', deployCmd: 'vercel --prod' }),
      projectId: 'prj-003',
      createdAt: daysAgo(5),
    },
  ];

  for (const pipe of deploymentPipelines) {
    await prisma.deploymentPipeline.create({ data: pipe });
  }
  console.log(`  Created ${deploymentPipelines.length} deployment pipelines`);

  console.log('Seeding deployment runs...');

  const deploymentRuns = [
    // prj-001 staging: one success, one running
    {
      id: 'drun-001',
      pipelineId: 'pipe-001',
      status: 'SUCCESS' as const,
      currentStage: 'COMPLETE' as const,
      triggeredBy: 'user',
      commitHash: 'a3f7c21',
      branch: 'main',
      buildLogs: '[12:00:01] Installing dependencies...\n[12:00:15] Dependencies installed.\n[12:00:16] Building application...\n[12:01:02] Build completed successfully.',
      testLogs: '[12:01:03] Running test suite...\n[12:01:45] 142 tests passed, 0 failed.\n[12:01:45] All tests passed.',
      deployLogs: '[12:01:46] Deploying to staging...\n[12:02:10] Container built and pushed.\n[12:02:30] Service restarted. Deployment complete.',
      durationMs: 149000,
      projectId: 'prj-001',
      createdAt: daysAgo(2),
      startedAt: daysAgo(2),
      completedAt: new Date(daysAgo(2).getTime() + 149000),
    },
    {
      id: 'drun-002',
      pipelineId: 'pipe-001',
      status: 'RUNNING' as const,
      currentStage: 'TEST' as const,
      triggeredBy: 'DO',
      commitHash: 'b8e4f19',
      branch: 'feature/auth-v2',
      buildLogs: '[14:00:01] Installing dependencies...\n[14:00:18] Dependencies installed.\n[14:00:19] Building application...\n[14:01:05] Build completed successfully.',
      testLogs: '[14:01:06] Running test suite...\n[14:01:30] 98 of 142 tests completed...',
      deployLogs: '',
      durationMs: 0,
      projectId: 'prj-001',
      createdAt: hoursAgo(1),
      startedAt: hoursAgo(1),
    },
    // prj-001 production: one failed
    {
      id: 'drun-003',
      pipelineId: 'pipe-002',
      status: 'FAILED' as const,
      currentStage: 'DEPLOY' as const,
      triggeredBy: 'user',
      commitHash: '9c2d4e7',
      branch: 'main',
      buildLogs: '[10:00:01] Installing dependencies...\n[10:00:14] Dependencies installed.\n[10:00:15] Building application...\n[10:00:58] Build completed successfully.',
      testLogs: '[10:00:59] Running test suite...\n[10:01:40] 142 tests passed, 0 failed.\n[10:01:40] All tests passed.',
      deployLogs: '[10:01:41] Deploying to production...\n[10:02:05] Error: kubectl connection refused. Cluster unreachable.',
      errorMessage: 'Deployment failed: kubectl connection refused. Cluster unreachable.',
      durationMs: 124000,
      projectId: 'prj-001',
      createdAt: daysAgo(5),
      startedAt: daysAgo(5),
      completedAt: new Date(daysAgo(5).getTime() + 124000),
    },
    // prj-002 staging: one success
    {
      id: 'drun-004',
      pipelineId: 'pipe-003',
      status: 'SUCCESS' as const,
      currentStage: 'COMPLETE' as const,
      triggeredBy: 'auto',
      commitHash: 'f1a2b3c',
      branch: 'main',
      buildLogs: '[08:00:01] Installing dependencies...\n[08:00:12] Building application...\n[08:00:48] Build completed successfully.',
      testLogs: '[08:00:49] Running test suite...\n[08:01:22] 87 tests passed, 0 failed.',
      deployLogs: '[08:01:23] Deploying to staging via Fly.io...\n[08:01:55] Deployment complete.',
      durationMs: 114000,
      projectId: 'prj-002',
      createdAt: daysAgo(1),
      startedAt: daysAgo(1),
      completedAt: new Date(daysAgo(1).getTime() + 114000),
    },
    // prj-003 dev: one pending
    {
      id: 'drun-005',
      pipelineId: 'pipe-004',
      status: 'PENDING' as const,
      currentStage: 'BUILD' as const,
      triggeredBy: 'DO',
      commitHash: 'e5d6c7b',
      branch: 'develop',
      buildLogs: '',
      testLogs: '',
      deployLogs: '',
      durationMs: 0,
      projectId: 'prj-003',
      createdAt: hoursAgo(0.5),
    },
  ];

  for (const run of deploymentRuns) {
    await prisma.deploymentRun.create({ data: run });
  }
  console.log(`  Created ${deploymentRuns.length} deployment runs`);

  // ── 21. Seed Admin Settings ────────────────────────────────────────────

  console.log('Seeding admin settings...');

  const adminSettings = [
    { key: 'llm.defaultProvider', value: JSON.stringify('anthropic'), updatedBy: 'usr-002' },
    { key: 'llm.maxTokens', value: JSON.stringify(4096), updatedBy: 'usr-002' },
    { key: 'llm.temperature', value: JSON.stringify(0.7), updatedBy: 'usr-002' },
    { key: 'featureFlags', value: JSON.stringify({ autoScaling: true, multiProject: true, realTimeCollab: true, advancedAnalytics: false, customTraining: false, apiAccess: true }), updatedBy: 'usr-002' },
    { key: 'security.twoFactorAuth', value: JSON.stringify(true), updatedBy: 'usr-002' },
    { key: 'security.ipAllowlist', value: JSON.stringify(false), updatedBy: 'usr-002' },
    {
      key: 'guardrails.config',
      value: JSON.stringify({
        input: {
          enabled: true,
          maxLength: 50000,
          injectionDetection: true,
          piiDetection: true,
          rateLimiting: true,
        },
        output: {
          enabled: true,
          maxLength: 100000,
          unsafeCodeDetection: true,
          actionValidation: true,
          blockOnCritical: false,
        },
        rateLimit: {
          maxRequests: 20,
          windowSeconds: 60,
        },
        injectionPatterns: [
          { label: 'Ignore Previous Instructions', pattern: 'ignore\\s+(all\\s+)?previous\\s+(instructions|prompts|rules)', enabled: true },
          { label: 'Role Override Attempt', pattern: 'you\\s+are\\s+now\\s+(a|an|the)\\s+', enabled: true },
          { label: 'Jailbreak Keyword', pattern: '\\bjailbreak\\b', enabled: true },
          { label: 'DAN Mode Attempt', pattern: '\\bDAN\\b.*\\bmode\\b|\\bmode\\b.*\\bDAN\\b', enabled: true },
          { label: 'System Tag Injection', pattern: '<\\s*system\\s*>', enabled: true },
          { label: 'Memory Wipe Attempt', pattern: 'forget\\s+(everything|all|your)\\s+(you|instructions|rules|training)', enabled: true },
          { label: 'Identity Override', pattern: 'pretend\\s+(you\\s+)?(are|to\\s+be)\\s+(a|an|the)\\s+', enabled: true },
          { label: 'Safety Bypass Attempt', pattern: 'bypass\\s+(your\\s+)?(safety|content|ethical|guardrail|filter|restriction)', enabled: true },
          { label: 'Restriction Removal', pattern: '\\bact\\s+as\\s+(if|though)\\s+(you\\s+)?(have\\s+)?no\\s+(restrictions|limits|rules)', enabled: true },
        ],
        piiPatterns: [
          { label: 'US Social Security Number', pattern: '\\b\\d{3}[-\\s]?\\d{2}[-\\s]?\\d{4}\\b', replacement: '[REDACTED-SSN]', enabled: true },
          { label: 'Credit Card Number', pattern: '\\b(?:\\d{4}[-\\s]?){3,4}\\d{1,4}\\b', replacement: '[REDACTED-CC]', enabled: true },
          { label: 'US Passport Number', pattern: '\\b[A-Z]?\\d{8,9}\\b', replacement: '[REDACTED-PASSPORT]', enabled: true },
        ],
        unsafeCodePatterns: [
          { label: 'Destructive rm -rf', pattern: 'rm\\s+-rf\\s+\\/', enabled: true },
          { label: 'SQL DROP Statement', pattern: 'DROP\\s+(TABLE|DATABASE|SCHEMA)\\s+', enabled: true },
          { label: 'eval() Usage', pattern: '\\beval\\s*\\(', enabled: true },
          { label: 'exec() Usage', pattern: '\\bexec\\s*\\(', enabled: true },
          { label: 'Environment Variable Mutation', pattern: 'process\\.env\\.\\w+\\s*=\\s*', enabled: true },
          { label: 'Shell Execution', pattern: 'child_process|spawn\\s*\\(|execSync\\s*\\(', enabled: true },
        ],
      }),
      updatedBy: 'usr-002',
    },
  ];

  for (const setting of adminSettings) {
    await prisma.adminSetting.create({ data: setting });
  }
  console.log(`  Created ${adminSettings.length} admin settings`);

  // ── Summary ──────────────────────────────────────────────────────────────

  console.log('\n========================================');
  console.log('Seed completed successfully!');
  console.log('========================================');

  const counts = await prisma.$transaction([
    prisma.user.count(),
    prisma.project.count(),
    prisma.projectMember.count(),
    prisma.card.count(),
    prisma.decision.count(),
    prisma.decisionOption.count(),
    prisma.agent.count(),
    prisma.sDLCStage.count(),
    prisma.document.count(),
    prisma.notification.count(),
    prisma.auditLog.count(),
    prisma.lLMUsage.count(),
    prisma.transaction.count(),
    prisma.gitBranch.count(),
    prisma.gitPullRequest.count(),
    prisma.gitRelease.count(),
    prisma.wireframe.count(),
    prisma.lLMProviderConfig.count(),
    prisma.event.count(),
    prisma.artifact.count(),
    prisma.orchestrationRun.count(),
    prisma.deploymentPipeline.count(),
    prisma.deploymentRun.count(),
    prisma.adminSetting.count(),
  ]);

  const labels = [
    'Users',
    'Projects',
    'Project Members',
    'Cards',
    'Decisions',
    'Decision Options',
    'Agents',
    'SDLC Stages',
    'Documents',
    'Notifications',
    'Audit Logs',
    'LLM Usage Records',
    'Transactions',
    'Git Branches',
    'Git Pull Requests',
    'Git Releases',
    'Wireframes',
    'LLM Provider Configs',
    'Orchestration Events',
    'Artifacts',
    'Orchestration Runs',
    'Deployment Pipelines',
    'Deployment Runs',
    'Admin Settings',
  ];

  labels.forEach((label, i) => {
    console.log(`  ${label}: ${counts[i]}`);
  });

  console.log('========================================\n');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
