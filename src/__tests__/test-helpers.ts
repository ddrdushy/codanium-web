/**
 * Shared test helpers for API route testing.
 * Provides mock request/response builders, session mocking, and DB utilities.
 */
import { vi } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mock Session ────────────────────────────────────────────────────────────

export const MOCK_USER = {
  id: 'usr-test-001',
  name: 'Test User',
  email: 'test@example.com',
  role: 'ADMIN',
  plan: 'PRO',
  image: null,
};

export const MOCK_SESSION = {
  user: MOCK_USER,
  expires: new Date(Date.now() + 86400000).toISOString(),
};

/**
 * Mock the auth-guard module to always return a valid session.
 * Call in beforeEach or at module level.
 */
export function mockAuth(overrides?: Partial<typeof MOCK_SESSION>) {
  const session = { ...MOCK_SESSION, ...overrides };
  vi.mock('@/lib/auth-guard', () => ({
    requireAuth: vi.fn().mockResolvedValue({ session, error: null }),
    requireAuthOrApiKey: vi.fn().mockResolvedValue({ session, error: null }),
    requireAdmin: vi.fn().mockResolvedValue({ session, error: null }),
  }));
  return session;
}

// ─── Request Builders ────────────────────────────────────────────────────────

export function createRequest(
  method: string,
  url: string,
  body?: Record<string, unknown>,
  headers?: Record<string, string>,
): NextRequest {
  const init: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };
  if (body && method !== 'GET') {
    init.body = JSON.stringify(body);
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), init);
}

export function createGET(url: string, headers?: Record<string, string>) {
  return createRequest('GET', url, undefined, headers);
}

export function createPOST(url: string, body: Record<string, unknown>) {
  return createRequest('POST', url, body);
}

export function createPATCH(url: string, body: Record<string, unknown>) {
  return createRequest('PATCH', url, body);
}

export function createDELETE(url: string) {
  return createRequest('DELETE', url);
}

// ─── Response Helpers ────────────────────────────────────────────────────────

export async function parseResponse(response: Response) {
  const data = await response.json();
  return { status: response.status, data };
}

// ─── Route Context Helper ────────────────────────────────────────────────────

export function routeContext(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

// ─── Prisma Mock Helpers ─────────────────────────────────────────────────────

/**
 * Create a mock Prisma client with common model stubs.
 * Usage: const prisma = createMockPrisma(); vi.mock('@/lib/prisma', () => ({ prisma }));
 */
export function createMockPrisma() {
  const createModelMock = () => ({
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'mock-id', ...data, createdAt: new Date(), updatedAt: new Date() })),
    update: vi.fn().mockImplementation(({ data, where }) => Promise.resolve({ id: where.id, ...data, updatedAt: new Date() })),
    delete: vi.fn().mockResolvedValue({ id: 'mock-id' }),
    count: vi.fn().mockResolvedValue(0),
    upsert: vi.fn().mockImplementation(({ create }) => Promise.resolve({ id: 'mock-id', ...create })),
  });

  return {
    project: createModelMock(),
    card: createModelMock(),
    chatMessage: createModelMock(),
    document: createModelMock(),
    decision: createModelMock(),
    decisionOption: createModelMock(),
    agent: createModelMock(),
    user: createModelMock(),
    projectMember: createModelMock(),
    sDLCStage: createModelMock(),
    wireframe: createModelMock(),
    artifact: createModelMock(),
    notification: createModelMock(),
    adminSetting: createModelMock(),
    lLMProviderConfig: createModelMock(),
    auditLog: createModelMock(),
    apiKey: createModelMock(),
    orchestrationRun: createModelMock(),
    agentMemory: createModelMock(),
    $transaction: vi.fn().mockImplementation((fn: any) => fn({
      project: createModelMock(),
      card: createModelMock(),
    })),
  };
}

// ─── Test Data Factories ─────────────────────────────────────────────────────

export function makeProject(overrides?: Record<string, unknown>) {
  return {
    id: 'proj-test-001',
    name: 'Test Project',
    description: 'A test project',
    color: '#f59e0b',
    status: 'ACTIVE',
    currentStage: 'Idea & Planning',
    ownerId: MOCK_USER.id,
    organizationId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeCard(overrides?: Record<string, unknown>) {
  return {
    id: 'card-test-001',
    title: 'Test Card',
    description: 'A test card',
    type: 'TASK',
    state: 'PLANNED',
    priority: 'MEDIUM',
    projectId: 'proj-test-001',
    parentId: null,
    assigneeId: null,
    ownerAgentId: null,
    linkedDecisionId: null,
    module: null,
    gitBranchId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    children: [],
    ...overrides,
  };
}

export function makeDocument(overrides?: Record<string, unknown>) {
  return {
    id: 'doc-test-001',
    title: 'Test BRD',
    type: 'BRD',
    content: 'Test content',
    status: 'DRAFT',
    wordCount: 2,
    sections: 1,
    owner: 'BA',
    ownerAvatar: '📋',
    locked: false,
    projectId: 'proj-test-001',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeDecision(overrides?: Record<string, unknown>) {
  return {
    id: 'dec-test-001',
    title: 'Test Decision',
    description: 'A test decision',
    status: 'DRAFTED',
    riskRating: 'LOW',
    category: 'TECHNICAL',
    projectId: 'proj-test-001',
    requestedBy: 'SA',
    recommendedOptionId: null,
    approvedOptionId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    options: [],
    ...overrides,
  };
}

export function makeAgent(overrides?: Record<string, unknown>) {
  return {
    id: 'agent-test-001',
    name: 'Business Analyst',
    shortName: 'BA',
    role: 'Requirements gathering and stakeholder communication',
    avatar: '📋',
    group: 'SDLC',
    status: 'IDLE',
    projectId: 'proj-test-001',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

export function makeSDLCStage(overrides?: Record<string, unknown>) {
  return {
    id: 'stage-test-001',
    name: 'Idea & Planning',
    order: 1,
    status: 'ACTIVE',
    gatePassed: false,
    projectId: 'proj-test-001',
    ...overrides,
  };
}
