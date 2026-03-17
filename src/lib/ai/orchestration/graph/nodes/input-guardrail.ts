// =============================================================================
// AI Team Studio — Input Guardrail Node
// =============================================================================
// First node in the orchestration graph. Validates the user's message against
// input guardrails (prompt injection, PII, length, rate limiting).
//
// If blocked: writes error event to StreamWriter and sets blocked=true in state.
// Conditional edge routes to END when blocked.
// =============================================================================

import { RunnableConfig } from '@langchain/core/runnables';
import type { GraphStateType } from '../state';
import { runInputGuardrails } from '../guardrails';

/**
 * Input guardrail node.
 * Validates the incoming user message and either passes it through
 * (with optional PII sanitization) or blocks it entirely.
 */
export async function inputGuardrailNode(
  state: GraphStateType,
  config: RunnableConfig,
): Promise<Partial<GraphStateType>> {
  const result = await runInputGuardrails(state.userMessage, state.userId);

  // Log guardrail flags if any
  if (result.flags.length > 0) {
    console.log(
      `[InputGuardrailNode] Flags: ${result.flags.join(', ')} for user ${state.userId}`,
    );
  }

  // If blocked, emit error event via StreamWriter
  if (result.blocked) {
    const writer = (config as any).writer;
    if (writer) {
      writer({
        type: 'error',
        data: {
          message: result.reason ?? 'Message blocked by safety guardrails.',
          guardrail: true,
        },
      });
    }

    console.warn(
      `[InputGuardrailNode] BLOCKED: ${result.reason} | User: ${state.userId}`,
    );
  }

  return {
    inputGuardrailResult: result,
    // Update userMessage with sanitized version (PII redacted)
    userMessage: result.sanitizedMessage,
  };
}
