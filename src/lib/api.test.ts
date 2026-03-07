import { describe, it, expect } from 'vitest';
import {
  mapProjectStatus,
  mapCardType,
  mapCardState,
  mapPriority,
  mapAgentGroup,
  mapAgentStatus,
  mapRisk,
  mapEffort,
  mapDecisionStatus,
  formatRelativeDate,
} from './api';

// ── mapProjectStatus ─────────────────────────────────────────────────

describe('mapProjectStatus', () => {
  it('converts ACTIVE to active', () => {
    expect(mapProjectStatus('ACTIVE')).toBe('active');
  });

  it('converts PAUSED to paused', () => {
    expect(mapProjectStatus('PAUSED')).toBe('paused');
  });

  it('converts COMPLETED to completed', () => {
    expect(mapProjectStatus('COMPLETED')).toBe('completed');
  });

  it('converts ARCHIVED to archived', () => {
    expect(mapProjectStatus('ARCHIVED')).toBe('archived');
  });
});

// ── mapCardType ──────────────────────────────────────────────────────

describe('mapCardType', () => {
  it('converts EPIC to Epic', () => {
    expect(mapCardType('EPIC')).toBe('Epic');
  });

  it('converts FEATURE to Feature', () => {
    expect(mapCardType('FEATURE')).toBe('Feature');
  });

  it('converts TASK to Task', () => {
    expect(mapCardType('TASK')).toBe('Task');
  });

  it('converts QA to QA', () => {
    expect(mapCardType('QA')).toBe('QA');
  });

  it('converts DECISION_BLOCKER to DecisionBlocker', () => {
    expect(mapCardType('DECISION_BLOCKER')).toBe('DecisionBlocker');
  });

  it('defaults unknown types to Task', () => {
    expect(mapCardType('UNKNOWN')).toBe('Task');
  });
});

// ── mapCardState ─────────────────────────────────────────────────────

describe('mapCardState', () => {
  const expected: Record<string, string> = {
    PLANNED: 'Planned',
    IN_PROGRESS: 'In Progress',
    UNDER_REVIEW: 'Under Review',
    TESTING: 'Testing',
    BLOCKED: 'Blocked',
    DONE: 'Done',
    RELEASED: 'Released',
  };

  for (const [input, output] of Object.entries(expected)) {
    it(`converts ${input} to ${output}`, () => {
      expect(mapCardState(input)).toBe(output);
    });
  }

  it('defaults unknown states to Planned', () => {
    expect(mapCardState('UNKNOWN')).toBe('Planned');
  });
});

// ── mapPriority ──────────────────────────────────────────────────────

describe('mapPriority', () => {
  it('converts to lowercase', () => {
    expect(mapPriority('LOW')).toBe('low');
    expect(mapPriority('MEDIUM')).toBe('medium');
    expect(mapPriority('HIGH')).toBe('high');
    expect(mapPriority('CRITICAL')).toBe('critical');
  });
});

// ── mapAgentGroup ────────────────────────────────────────────────────

describe('mapAgentGroup', () => {
  it('converts to lowercase', () => {
    expect(mapAgentGroup('GOVERNANCE')).toBe('governance');
    expect(mapAgentGroup('SDLC')).toBe('sdlc');
    expect(mapAgentGroup('ENGINEERING')).toBe('engineering');
    expect(mapAgentGroup('PLATFORM')).toBe('platform');
    expect(mapAgentGroup('AI_COST')).toBe('ai_cost');
  });
});

// ── mapAgentStatus ───────────────────────────────────────────────────

describe('mapAgentStatus', () => {
  it('converts to lowercase', () => {
    expect(mapAgentStatus('IDLE')).toBe('idle');
    expect(mapAgentStatus('WORKING')).toBe('working');
    expect(mapAgentStatus('WAITING')).toBe('waiting');
    expect(mapAgentStatus('BLOCKED')).toBe('blocked');
  });
});

// ── mapRisk ──────────────────────────────────────────────────────────

describe('mapRisk', () => {
  it('converts to Title Case', () => {
    expect(mapRisk('LOW')).toBe('Low');
    expect(mapRisk('MEDIUM')).toBe('Medium');
    expect(mapRisk('HIGH')).toBe('High');
    expect(mapRisk('CRITICAL')).toBe('Critical');
  });

  it('defaults unknown to Medium', () => {
    expect(mapRisk('UNKNOWN')).toBe('Medium');
  });
});

// ── mapEffort ────────────────────────────────────────────────────────

describe('mapEffort', () => {
  it('converts to Title Case', () => {
    expect(mapEffort('LOW')).toBe('Low');
    expect(mapEffort('MEDIUM')).toBe('Medium');
    expect(mapEffort('HIGH')).toBe('High');
  });

  it('defaults unknown to Medium', () => {
    expect(mapEffort('UNKNOWN')).toBe('Medium');
  });
});

// ── mapDecisionStatus ────────────────────────────────────────────────

describe('mapDecisionStatus', () => {
  const expected: Record<string, string> = {
    DRAFTED: 'Drafted',
    OPTIONS_COLLECTED: 'Options Collected',
    RECOMMENDED: 'Recommended',
    AWAITING_APPROVAL: 'Awaiting Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    IMPLEMENTED: 'Implemented',
    VERIFIED: 'Verified',
  };

  for (const [input, output] of Object.entries(expected)) {
    it(`converts ${input} to ${output}`, () => {
      expect(mapDecisionStatus(input)).toBe(output);
    });
  }

  it('defaults unknown to Drafted', () => {
    expect(mapDecisionStatus('UNKNOWN')).toBe('Drafted');
  });
});

// ── formatRelativeDate ───────────────────────────────────────────────

describe('formatRelativeDate', () => {
  it('returns "just now" for current time', () => {
    const now = new Date().toISOString();
    expect(formatRelativeDate(now)).toBe('just now');
  });

  it('returns minutes ago for recent times', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000).toISOString();
    expect(formatRelativeDate(fiveMinAgo)).toBe('5m ago');
  });

  it('returns hours ago for same-day times', () => {
    const threeHrsAgo = new Date(Date.now() - 3 * 3600000).toISOString();
    expect(formatRelativeDate(threeHrsAgo)).toBe('3h ago');
  });

  it('returns days ago for recent dates', () => {
    const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString();
    expect(formatRelativeDate(twoDaysAgo)).toBe('2d ago');
  });

  it('returns formatted date for old dates (>7 days)', () => {
    const old = new Date(Date.now() - 30 * 86400000).toISOString();
    const result = formatRelativeDate(old);
    // Should be a locale-formatted date like "Feb 5, 2026"
    expect(result).toMatch(/\w+ \d+, \d{4}/);
  });
});
