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
    await prisma.user.create({ data: { ...user, onboardingCompleted: true, onboardingStep: 4 } });
  }
  console.log(`  Created ${allUsers.length} users`);

  // ── 2b. Seed Projects for admin panel realism ──────────────────────────
  // These give users realistic project counts in the admin Users table.
  // Actual project data (agents, stages, cards) is created by project-seed.ts on demand.

  console.log('Seeding demo projects...');

  const seedProjects = [
    { id: 'prj-001', name: 'E-Commerce Platform v2', description: 'Modern e-commerce platform with AI recommendations', ownerId: 'usr_001', currentStage: 'Development', completion: 68, createdAt: daysAgo(45) },
    { id: 'prj-002', name: 'Healthcare Dashboard', description: 'Patient monitoring dashboard for clinics', ownerId: 'usr_002', currentStage: 'Architecture', completion: 25, createdAt: daysAgo(30) },
    { id: 'prj-003', name: 'Mobile Fitness App', description: 'Fitness tracking with AI workout plans', ownerId: 'usr_005', currentStage: 'Testing', completion: 85, createdAt: daysAgo(60) },
    { id: 'prj-004', name: 'SaaS Analytics Tool', description: 'Business analytics with real-time dashboards', ownerId: 'usr_005', currentStage: 'Planning', completion: 30, createdAt: daysAgo(20) },
    { id: 'prj-005', name: 'Portfolio Website', description: 'Personal portfolio with project showcase', ownerId: 'usr_003', currentStage: 'Development', completion: 55, createdAt: daysAgo(15) },
    { id: 'prj-006', name: 'Restaurant Booking System', description: 'Online table reservation system', ownerId: 'usr_010', currentStage: 'Business Analysis', completion: 10, createdAt: daysAgo(5) },
    { id: 'prj-007', name: 'AI Chatbot Platform', description: 'Customer support chatbot builder', ownerId: 'usr_004', currentStage: 'Code Review', completion: 90, createdAt: daysAgo(40) },
    { id: 'prj-008', name: 'Inventory Management', description: 'Warehouse inventory tracking system', ownerId: 'usr_004', currentStage: 'Development', completion: 60, createdAt: daysAgo(25) },
    { id: 'prj-009', name: 'Social Media Scheduler', description: 'Schedule and manage social media posts', ownerId: 'usr_002', currentStage: 'Architecture', completion: 20, createdAt: daysAgo(10) },
    { id: 'prj-010', name: 'Learning Management System', description: 'Online course platform for enterprises', ownerId: 'usr_001', currentStage: 'Planning', completion: 35, createdAt: daysAgo(35) },
    { id: 'prj-011', name: 'Real Estate Listings', description: 'Property listing and search platform', ownerId: 'usr_013', currentStage: 'Development', completion: 72, createdAt: daysAgo(50) },
    { id: 'prj-012', name: 'Travel Booking App', description: 'Flight and hotel booking platform', ownerId: 'usr_007', currentStage: 'Business Analysis', completion: 5, createdAt: daysAgo(3) },
    { id: 'prj-013', name: 'Event Management', description: 'Corporate event planning tool', ownerId: 'usr_018', currentStage: 'Architecture', completion: 22, createdAt: daysAgo(18) },
    { id: 'prj-014', name: 'HR Onboarding Portal', description: 'Employee onboarding workflow system', ownerId: 'usr_016', currentStage: 'Development', completion: 48, createdAt: daysAgo(28) },
    { id: 'prj-015', name: 'Cloud Cost Optimizer', description: 'AWS/GCP cost monitoring and optimization', ownerId: 'usr_016', currentStage: 'Testing', completion: 82, createdAt: daysAgo(55) },
  ];

  for (const prj of seedProjects) {
    await prisma.project.create({ data: prj });
  }
  console.log(`  Created ${seedProjects.length} demo projects`);

  // ── 3. Seed Audit Logs (20 entries from mock-admin-data) ────────────────

  console.log('Seeding audit logs...');

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

  // ── 4. Seed LLM Usage Data (30 entries from mock-admin-data) ────────────

  console.log('Seeding LLM usage data...');

  const llmUsageData = [
    { tokensUsed: 1250000, actualCost: 187.50, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Solution Architect', projectId: 'prj-001', createdAt: new Date('2026-03-04T00:00:00Z') },
    { tokensUsed: 890000, actualCost: 44.50, provider: 'openai', model: 'gpt-4o', agentName: 'Junior Developer', projectId: 'prj-002', createdAt: new Date('2026-03-04T00:00:00Z') },
    { tokensUsed: 1450000, actualCost: 217.50, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Tech Lead', projectId: 'prj-001', createdAt: new Date('2026-03-03T00:00:00Z') },
    { tokensUsed: 560000, actualCost: 28.00, provider: 'openai', model: 'gpt-4o-mini', agentName: 'QA Engineer', projectId: 'prj-003', createdAt: new Date('2026-03-03T00:00:00Z') },
    { tokensUsed: 320000, actualCost: 8.00, provider: 'google', model: 'gemini-pro', agentName: 'Business Analyst', projectId: 'prj-004', createdAt: new Date('2026-03-03T00:00:00Z') },
    { tokensUsed: 980000, actualCost: 147.00, provider: 'anthropic', model: 'claude-3-sonnet', agentName: 'Senior Developer', projectId: 'prj-005', createdAt: new Date('2026-03-02T00:00:00Z') },
    { tokensUsed: 1120000, actualCost: 56.00, provider: 'openai', model: 'gpt-4o', agentName: 'Orchestrator', projectId: 'prj-002', createdAt: new Date('2026-03-02T00:00:00Z') },
    { tokensUsed: 445000, actualCost: 11.13, provider: 'google', model: 'gemini-pro', agentName: 'UI/UX Designer', projectId: 'prj-001', createdAt: new Date('2026-03-02T00:00:00Z') },
    { tokensUsed: 1680000, actualCost: 252.00, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Solution Architect', projectId: 'prj-001', createdAt: new Date('2026-03-01T00:00:00Z') },
    { tokensUsed: 720000, actualCost: 36.00, provider: 'openai', model: 'gpt-4o', agentName: 'DevOps Engineer', projectId: 'prj-003', createdAt: new Date('2026-03-01T00:00:00Z') },
    { tokensUsed: 1340000, actualCost: 201.00, provider: 'anthropic', model: 'claude-3-sonnet', agentName: 'Tech Lead', projectId: 'prj-005', createdAt: new Date('2026-02-28T00:00:00Z') },
    { tokensUsed: 890000, actualCost: 44.50, provider: 'openai', model: 'gpt-4o', agentName: 'Junior Developer', projectId: 'prj-001', createdAt: new Date('2026-02-28T00:00:00Z') },
    { tokensUsed: 560000, actualCost: 14.00, provider: 'google', model: 'gemini-pro', agentName: 'Product Manager', projectId: 'prj-003', createdAt: new Date('2026-02-27T00:00:00Z') },
    { tokensUsed: 1190000, actualCost: 178.50, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Solution Architect', projectId: 'prj-004', createdAt: new Date('2026-02-27T00:00:00Z') },
    { tokensUsed: 670000, actualCost: 33.50, provider: 'openai', model: 'gpt-4o-mini', agentName: 'QA Engineer', projectId: 'prj-002', createdAt: new Date('2026-02-26T00:00:00Z') },
    { tokensUsed: 1520000, actualCost: 228.00, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Senior Developer', projectId: 'prj-001', createdAt: new Date('2026-02-26T00:00:00Z') },
    { tokensUsed: 390000, actualCost: 9.75, provider: 'google', model: 'gemini-pro', agentName: 'Cost Analyst', projectId: 'prj-005', createdAt: new Date('2026-02-25T00:00:00Z') },
    { tokensUsed: 1050000, actualCost: 52.50, provider: 'openai', model: 'gpt-4o', agentName: 'Platform Engineer', projectId: 'prj-005', createdAt: new Date('2026-02-25T00:00:00Z') },
    { tokensUsed: 1780000, actualCost: 267.00, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Tech Lead', projectId: 'prj-003', createdAt: new Date('2026-02-24T00:00:00Z') },
    { tokensUsed: 430000, actualCost: 21.50, provider: 'openai', model: 'gpt-4o-mini', agentName: 'Automation Test', projectId: 'prj-003', createdAt: new Date('2026-02-24T00:00:00Z') },
    { tokensUsed: 910000, actualCost: 136.50, provider: 'anthropic', model: 'claude-3-sonnet', agentName: 'Solution Architect', projectId: 'prj-002', createdAt: new Date('2026-02-23T00:00:00Z') },
    { tokensUsed: 280000, actualCost: 7.00, provider: 'google', model: 'gemini-pro', agentName: 'Prompt Engineer', projectId: 'prj-004', createdAt: new Date('2026-02-23T00:00:00Z') },
    { tokensUsed: 1610000, actualCost: 241.50, provider: 'anthropic', model: 'claude-3-opus', agentName: 'Senior Developer', projectId: 'prj-001', createdAt: new Date('2026-02-22T00:00:00Z') },
    { tokensUsed: 750000, actualCost: 37.50, provider: 'openai', model: 'gpt-4o', agentName: 'Integration Engineer', projectId: 'prj-004', createdAt: new Date('2026-02-22T00:00:00Z') },
    { tokensUsed: 520000, actualCost: 13.00, provider: 'google', model: 'gemini-pro', agentName: 'UI/UX Designer', projectId: 'prj-004', createdAt: new Date('2026-02-21T00:00:00Z') },
    { tokensUsed: 1390000, actualCost: 208.50, provider: 'anthropic', model: 'claude-3-sonnet', agentName: 'Tech Lead', projectId: 'prj-005', createdAt: new Date('2026-02-21T00:00:00Z') },
    { tokensUsed: 840000, actualCost: 42.00, provider: 'openai', model: 'gpt-4o', agentName: 'DevOps Engineer', projectId: 'prj-003', createdAt: new Date('2026-02-20T00:00:00Z') },
    { tokensUsed: 1150000, actualCost: 172.50, provider: 'anthropic', model: 'claude-3-opus', agentName: 'LLM Gateway Manager', projectId: 'prj-005', createdAt: new Date('2026-02-20T00:00:00Z') },
    { tokensUsed: 690000, actualCost: 34.50, provider: 'openai', model: 'gpt-4o-mini', agentName: 'Performance Engineer', projectId: 'prj-004', createdAt: new Date('2026-02-19T00:00:00Z') },
    { tokensUsed: 470000, actualCost: 11.75, provider: 'google', model: 'gemini-pro', agentName: 'Secrets Manager', projectId: 'prj-001', createdAt: new Date('2026-02-19T00:00:00Z') },
  ];

  await prisma.lLMUsage.createMany({ data: llmUsageData });
  console.log(`  Created ${llmUsageData.length} LLM usage records`);

  // ── 5. Seed Transactions (12 from mock-admin-data) ──────────────────────

  console.log('Seeding transactions...');

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

  // ── 6. Seed Admin Settings ────────────────────────────────────────────

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
    prisma.auditLog.count(),
    prisma.lLMUsage.count(),
    prisma.transaction.count(),
    prisma.adminSetting.count(),
  ]);

  const labels = [
    'Users',
    'Audit Logs',
    'LLM Usage Records',
    'Transactions',
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
