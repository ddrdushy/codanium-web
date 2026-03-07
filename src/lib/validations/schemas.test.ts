import { describe, it, expect } from 'vitest';
import {
  createProjectSchema,
  createCardSchema,
  chatMessageSchema,
  gitPushSchema,
  createWebhookSchema,
  updateAgentSchema,
  createDecisionSchema,
  registerSchema,
  previewTierSchema,
  createNotificationSchema,
  createWireframeSchema,
  updateWireframeSchema,
} from './schemas';

// ── createProjectSchema ──────────────────────────────────────────────

describe('createProjectSchema', () => {
  it('accepts valid project', () => {
    const result = createProjectSchema.safeParse({
      name: 'My Project',
      description: 'A test project',
      color: '#ff5500',
    });
    expect(result.success).toBe(true);
  });

  it('accepts minimal (name only)', () => {
    const result = createProjectSchema.safeParse({ name: 'AB' });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = createProjectSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects name too short (1 char)', () => {
    const result = createProjectSchema.safeParse({ name: 'A' });
    expect(result.success).toBe(false);
  });

  it('rejects name too long (>100 chars)', () => {
    const result = createProjectSchema.safeParse({ name: 'A'.repeat(101) });
    expect(result.success).toBe(false);
  });

  it('trims name whitespace', () => {
    const result = createProjectSchema.safeParse({ name: '  My Project  ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.name).toBe('My Project');
  });

  it('rejects invalid hex color', () => {
    const result = createProjectSchema.safeParse({ name: 'Test', color: 'red' });
    expect(result.success).toBe(false);
  });

  it('accepts valid hex color', () => {
    const result = createProjectSchema.safeParse({ name: 'Test', color: '#abCDEF' });
    expect(result.success).toBe(true);
  });

  it('rejects description over 2000 chars', () => {
    const result = createProjectSchema.safeParse({
      name: 'Test',
      description: 'x'.repeat(2001),
    });
    expect(result.success).toBe(false);
  });
});

// ── createCardSchema ─────────────────────────────────────────────────

describe('createCardSchema', () => {
  it('accepts valid card with defaults', () => {
    const result = createCardSchema.safeParse({ title: 'Fix bug' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.type).toBe('TASK');
      expect(result.data.state).toBe('PLANNED');
      expect(result.data.priority).toBe('MEDIUM');
    }
  });

  it('accepts full card', () => {
    const result = createCardSchema.safeParse({
      title: 'Epic feature',
      type: 'EPIC',
      state: 'IN_PROGRESS',
      priority: 'HIGH',
      description: 'Detailed description',
      assigneeId: 'user-1',
      ownerAgentId: 'agent-1',
      parentId: 'card-parent',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    const result = createCardSchema.safeParse({ title: '' });
    expect(result.success).toBe(false);
  });

  it('rejects title over 200 chars', () => {
    const result = createCardSchema.safeParse({ title: 'T'.repeat(201) });
    expect(result.success).toBe(false);
  });

  it('rejects invalid card type', () => {
    const result = createCardSchema.safeParse({ title: 'Test', type: 'INVALID' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid state', () => {
    const result = createCardSchema.safeParse({ title: 'Test', state: 'WORKING' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid priority', () => {
    const result = createCardSchema.safeParse({ title: 'Test', priority: 'URGENT' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid card types', () => {
    for (const type of ['EPIC', 'FEATURE', 'TASK', 'QA', 'DECISION_BLOCKER']) {
      const result = createCardSchema.safeParse({ title: 'Test', type });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid states', () => {
    for (const state of ['PLANNED', 'IN_PROGRESS', 'UNDER_REVIEW', 'TESTING', 'BLOCKED', 'DONE', 'RELEASED']) {
      const result = createCardSchema.safeParse({ title: 'Test', state });
      expect(result.success).toBe(true);
    }
  });
});

// ── chatMessageSchema ────────────────────────────────────────────────

describe('chatMessageSchema', () => {
  it('accepts valid message with default role', () => {
    const result = chatMessageSchema.safeParse({ content: 'Hello' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.role).toBe('USER');
  });

  it('rejects empty content', () => {
    const result = chatMessageSchema.safeParse({ content: '' });
    expect(result.success).toBe(false);
  });

  it('rejects content over 50000 chars', () => {
    const result = chatMessageSchema.safeParse({ content: 'x'.repeat(50001) });
    expect(result.success).toBe(false);
  });

  it('accepts all valid roles', () => {
    for (const role of ['USER', 'AGENT', 'SYSTEM']) {
      const result = chatMessageSchema.safeParse({ content: 'Test', role });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid role', () => {
    const result = chatMessageSchema.safeParse({ content: 'Test', role: 'BOT' });
    expect(result.success).toBe(false);
  });
});

// ── gitPushSchema ────────────────────────────────────────────────────

describe('gitPushSchema', () => {
  it('accepts empty body (all optional)', () => {
    const result = gitPushSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.createPR).toBe(false);
  });

  it('accepts valid branch name', () => {
    const result = gitPushSchema.safeParse({ branchName: 'feature/my-branch' });
    expect(result.success).toBe(true);
  });

  it('rejects branch name with spaces', () => {
    const result = gitPushSchema.safeParse({ branchName: 'my branch' });
    expect(result.success).toBe(false);
  });

  it('rejects branch name with special chars', () => {
    const result = gitPushSchema.safeParse({ branchName: 'my@branch!' });
    expect(result.success).toBe(false);
  });

  it('rejects commit message over 500 chars', () => {
    const result = gitPushSchema.safeParse({ commitMessage: 'x'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('accepts createPR boolean', () => {
    const result = gitPushSchema.safeParse({ createPR: true });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.createPR).toBe(true);
  });
});

// ── createWebhookSchema ──────────────────────────────────────────────

describe('createWebhookSchema', () => {
  it('accepts valid HTTPS URL', () => {
    const result = createWebhookSchema.safeParse({ url: 'https://example.com/hook' });
    expect(result.success).toBe(true);
  });

  it('accepts valid HTTP URL', () => {
    const result = createWebhookSchema.safeParse({ url: 'http://localhost:3000/hook' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid URL', () => {
    const result = createWebhookSchema.safeParse({ url: 'not-a-url' });
    expect(result.success).toBe(false);
  });

  it('rejects missing URL', () => {
    const result = createWebhookSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('accepts with events array', () => {
    const result = createWebhookSchema.safeParse({
      url: 'https://example.com',
      events: ['push', 'pr'],
    });
    expect(result.success).toBe(true);
  });
});

// ── updateAgentSchema ────────────────────────────────────────────────

describe('updateAgentSchema', () => {
  it('accepts valid update', () => {
    const result = updateAgentSchema.safeParse({
      agentId: 'agent-1',
      status: 'WORKING',
      currentTask: 'Building feature',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing agentId', () => {
    const result = updateAgentSchema.safeParse({ status: 'IDLE' });
    expect(result.success).toBe(false);
  });

  it('rejects currentTask over 500 chars', () => {
    const result = updateAgentSchema.safeParse({
      agentId: 'agent-1',
      currentTask: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });
});

// ── createDecisionSchema ─────────────────────────────────────────────

describe('createDecisionSchema', () => {
  it('accepts valid decision', () => {
    const result = createDecisionSchema.safeParse({
      trigger: 'Which database to use?',
      ownerId: 'user-1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty trigger', () => {
    const result = createDecisionSchema.safeParse({
      trigger: '',
      ownerId: 'user-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing ownerId', () => {
    const result = createDecisionSchema.safeParse({ trigger: 'Test' });
    expect(result.success).toBe(false);
  });

  it('accepts with options array', () => {
    const result = createDecisionSchema.safeParse({
      trigger: 'DB choice',
      ownerId: 'user-1',
      options: [
        { title: 'PostgreSQL', description: 'Relational', pros: ['ACID'], cons: ['Complex'] },
        { title: 'MongoDB', description: 'Document DB', pros: ['Flexible'], cons: ['No joins'] },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects option without title', () => {
    const result = createDecisionSchema.safeParse({
      trigger: 'Test',
      ownerId: 'user-1',
      options: [{ description: 'Missing title' }],
    });
    expect(result.success).toBe(false);
  });

  it('accepts all risk ratings', () => {
    for (const riskRating of ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']) {
      const result = createDecisionSchema.safeParse({
        trigger: 'Test',
        ownerId: 'user-1',
        riskRating,
      });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all effort levels', () => {
    for (const effort of ['LOW', 'MEDIUM', 'HIGH']) {
      const result = createDecisionSchema.safeParse({
        trigger: 'Test',
        ownerId: 'user-1',
        effort,
      });
      expect(result.success).toBe(true);
    }
  });
});

// ── registerSchema ───────────────────────────────────────────────────

describe('registerSchema', () => {
  it('accepts valid registration', () => {
    const result = registerSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'securePass123',
    });
    expect(result.success).toBe(true);
  });

  it('rejects name too short', () => {
    const result = registerSchema.safeParse({
      name: 'J',
      email: 'j@test.com',
      password: 'pass123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = registerSchema.safeParse({
      name: 'John',
      email: 'not-an-email',
      password: 'pass123',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password too short', () => {
    const result = registerSchema.safeParse({
      name: 'John',
      email: 'john@test.com',
      password: '12345',
    });
    expect(result.success).toBe(false);
  });

  it('rejects password over 128 chars', () => {
    const result = registerSchema.safeParse({
      name: 'John',
      email: 'john@test.com',
      password: 'p'.repeat(129),
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing fields', () => {
    expect(registerSchema.safeParse({}).success).toBe(false);
    expect(registerSchema.safeParse({ name: 'John' }).success).toBe(false);
    expect(registerSchema.safeParse({ name: 'John', email: 'j@t.com' }).success).toBe(false);
  });
});

// ── previewTierSchema ────────────────────────────────────────────────

describe('previewTierSchema', () => {
  it('accepts sandpack', () => {
    expect(previewTierSchema.safeParse({ tier: 'sandpack' }).success).toBe(true);
  });

  it('accepts webcontainer', () => {
    expect(previewTierSchema.safeParse({ tier: 'webcontainer' }).success).toBe(true);
  });

  it('accepts cloud', () => {
    expect(previewTierSchema.safeParse({ tier: 'cloud' }).success).toBe(true);
  });

  it('rejects invalid tier', () => {
    expect(previewTierSchema.safeParse({ tier: 'docker' }).success).toBe(false);
  });

  it('rejects missing tier', () => {
    expect(previewTierSchema.safeParse({}).success).toBe(false);
  });
});

// ── createNotificationSchema ─────────────────────────────────────────

describe('createNotificationSchema', () => {
  it('accepts valid notification', () => {
    const result = createNotificationSchema.safeParse({
      type: 'COMPLETION',
      title: 'Build complete',
      userId: 'user-1',
    });
    expect(result.success).toBe(true);
  });

  it('accepts all notification types', () => {
    for (const type of ['DECISION', 'COMPLETION', 'PR', 'FAILURE', 'AGENT', 'DEPLOY', 'SECURITY', 'BUILD']) {
      const result = createNotificationSchema.safeParse({
        type,
        title: 'Test',
        userId: 'user-1',
      });
      expect(result.success).toBe(true);
    }
  });

  it('rejects invalid type', () => {
    const result = createNotificationSchema.safeParse({
      type: 'EMAIL',
      title: 'Test',
      userId: 'user-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing title', () => {
    const result = createNotificationSchema.safeParse({
      type: 'AGENT',
      userId: 'user-1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing userId', () => {
    const result = createNotificationSchema.safeParse({
      type: 'AGENT',
      title: 'Test',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional fields', () => {
    const result = createNotificationSchema.safeParse({
      type: 'PR',
      title: 'PR #42 merged',
      userId: 'user-1',
      description: 'Feature branch merged',
      actionLabel: 'View PR',
      actionHref: '/project/abc/git',
      projectId: 'proj-1',
    });
    expect(result.success).toBe(true);
  });
});

// ── createWireframeSchema ────────────────────────────────────────────

describe('createWireframeSchema', () => {
  it('accepts minimal wireframe (title only)', () => {
    const result = createWireframeSchema.safeParse({ title: 'Dashboard' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.device).toBe('DESKTOP');
      expect(result.data.status).toBe('DRAFT');
      expect(result.data.screen).toBe('');
    }
  });

  it('accepts full wireframe', () => {
    const result = createWireframeSchema.safeParse({
      title: 'Mobile Login',
      screen: 'login',
      device: 'MOBILE',
      status: 'REVIEW',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty title', () => {
    expect(createWireframeSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('rejects title over 200 chars', () => {
    expect(createWireframeSchema.safeParse({ title: 'T'.repeat(201) }).success).toBe(false);
  });

  it('rejects invalid device', () => {
    expect(createWireframeSchema.safeParse({ title: 'Test', device: 'WATCH' }).success).toBe(false);
  });

  it('rejects invalid status', () => {
    expect(createWireframeSchema.safeParse({ title: 'Test', status: 'PUBLISHED' }).success).toBe(false);
  });

  it('accepts all valid devices', () => {
    for (const device of ['DESKTOP', 'MOBILE', 'TABLET']) {
      expect(createWireframeSchema.safeParse({ title: 'Test', device }).success).toBe(true);
    }
  });

  it('accepts all valid statuses', () => {
    for (const status of ['DRAFT', 'REVIEW', 'APPROVED']) {
      expect(createWireframeSchema.safeParse({ title: 'Test', status }).success).toBe(true);
    }
  });
});

// ── updateWireframeSchema ────────────────────────────────────────────

describe('updateWireframeSchema', () => {
  it('accepts empty update (all optional)', () => {
    expect(updateWireframeSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial update', () => {
    const result = updateWireframeSchema.safeParse({ title: 'Updated Title' });
    expect(result.success).toBe(true);
  });

  it('accepts status-only update', () => {
    const result = updateWireframeSchema.safeParse({ status: 'APPROVED' });
    expect(result.success).toBe(true);
  });

  it('rejects invalid device in update', () => {
    expect(updateWireframeSchema.safeParse({ device: 'LAPTOP' }).success).toBe(false);
  });
});
