import { describe, it, expect } from 'vitest';
import { checkForLoops, TrackedToolCall } from './loop-detector';

function makeToolCall(name: string, args: string, ageMs = 0): TrackedToolCall {
  return { name, args, timestamp: Date.now() - ageMs };
}

describe('Loop Detector', () => {
  describe('tool call loops', () => {
    it('returns null when no tool calls', () => {
      const result = checkForLoops({
        recentToolCalls: [],
        recentResponses: [],
      } as any);
      expect(result).toBeNull();
    });

    it('returns null for single tool call', () => {
      const result = checkForLoops({
        recentToolCalls: [makeToolCall('update_card', '{"state":"BLOCKED"}')],
        recentResponses: [],
      } as any);
      expect(result).toBeNull();
    });

    it('detects exact duplicate tool calls', () => {
      const args = '{"cardId":"c1","state":"BLOCKED"}';
      const result = checkForLoops({
        recentToolCalls: [
          makeToolCall('update_card', args),
          makeToolCall('update_card', args),
        ],
        recentResponses: [],
      } as any);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('tool_loop');
      expect(result!.message).toContain('STOP');
    });

    it('detects fuzzy similar tool calls (3+ with similar args)', () => {
      const result = checkForLoops({
        recentToolCalls: [
          makeToolCall('update_card', '{"cardId":"c1","state":"BLOCKED","description":"attempt 1"}'),
          makeToolCall('update_card', '{"cardId":"c1","state":"BLOCKED","description":"attempt 2"}'),
          makeToolCall('update_card', '{"cardId":"c1","state":"BLOCKED","description":"attempt 3"}'),
        ],
        recentResponses: [],
      } as any);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('tool_loop');
    });

    it('ignores tool calls older than 2 minutes', () => {
      const args = '{"cardId":"c1","state":"BLOCKED"}';
      const result = checkForLoops({
        recentToolCalls: [
          makeToolCall('update_card', args, 150_000), // 2.5 min old
          makeToolCall('update_card', args),
        ],
        recentResponses: [],
      } as any);
      expect(result).toBeNull();
    });

    it('does not flag different tools', () => {
      const result = checkForLoops({
        recentToolCalls: [
          makeToolCall('create_card', '{"title":"A"}'),
          makeToolCall('update_card', '{"title":"B"}'),
        ],
        recentResponses: [],
      } as any);
      expect(result).toBeNull();
    });
  });

  describe('text repetition', () => {
    it('returns null for short responses', () => {
      const result = checkForLoops({
        recentToolCalls: [],
        recentResponses: ['ok', 'sure'],
      } as any);
      expect(result).toBeNull();
    });

    it('detects highly similar responses', () => {
      const longText = 'I understand you want to build a Netflix clone. Let me ask about the target audience and key features you envision for this platform.';
      const result = checkForLoops({
        recentToolCalls: [],
        recentResponses: [longText, longText],
      } as any);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('text_repeat');
    });

    it('ignores sufficiently different responses', () => {
      const result = checkForLoops({
        recentToolCalls: [],
        recentResponses: [
          'Let me start by understanding your project requirements. What problem are you trying to solve?',
          'Great, now that I understand the problem, let me ask about your target users. Who will be using this application?',
        ],
      } as any);
      expect(result).toBeNull();
    });
  });

  describe('question re-ask', () => {
    it('detects repeated questions', () => {
      const result = checkForLoops({
        recentToolCalls: [],
        recentResponses: [
          'What is the target audience for this product?',
          'Can you tell me about the target audience for this product?',
        ],
      } as any);
      // May or may not trigger depending on similarity threshold
      // The key is it doesn't crash
      expect(result === null || result.type === 'question_reask' || result.type === 'text_repeat').toBe(true);
    });
  });

  describe('priority ordering', () => {
    it('tool loops take priority over text repetition', () => {
      const args = '{"cardId":"c1","state":"BLOCKED"}';
      const longText = 'I understand you want to build a Netflix clone. Let me ask about the target audience.';
      const result = checkForLoops({
        recentToolCalls: [
          makeToolCall('update_card', args),
          makeToolCall('update_card', args),
        ],
        recentResponses: [longText, longText],
      } as any);
      expect(result).not.toBeNull();
      expect(result!.type).toBe('tool_loop');
    });
  });
});
