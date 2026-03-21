// =============================================================================
// AI Team Studio — Orchestration Engine
// =============================================================================
// The single entry point for all AI processing in the platform. Every user
// message flows through this engine, which coordinates:
//
//   1. Message persistence
//   2. Agent selection (explicit or auto-routed)
//   3. Agent state management (WORKING -> IDLE lifecycle)
//   4. Context building (system prompt + project state + history)
//   5. LLM invocation (via the Gateway)
//   6. Response parsing (actions, artifacts, delegations)
//   7. Side effect execution (cards, documents, decisions, SDLC transitions)
//   8. Delegation chains (agent-to-agent handoffs)
//   9. Event emission (for real-time UI, audit, notifications)
//
// Two entry points:
//   - process(request)       -> OrchestrationResponse (non-streaming)
//   - processStream(request) -> AsyncIterable<SSEEvent> (streaming)
// =============================================================================

import { prisma } from '@/lib/prisma';
import { getAgentDefinition } from '@/lib/ai/agents/registry';
import { parseAgentResponse, ParsedResponse } from '@/lib/ai/agents/response-parser';
import { AgentAction, AgentExecutionResult } from '@/lib/ai/agents/types';
import { contextBuilder } from '@/lib/ai/context/context-builder';
import { llmGateway } from '@/lib/ai/gateway';
import { LLMMessage } from '@/lib/ai/providers/types';
import {
  OrchestrationRequest,
  OrchestrationResponse,
  SSEEvent,
} from './types';
import { messageRouter } from './router';
import { agentStateManager } from './state-manager';
import { eventBus } from './event-bus';
import { delegationHandler, DelegationChainEntry } from './delegation';
import { validateStageGate, validateDelegationGate } from './quality-gates';
import { validateCardTransition, CardState as LifecycleCardState, CardType as LifecycleCardType } from './card-lifecycle';
import { filterAuthorizedActions } from './authority-guard';
import { getToolsForAgent } from '@/lib/ai/tools/tool-filter';
import { invalidateProjectCache } from '@/lib/ai/context/context-cache';

// ---------------------------------------------------------------------------
// OrchestrationEngine
// ---------------------------------------------------------------------------

export class OrchestrationEngine {
  // =========================================================================
  // NON-STREAMING ENTRY POINT
  // =========================================================================

  /**
   * Process a user message end-to-end and return the full response.
   * Use this for API routes that don't need streaming.
   */
  async process(request: OrchestrationRequest): Promise<OrchestrationResponse> {
    const { projectId, userMessage, userId } = request;

    const response: OrchestrationResponse = {
      messages: [],
      agentStatusUpdates: [],
    };

    try {
      // ── Step 1: Persist user message (skip if caller already saved it) ─
      if (!request.skipMessageSave) {
        await this.saveUserMessage(projectId, userMessage);
      }

      // ── Step 2: Determine target agent ────────────────────────────────
      const targetShortName = request.targetAgentShortName
        ?? await messageRouter.route(userMessage, projectId);

      // ── Step 3: Execute the primary agent ─────────────────────────────
      const primaryResult = await this.executeAgentPipeline(
        targetShortName,
        userMessage,
        projectId,
        userId,
      );

      response.messages.push({
        agentShortName: primaryResult.agentShortName,
        agentName: this.getAgentName(primaryResult.agentShortName),
        content: primaryResult.message,
        thinking: primaryResult.thinking,
        artifacts: primaryResult.artifacts?.map((a) => ({
          name: a.name,
          type: a.type,
        })),
      });

      // ── Step 4: Handle delegation chain ───────────────────────────────
      if (primaryResult.delegateTo) {
        const delegateContext =
          (primaryResult as AgentExecutionResult & { delegateContext?: string }).delegateContext
          ?? primaryResult.message;

        const chain = await delegationHandler.handleDelegation(
          primaryResult.delegateTo,
          delegateContext,
          projectId,
          (shortName, message, pid) =>
            this.executeAgentPipeline(shortName, message, pid, userId),
          primaryResult.agentShortName,
        );

        for (const entry of chain) {
          response.messages.push({
            agentShortName: entry.result.agentShortName,
            agentName: this.getAgentName(entry.result.agentShortName),
            content: entry.result.message,
            thinking: entry.result.thinking,
            artifacts: entry.result.artifacts?.map((a) => ({
              name: a.name,
              type: a.type,
            })),
          });
        }

        // Emit delegation event
        await eventBus.emit({
          type: 'delegation.chain',
          actor: primaryResult.agentShortName,
          projectId,
          payload: {
            chain: chain.map((e) => ({
              from: e.fromAgent,
              to: e.toAgent,
            })),
          },
        });
      }

      // ── Step 5: Emit completion event ─────────────────────────────────
      await eventBus.emit({
        type: 'orchestration.complete',
        actor: 'system',
        projectId,
        payload: {
          agentCount: response.messages.length,
          primaryAgent: targetShortName,
        },
      });
    } catch (err) {
      console.error('[OrchestrationEngine] process() error:', err);
      response.messages.push({
        agentShortName: 'SYS',
        agentName: 'System',
        content:
          'I apologize, but something went wrong while processing your request. ' +
          'Our team is looking into it. Please try again in a moment.',
      });

      await eventBus.emit({
        type: 'orchestration.error',
        actor: 'system',
        projectId,
        payload: {
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }

    return response;
  }

  // =========================================================================
  // STREAMING ENTRY POINT
  // =========================================================================

  /**
   * Process a user message with SSE streaming.
   * Yields SSEEvent objects that the API route can serialize as text/event-stream.
   */
  async *processStream(
    request: OrchestrationRequest,
  ): AsyncGenerator<SSEEvent, void, undefined> {
    const { projectId, userMessage, userId, cardId } = request;

    try {
      // ── Step 1: Persist user message (skip if caller already saved it) ─
      if (!request.skipMessageSave) {
        await this.saveUserMessage(projectId, userMessage, cardId);
      }

      // ── Step 2: Determine target agent ────────────────────────────────
      const targetShortName = request.targetAgentShortName
        ?? await messageRouter.route(userMessage, projectId);

      const agentDef = getAgentDefinition(targetShortName);

      // ── Step 3: Signal agent start ────────────────────────────────────
      yield {
        type: 'agent_start',
        data: { agentShortName: targetShortName, agentName: agentDef.name },
      };

      await agentStateManager.setWorking(
        projectId,
        targetShortName,
        `Processing: ${userMessage.slice(0, 80)}`,
      );

      // ── Step 4: Build context (with optional module scope) ────────────
      let scope: { cardId?: string; module?: string } | undefined;
      if (cardId) {
        const card = await prisma.card.findUnique({
          where: { id: cardId },
          select: { module: true },
        });
        scope = { cardId, module: card?.module ?? undefined };
      }
      const context = await contextBuilder.build(agentDef, projectId, { scope });

      const messages: LLMMessage[] = [
        { role: 'system', content: context.systemMessage },
        ...context.recentHistory,
        { role: 'user', content: userMessage },
      ];

      // ── Step 5: Stream LLM response ──────────────────────────────────
      let fullContent = '';
      let fullThinking = '';
      let lastTokensUsed: { prompt: number; completion: number; total: number } | undefined;
      const accumulatedToolCalls: any[] = [];
      const toolDefs = getToolsForAgent(targetShortName);

      for await (const chunk of llmGateway.stream({
        messages,
        temperature: agentDef.temperature,
        agentId: targetShortName,
        projectId,
        metadata: { userId },
        tools: toolDefs.length > 0 ? toolDefs : undefined,
      })) {
        if (chunk.thinking) {
          fullThinking += chunk.thinking;
          yield { type: 'thinking', data: { content: chunk.thinking } };
        }

        if (chunk.content) {
          fullContent += chunk.content;
          yield { type: 'chunk', data: { content: chunk.content } };
        }

        if (chunk.toolCalls && chunk.toolCalls.length > 0) {
          accumulatedToolCalls.push(...chunk.toolCalls);
        }

        if (chunk.done && chunk.tokensUsed) {
          lastTokensUsed = chunk.tokensUsed;
          yield { type: 'usage', data: { tokensUsed: chunk.tokensUsed } };
        }
      }

      // ── Step 6: Parse response ────────────────────────────────────────
      const parsed = parseAgentResponse(
        fullContent, 
        accumulatedToolCalls.length > 0 ? accumulatedToolCalls : undefined
      );

      // Yield artifacts
      for (const artifact of parsed.artifacts) {
        yield {
          type: 'artifact',
          data: { name: artifact.name, type: artifact.type },
        };
      }

      // ── Step 7: Authority guard + execute side effects ──────────────
      const { allowed: authorizedActions, blocked: blockedActions } =
        filterAuthorizedActions(agentDef, parsed.actions);
      if (blockedActions.length > 0) {
        yield {
          type: 'info',
          data: {
            message: `Authority guard blocked ${blockedActions.length} action(s) from ${agentDef.shortName}: ${blockedActions.map(b => b.action.type).join(', ')}`,
          },
        };
      }
      const agentRecord = await agentStateManager.getAgent(projectId, targetShortName);
      await this.executeSideEffects(authorizedActions, projectId, userId, agentRecord?.id);
      if (authorizedActions.length > 0) invalidateProjectCache(projectId);

      // ── Step 8: Persist agent response ────────────────────────────────
      const savedMessage = await this.saveAgentMessage(
        projectId,
        targetShortName,
        parsed.message,
        fullThinking || undefined,
        parsed.artifacts,
      );

      // Persist artifacts
      for (const artifact of parsed.artifacts) {
        await this.persistArtifact(artifact, projectId, targetShortName, savedMessage.id);
      }

      // ── Step 9: Reset agent status ────────────────────────────────────
      await agentStateManager.setIdle(projectId, targetShortName);

      // ── Step 10: Handle delegation ────────────────────────────────────
      if (parsed.delegateTo) {
        yield {
          type: 'delegation',
          data: {
            fromAgent: targetShortName,
            toAgent: parsed.delegateTo,
          },
        };

        const delegateContext = parsed.delegateContext ?? parsed.message;
        const chain = await delegationHandler.handleDelegation(
          parsed.delegateTo,
          delegateContext,
          projectId,
          (shortName, message, pid) =>
            this.executeAgentPipeline(shortName, message, pid, userId, scope),
          targetShortName,
        );

        // Yield delegation results as chunks
        for (const entry of chain) {
          yield {
            type: 'agent_start',
            data: {
              agentShortName: entry.result.agentShortName,
              agentName: this.getAgentName(entry.result.agentShortName),
            },
          };
          yield {
            type: 'chunk',
            data: { content: entry.result.message },
          };
          yield {
            type: 'done',
            data: {
              agentShortName: entry.result.agentShortName,
            },
          };
        }
      }

      // ── Step 10.5: Recursive auto-chain pipeline ──────────────────────
      // If an agent completed work but didn't explicitly delegate,
      // check if the pipeline should auto-continue to the next agent.
      // This loop allows the full SDLC pipeline to execute autonomously:
      // BA → SA → UX → PM → DO → TL → JD/SD → QA → SEC → PM
      if (!parsed.delegateTo) {
        const MAX_CHAIN_DEPTH = 12;
        let chainAgent = targetShortName;
        let chainParsed = parsed;
        let chainDepth = 0;

        while (chainDepth < MAX_CHAIN_DEPTH) {
          const nextAgent = this.getAutoChainTarget(chainAgent, chainParsed);
          if (!nextAgent) break;
          chainDepth++;

          console.log(
            `[Engine] 🔗 Auto-chain step ${chainDepth}: ${chainAgent} → ${nextAgent.agent}`,
          );

          // Emit pipeline progress
          yield {
            type: 'pipeline_progress',
            data: {
              currentAgent: nextAgent.agent,
              fromAgent: chainAgent,
              step: chainDepth,
              totalSteps: MAX_CHAIN_DEPTH,
              phase: this.getAgentName(nextAgent.agent),
            },
          };

          yield {
            type: 'delegation',
            data: {
              fromAgent: chainAgent,
              toAgent: nextAgent.agent,
            },
          };

          // Execute the next agent directly (not via delegation handler)
          const chainContext = nextAgent.context(chainParsed);

          yield {
            type: 'agent_start',
            data: {
              agentShortName: nextAgent.agent,
              agentName: this.getAgentName(nextAgent.agent),
            },
          };

          try {
            const result = await this.executeAgentPipeline(
              nextAgent.agent,
              chainContext,
              projectId,
              userId,
              scope,
            );

            // Parse the chained agent's response for further chaining
            const newParsed = parseAgentResponse(result.message);

            yield {
              type: 'chunk',
              data: { content: result.message },
            };

            // Yield artifacts from chained agent
            for (const artifact of newParsed.artifacts) {
              yield {
                type: 'artifact',
                data: { name: artifact.name, type: artifact.type },
              };
            }

            yield {
              type: 'done',
              data: {
                agentShortName: nextAgent.agent,
              },
            };

            // If the chained agent explicitly delegated, let delegation handler
            // take over (don't continue the auto-chain loop)
            if (newParsed.delegateTo) {
              console.log(
                `[Engine] 🔗 Chain agent ${nextAgent.agent} delegated to ${newParsed.delegateTo} — delegation handler takes over`,
              );
              const delegateContext = newParsed.delegateContext ?? newParsed.message;
              const chain = await delegationHandler.handleDelegation(
                newParsed.delegateTo,
                delegateContext,
                projectId,
                (shortName, message, pid) =>
                  this.executeAgentPipeline(shortName, message, pid, userId, scope),
                nextAgent.agent,
              );
              for (const entry of chain) {
                yield {
                  type: 'agent_start',
                  data: {
                    agentShortName: entry.result.agentShortName,
                    agentName: this.getAgentName(entry.result.agentShortName),
                  },
                };
                yield {
                  type: 'chunk',
                  data: { content: entry.result.message },
                };
                yield {
                  type: 'done',
                  data: {
                    agentShortName: entry.result.agentShortName,
                  },
                };
              }
              break; // Exit auto-chain loop
            }

            // Continue chain with the new agent's output
            chainAgent = nextAgent.agent;
            chainParsed = newParsed;
          } catch (chainErr) {
            console.error(
              `[Engine] 🔗 Auto-chain error at step ${chainDepth} (${nextAgent.agent}):`,
              chainErr,
            );
            yield {
              type: 'error',
              data: {
                message: `Pipeline step ${chainDepth} (${this.getAgentName(nextAgent.agent)}) failed: ${chainErr instanceof Error ? chainErr.message : String(chainErr)}`,
              },
            };
            break; // Stop the chain on error
          }
        }

        if (chainDepth >= MAX_CHAIN_DEPTH) {
          console.warn('[Engine] 🔗 Auto-chain reached max depth limit');
          yield {
            type: 'info',
            data: { message: 'Pipeline auto-chain reached maximum depth. Stopping.' },
          };
        }
      }

      // ── Step 11: Emit done ────────────────────────────────────────────
      yield {
        type: 'done',
        data: {
          messageId: savedMessage.id,
          agentShortName: targetShortName,
        },
      };

      // Emit event for real-time UI
      await eventBus.emit({
        type: 'orchestration.complete',
        actor: targetShortName,
        projectId,
        payload: {
          messageId: savedMessage.id,
          tokensUsed: lastTokensUsed?.total ?? 0,
        },
      });
    } catch (err) {
      console.error('[OrchestrationEngine] processStream() error:', err);
      yield {
        type: 'error',
        data: {
          message:
            err instanceof Error
              ? err.message
              : 'An unexpected error occurred while processing your request.',
        },
      };

      await eventBus.emit({
        type: 'orchestration.error',
        actor: 'system',
        projectId,
        payload: {
          error: err instanceof Error ? err.message : String(err),
        },
      });
    }
  }

  // =========================================================================
  // AGENT EXECUTION PIPELINE
  // =========================================================================

  /**
   * Full pipeline for executing a single agent: context -> LLM -> parse ->
   * side effects -> persist -> state reset.
   *
   * Used by both process() and delegation callbacks.
   */
  private async executeAgentPipeline(
    shortName: string,
    message: string,
    projectId: string,
    userId: string,
    delegationScope?: { cardId?: string; module?: string },
  ): Promise<AgentExecutionResult & { delegateContext?: string }> {
    const agentDef = getAgentDefinition(shortName);

    // Set agent to WORKING
    await agentStateManager.setWorking(
      projectId,
      shortName,
      `Processing: ${message.slice(0, 80)}`,
    );

    await eventBus.emit({
      type: 'agent.started',
      actor: shortName,
      projectId,
      payload: { task: message.slice(0, 200) },
    });

    try {
      // Build context — delegated agents skip chat history (context comes from delegator)
      const context = await contextBuilder.build(agentDef, projectId, {
        scope: delegationScope,
        isDelegation: true,
      });

      // Construct LLM messages array
      const llmMessages: LLMMessage[] = [
        { role: 'system', content: context.systemMessage },
        ...context.recentHistory,
        { role: 'user', content: message },
      ];

      const toolDefs = getToolsForAgent(shortName);

      // Call LLM via gateway
      const llmResponse = await llmGateway.complete({
        messages: llmMessages,
        temperature: agentDef.temperature,
        agentId: shortName,
        projectId,
        metadata: { userId },
        tools: toolDefs.length > 0 ? toolDefs : undefined,
      });

      // Parse response
      const parsed = parseAgentResponse(llmResponse.content, llmResponse.toolCalls);

      // Authority guard + Execute side effects
      const { allowed: authorizedActions } = filterAuthorizedActions(agentDef, parsed.actions);
      const agentRecord = await agentStateManager.getAgent(projectId, shortName);
      await this.executeSideEffects(authorizedActions, projectId, userId, agentRecord?.id);
      if (authorizedActions.length > 0) invalidateProjectCache(projectId);

      // Persist agent response
      const savedMessage = await this.saveAgentMessage(
        projectId,
        shortName,
        parsed.message,
        llmResponse.thinking,
        parsed.artifacts,
      );

      // Persist artifacts with smart routing
      for (const artifact of parsed.artifacts) {
        await this.persistArtifact(artifact, projectId, shortName, savedMessage.id);
      }

      // Reset agent status
      await agentStateManager.setIdle(projectId, shortName);

      await eventBus.emit({
        type: 'agent.completed',
        actor: shortName,
        projectId,
        payload: {
          actionsExecuted: parsed.actions.length,
          artifactsProduced: parsed.artifacts.length,
          delegatedTo: parsed.delegateTo ?? null,
          tokensUsed: llmResponse.tokensUsed.total,
          latencyMs: llmResponse.latencyMs,
        },
      });

      return {
        message: parsed.message,
        thinking: llmResponse.thinking,
        agentShortName: shortName,
        artifacts: parsed.artifacts,
        actions: parsed.actions,
        delegateTo: parsed.delegateTo,
        delegateContext: parsed.delegateContext,
      };
    } catch (err) {
      // Ensure agent is reset even on failure
      await agentStateManager.setIdle(projectId, shortName).catch(() => {});

      await eventBus.emit({
        type: 'agent.error',
        actor: shortName,
        projectId,
        payload: {
          error: err instanceof Error ? err.message : String(err),
        },
      });

      throw err;
    }
  }

  // =========================================================================
  // SIDE EFFECT EXECUTOR
  // =========================================================================

  /**
   * Execute all side effects from parsed agent actions.
   * Each action type maps to a specific Prisma operation.
   * Errors in individual actions are logged but do not block other actions.
   */
  private async executeSideEffects(
    actions: AgentAction[],
    projectId: string,
    userId: string,
    agentDbId?: string | null,
  ): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'create_card': {
            const cardType = this.mapCardType(action.data.type);
            const priority = this.mapPriority(action.data.priority);
            await prisma.card.create({
              data: {
                title: action.data.title,
                description: action.data.description ?? '',
                type: cardType,
                priority,
                projectId,
                ownerAgentId: agentDbId ?? undefined,
                parentId: action.data.parentId ?? undefined,
                module: action.data.module ?? null,
              },
            });

            await eventBus.emit({
              type: 'action.executed',
              actor: 'system',
              projectId,
              payload: {
                actionType: 'create_card',
                title: action.data.title,
              },
            });
            break;
          }

          case 'update_card': {
            const updateData: Record<string, unknown> = {};
            if (action.data.state) {
              const newState = this.mapCardState(action.data.state);

              // DoD validation: check if state transition is allowed
              const existingCard = await prisma.card.findUnique({
                where: { id: action.cardId },
                select: { state: true, type: true },
              });
              if (existingCard) {
                const transitionResult = await validateCardTransition(
                  action.cardId,
                  projectId,
                  existingCard.state as LifecycleCardState,
                  newState as LifecycleCardState,
                  existingCard.type as LifecycleCardType,
                );
                if (!transitionResult.allowed) {
                  console.warn(
                    `[Engine] DoD blocked card ${action.cardId}: ${transitionResult.reason}`,
                    transitionResult.requirements,
                  );
                  // Skip this state change but continue processing other fields
                  // The agent will see the card is still in the old state on next invocation
                } else {
                  updateData.state = newState;
                }
              } else {
                updateData.state = newState;
              }
            }
            if (action.data.title) {
              updateData.title = action.data.title;
            }
            if (action.data.priority) {
              updateData.priority = this.mapPriority(action.data.priority);
            }

            if (Object.keys(updateData).length > 0) {
              await prisma.card.update({
                where: { id: action.cardId },
                data: updateData,
              });
            }

            await eventBus.emit({
              type: 'action.executed',
              actor: 'system',
              projectId,
              payload: {
                actionType: 'update_card',
                cardId: action.cardId,
                changes: updateData,
              },
            });
            break;
          }

          case 'create_decision': {
            const riskRating = this.mapRiskRating(action.data.riskRating);
            await prisma.decision.create({
              data: {
                trigger: action.data.trigger,
                context: action.data.context ?? '',
                riskRating,
                recommendation: action.data.recommendation ?? '',
                ownerId: userId,
                projectId,
                options: action.data.options?.length
                  ? {
                      create: action.data.options.map((opt) => ({
                        name: opt.name,
                        description: opt.description ?? '',
                        pros: opt.pros ?? [],
                        cons: opt.cons ?? [],
                        risk: this.mapRiskRating(opt.risk),
                        effort: this.mapEffort(opt.effort),
                      })),
                    }
                  : undefined,
              },
            });

            await eventBus.emit({
              type: 'action.executed',
              actor: 'system',
              projectId,
              payload: {
                actionType: 'create_decision',
                trigger: action.data.trigger,
              },
            });
            break;
          }

          case 'create_document': {
            const docType = this.mapDocumentType(action.data.type);
            const wordCount = action.data.content
              ? action.data.content.split(/\s+/).filter(Boolean).length
              : 0;
            await prisma.document.create({
              data: {
                title: action.data.title,
                type: docType,
                content: action.data.content ?? '',
                wordCount,
                owner: action.data.owner ?? 'AI Team',
                projectId,
              },
            });

            await eventBus.emit({
              type: 'action.executed',
              actor: 'system',
              projectId,
              payload: {
                actionType: 'create_document',
                title: action.data.title,
              },
            });
            break;
          }

          case 'update_document': {
            // Find existing DRAFT document of this type and append/replace content.
            // If none exists, create a new staging document.
            const updateDocType = this.mapDocumentType(action.data.type);
            const existingDoc = await prisma.document.findFirst({
              where: { projectId, type: updateDocType, status: 'DRAFT' },
              orderBy: { createdAt: 'desc' },
            });

            if (existingDoc) {
              const mode = action.data.mode ?? 'append';
              const newContent = mode === 'append'
                ? existingDoc.content + '\n\n' + action.data.content
                : action.data.content;
              await prisma.document.update({
                where: { id: existingDoc.id },
                data: {
                  content: newContent,
                  wordCount: newContent.split(/\s+/).filter(Boolean).length,
                },
              });
              console.log(
                `[Engine] 📝 Updated staging ${action.data.type} (${mode}) — ${newContent.split(/\s+/).filter(Boolean).length} words`,
              );
            } else {
              // Create new staging document
              const content = action.data.content;
              await prisma.document.create({
                data: {
                  title: `Staging: ${action.data.type} Requirements`,
                  type: updateDocType,
                  content,
                  wordCount: content.split(/\s+/).filter(Boolean).length,
                  owner: 'BA',
                  projectId,
                },
              });
              console.log(
                `[Engine] 📝 Created staging ${action.data.type} document`,
              );
            }

            await eventBus.emit({
              type: 'action.executed',
              actor: 'system',
              projectId,
              payload: {
                actionType: 'update_document',
                docType: action.data.type,
                mode: action.data.mode ?? 'append',
              },
            });
            break;
          }

          case 'approve_document': {
            // Mark documents of this type as APPROVED for the project
            const approveDocType = this.mapDocumentType(action.data.type);
            const updated = await prisma.document.updateMany({
              where: {
                projectId,
                type: approveDocType,
                status: { not: 'APPROVED' },
              },
              data: { status: 'APPROVED' },
            });

            console.log(
              `[Engine] ✅ Approved ${updated.count} ${action.data.type} document(s) for project ${projectId}`,
            );

            await eventBus.emit({
              type: 'action.executed',
              actor: 'system',
              projectId,
              payload: {
                actionType: 'approve_document',
                docType: action.data.type,
                count: updated.count,
              },
            });
            break;
          }

          case 'advance_sdlc': {
            // ── Quality Gate Check ──────────────────────────────────────
            const gateResult = await validateStageGate(projectId, action.stageName);
            if (!gateResult.passed) {
              console.warn(
                `[Engine] ⛔ advance_sdlc BLOCKED for "${action.stageName}": ${gateResult.reason}`,
              );
              await eventBus.emit({
                type: 'action.executed',
                actor: 'system',
                projectId,
                payload: {
                  actionType: 'advance_sdlc_blocked',
                  stageName: action.stageName,
                  reason: gateResult.reason,
                  blockedBy: gateResult.blockedBy,
                },
              });
              break; // Skip advancement — gate not passed
            }

            // ── Gate passed — proceed with stage advancement ───────────
            const stages = await prisma.sDLCStage.findMany({
              where: { projectId },
              orderBy: { order: 'asc' },
            });

            const targetStage = stages.find(
              (s) => s.name.toLowerCase() === action.stageName.toLowerCase(),
            );

            if (targetStage) {
              // Complete all stages up to and including the target
              const stagesToComplete = stages.filter(
                (s) => s.order <= targetStage.order && s.status !== 'COMPLETED',
              );
              for (const stage of stagesToComplete) {
                await prisma.sDLCStage.update({
                  where: { id: stage.id },
                  data: { status: 'COMPLETED', gatePassed: true },
                });
              }

              // Activate the next stage after the target
              const nextStage = stages.find((s) => s.order === targetStage.order + 1);
              if (nextStage) {
                await prisma.sDLCStage.update({
                  where: { id: nextStage.id },
                  data: { status: 'ACTIVE' },
                });

                // Update project's current stage
                await prisma.project.update({
                  where: { id: projectId },
                  data: { currentStage: nextStage.name },
                });
              }
            }

            await eventBus.emit({
              type: 'action.executed',
              actor: 'system',
              projectId,
              payload: {
                actionType: 'advance_sdlc',
                stageName: action.stageName,
              },
            });
            break;
          }

          case 'update_agent_status': {
            const validStatuses = ['IDLE', 'WORKING', 'WAITING', 'BLOCKED'] as const;
            const status = validStatuses.find(
              (s) => s === action.status.toUpperCase(),
            );

            if (status) {
              await agentStateManager.setStatus(
                projectId,
                action.agentId,
                status,
                action.task ?? null,
              );
            }
            break;
          }

          case 'delegate': {
            // Delegation is handled at the orchestration level, not as a side effect.
            // This case exists to prevent the default warning from firing.
            break;
          }

          case 'create_branch': {
            const branchData = action.data as { name: string; baseBranch?: string };
            // Create DB record
            await prisma.gitBranch.create({
              data: {
                name: branchData.name,
                status: 'ACTIVE',
                author: 'AI Agent',
                projectId,
              },
            });
            // Also create on GitHub if configured
            try {
              const gitProject = await prisma.project.findUnique({
                where: { id: projectId },
                select: { gitTokenEncrypted: true, gitRepoOwner: true, gitRepoName: true, gitDefaultBranch: true },
              });
              if (gitProject?.gitTokenEncrypted && gitProject.gitRepoOwner && gitProject.gitRepoName) {
                const { createGitHubClient, getRef, createBranchRef } = await import('@/lib/git/github-client');
                const ghClient = createGitHubClient(gitProject.gitTokenEncrypted);
                const baseBranch = branchData.baseBranch ?? gitProject.gitDefaultBranch ?? 'main';
                const baseSha = await getRef(ghClient, gitProject.gitRepoOwner, gitProject.gitRepoName, baseBranch);
                await createBranchRef(ghClient, gitProject.gitRepoOwner, gitProject.gitRepoName, branchData.name, baseSha);
                console.log(`[OrchestrationEngine] Created branch on GitHub: ${branchData.name}`);
              }
            } catch (ghErr) {
              console.warn(`[OrchestrationEngine] GitHub branch creation failed (DB record saved):`, ghErr);
            }
            console.log(`[OrchestrationEngine] Created branch: ${branchData.name}`);
            break;
          }

          case 'create_pr': {
            const prData = action.data as { title: string; branch: string; description?: string };
            // Auto-increment PR number
            const maxPr = await prisma.gitPullRequest.findFirst({
              where: { projectId },
              orderBy: { number: 'desc' },
              select: { number: true },
            });
            const nextNumber = (maxPr?.number ?? 0) + 1;
            // Try GitHub first, then save to DB
            let ghPrNumber = nextNumber;
            try {
              const gitProject = await prisma.project.findUnique({
                where: { id: projectId },
                select: { gitTokenEncrypted: true, gitRepoOwner: true, gitRepoName: true, gitDefaultBranch: true },
              });
              if (gitProject?.gitTokenEncrypted && gitProject.gitRepoOwner && gitProject.gitRepoName) {
                const { createGitHubClient, createPullRequest: ghCreatePR } = await import('@/lib/git/github-client');
                const ghClient = createGitHubClient(gitProject.gitTokenEncrypted);
                const baseBranch = gitProject.gitDefaultBranch ?? 'main';
                const prResult = await ghCreatePR(
                  ghClient, gitProject.gitRepoOwner, gitProject.gitRepoName,
                  prData.title, prData.description ?? '', prData.branch, baseBranch,
                );
                ghPrNumber = prResult.number;
                console.log(`[OrchestrationEngine] Created PR #${ghPrNumber} on GitHub`);
              }
            } catch (ghErr) {
              console.warn(`[OrchestrationEngine] GitHub PR creation failed (saving to DB only):`, ghErr);
            }
            await prisma.gitPullRequest.create({
              data: {
                number: ghPrNumber,
                title: prData.title,
                branch: prData.branch,
                status: 'OPEN',
                author: 'AI Agent',
                projectId,
              },
            });
            console.log(`[OrchestrationEngine] Created PR #${ghPrNumber}: ${prData.title}`);
            break;
          }

          case 'create_release': {
            const releaseData = action.data as { version: string; features?: string[] };
            await prisma.gitRelease.create({
              data: {
                version: releaseData.version,
                status: 'DRAFT',
                features: releaseData.features ?? [],
                projectId,
              },
            });
            console.log(`[OrchestrationEngine] Created release: ${releaseData.version}`);
            break;
          }

          case 'create_repo': {
            const repoData = action.data as { name: string; description?: string; isPrivate?: boolean };
            try {
              const gitProject = await prisma.project.findUnique({
                where: { id: projectId },
                select: { gitTokenEncrypted: true, gitRepoOwner: true, gitRepoName: true },
              });
              if (gitProject?.gitRepoOwner && gitProject?.gitRepoName) {
                console.log(`[OrchestrationEngine] Repo already configured: ${gitProject.gitRepoOwner}/${gitProject.gitRepoName}, skipping create_repo`);
              } else if (gitProject?.gitTokenEncrypted) {
                const { createGitHubClient, createRepository } = await import('@/lib/git/github-client');
                const { initializeRepo } = await import('@/lib/git/repo-manager');
                const ghClient = createGitHubClient(gitProject.gitTokenEncrypted);
                const repo = await createRepository(ghClient, {
                  name: repoData.name,
                  description: repoData.description,
                  isPrivate: repoData.isPrivate ?? true,
                  autoInit: true,
                });
                await prisma.project.update({
                  where: { id: projectId },
                  data: {
                    gitProvider: 'github',
                    gitRepoOwner: repo.owner,
                    gitRepoName: repo.name,
                    gitDefaultBranch: repo.defaultBranch,
                    gitSyncEnabled: true,
                  },
                });
                await initializeRepo(projectId);
                console.log(`[OrchestrationEngine] Created GitHub repo: ${repo.fullName}`);
              } else {
                console.warn(`[OrchestrationEngine] No GitHub token configured, cannot create_repo`);
              }
            } catch (ghErr) {
              console.warn(`[OrchestrationEngine] GitHub repo creation failed:`, ghErr);
            }
            break;
          }

          case 'trigger_deploy': {
            const deployData = action.data as { pipelineName?: string; environment?: string; branch?: string };
            const pipeline = await prisma.deploymentPipeline.findFirst({
              where: {
                projectId,
                ...(deployData.pipelineName ? { name: deployData.pipelineName } : {}),
              },
            });
            if (pipeline) {
              await prisma.deploymentRun.create({
                data: {
                  pipelineId: pipeline.id,
                  status: 'PENDING',
                  currentStage: 'BUILD',
                  triggeredBy: agentDbId ?? 'system',
                  branch: deployData.branch ?? 'main',
                  projectId,
                },
              });
              console.log(`[OrchestrationEngine] Triggered deploy on pipeline: ${pipeline.name}`);
            }
            break;
          }

          case 'create_pipeline': {
            const pipelineData = action.data as { name: string; environment: string; trigger: string; config?: string };
            await prisma.deploymentPipeline.create({
              data: {
                name: pipelineData.name,
                environment: (pipelineData.environment?.toUpperCase() ?? 'STAGING') as any,
                trigger: (pipelineData.trigger?.toUpperCase() ?? 'MANUAL') as any,
                config: pipelineData.config ?? '{}',
                projectId,
              },
            });
            console.log(`[OrchestrationEngine] Created pipeline: ${pipelineData.name}`);
            break;
          }

          case 'remember': {
            const memoryData = action.data as { category: string; content: string };
            await prisma.projectMemory.create({
              data: {
                projectId,
                category: memoryData.category,
                content: memoryData.content,
                source: `agent:${agentDbId ? 'unknown' : 'system'}`,
              },
            });
            console.log(`[OrchestrationEngine] Saved memory: [${memoryData.category}] ${memoryData.content.slice(0, 80)}`);

            await eventBus.emit({
              type: 'action.executed',
              actor: 'system',
              projectId,
              payload: {
                actionType: 'remember',
                category: memoryData.category,
              },
            });
            break;
          }

          case 'run_code': {
            const runData = action.data as { language: string; code: string; stdin?: string; artifactName?: string };

            // Find linked artifact if artifactName was provided
            let artifactId: string | null = null;
            if (runData.artifactName) {
              const artifact = await prisma.artifact.findFirst({
                where: { projectId, name: runData.artifactName },
                orderBy: { version: 'desc' },
                select: { id: true },
              });
              artifactId = artifact?.id ?? null;
            }

            // Create CodeExecution record
            const execution = await prisma.codeExecution.create({
              data: {
                language: runData.language,
                code: runData.code,
                stdin: runData.stdin ?? '',
                artifactId,
                triggeredBy: agentDbId ?? 'agent',
                projectId,
              },
            });

            // Enqueue execution job (dynamic import to avoid circular deps)
            const { addCodeExecutionJob } = await import('@/lib/queue/code-execution-queue');
            await addCodeExecutionJob({
              executionId: execution.id,
              projectId,
            });

            console.log(`[OrchestrationEngine] Queued code execution ${execution.id}: ${runData.language}`);

            await eventBus.emit({
              type: 'action.executed',
              actor: 'system',
              projectId,
              payload: {
                actionType: 'run_code',
                executionId: execution.id,
                language: runData.language,
              },
            });
            break;
          }

          default: {
            // TypeScript exhaustive check — if we get here, a new action type
            // was added to the union but not handled.
            const _exhaustive: never = action;
            console.warn(
              '[OrchestrationEngine] Unhandled action type:',
              (_exhaustive as AgentAction).type,
            );
          }
        }
      } catch (err) {
        console.error(
          `[OrchestrationEngine] Side effect "${action.type}" failed:`,
          err,
        );
        // Continue processing remaining actions — one failure shouldn't
        // block the entire response.
      }
    }
  }

  // =========================================================================
  // PERSISTENCE HELPERS
  // =========================================================================

  /**
   * Save the user's message to the ChatMessage table.
   */
  private async saveUserMessage(
    projectId: string,
    content: string,
    cardId?: string,
  ): Promise<{ id: string }> {
    return prisma.chatMessage.create({
      data: {
        role: 'USER',
        content,
        projectId,
        cardId: cardId ?? null,
      },
      select: { id: true },
    });
  }

  /**
   * Save an agent's response to the ChatMessage table.
   * Resolves the agent's DB record to link via agentId.
   */
  private async saveAgentMessage(
    projectId: string,
    shortName: string,
    content: string,
    thinking?: string,
    artifacts?: Array<{ name: string; type: string }>,
  ): Promise<{ id: string }> {
    // Resolve the agent's DB ID for the relation
    const agentRecord = await prisma.agent.findFirst({
      where: { projectId, shortName },
      select: { id: true },
    });

    return prisma.chatMessage.create({
      data: {
        role: 'AGENT',
        content,
        thinking: thinking ?? null,
        agentId: agentRecord?.id ?? null,
        projectId,
        artifacts: artifacts && artifacts.length > 0
          ? JSON.stringify(artifacts.map(a => ({ name: a.name, type: a.type })))
          : null,
      },
      select: { id: true },
    });
  }

  /**
   * Persist a code/document artifact with smart routing based on category.
   * - CODE, CONFIG, TEST → prisma.artifact.create()
   * - DOCUMENT → prisma.document.create() (legacy behavior)
   * Small artifacts (< 20 chars) are skipped.
   */
  private async persistArtifact(
    artifact: { name: string; type: string; content: string },
    projectId: string,
    agentShortName: string,
    messageId?: string,
  ): Promise<void> {
    if (!artifact.content || artifact.content.length < 20) return;

    const category = this.inferArtifactCategory(artifact.type, artifact.name, agentShortName);

    try {
      if (category === 'DOCUMENT') {
        // Legacy path: save to Document table
        const docType = this.inferDocumentType(artifact.type, artifact.name);
        const wordCount = artifact.content.split(/\s+/).filter(Boolean).length;

        await prisma.document.create({
          data: {
            title: artifact.name,
            type: docType,
            content: artifact.content,
            wordCount,
            owner: agentShortName,
            projectId,
          },
        });
      } else {
        // New path: save to Artifact table with typed category
        await prisma.artifact.create({
          data: {
            name: artifact.name,
            type: category as 'CODE' | 'CONFIG' | 'TEST',
            content: artifact.content,
            ownerAgent: agentShortName,
            projectId,
            messageId: messageId ?? null,
          },
        });
      }
    } catch (err) {
      console.error(
        `[OrchestrationEngine] Failed to persist artifact "${artifact.name}" (${category}):`,
        err,
      );
    }
  }

  /**
   * Infer the artifact category based on type, filename, and producing agent.
   * Used to route artifacts to the correct persistence table.
   */
  private inferArtifactCategory(
    artifactType: string,
    artifactName: string,
    agentShortName: string,
  ): 'CODE' | 'CONFIG' | 'TEST' | 'DOCUMENT' {
    const lower = artifactType.toLowerCase();
    const nameLower = artifactName.toLowerCase();

    // Test detection: QA/AT agents or test-related filenames
    if (['QA', 'AT'].includes(agentShortName) ||
        nameLower.includes('test') || nameLower.includes('spec') || nameLower.includes('e2e')) {
      return 'TEST';
    }

    // Config detection
    const configTypes = ['json', 'yaml', 'toml', 'env', 'dockerfile', 'terraform', 'prisma', 'graphql', 'protobuf', 'xml'];
    if (configTypes.some(t => lower.includes(t))) return 'CONFIG';

    // Document detection: markdown from doc-producing agents
    const docAgents = ['BA', 'PM', 'SA', 'DEC', 'AUD'];
    if ((lower.includes('markdown') || lower === 'text') && docAgents.includes(agentShortName)) {
      return 'DOCUMENT';
    }

    // Code detection
    const codeTypes = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'ruby', 'html', 'css', 'scss', 'shell', 'sql'];
    if (codeTypes.some(t => lower.includes(t))) return 'CODE';

    // Default: if it has a code-like extension, it's code; otherwise document
    const ext = artifactName.split('.').pop()?.toLowerCase() ?? '';
    const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'rb', 'sh', 'sql', 'html', 'css', 'scss'];
    if (codeExtensions.includes(ext)) return 'CODE';

    return 'DOCUMENT';
  }

  // =========================================================================
  // ENUM MAPPERS
  // =========================================================================

  /**
   * Safely map a string to a CardType enum value.
   */
  private mapCardType(
    type?: string,
  ): 'EPIC' | 'FEATURE' | 'TASK' | 'QA' | 'DECISION_BLOCKER' {
    const map: Record<string, 'EPIC' | 'FEATURE' | 'TASK' | 'QA' | 'DECISION_BLOCKER'> = {
      EPIC: 'EPIC',
      FEATURE: 'FEATURE',
      TASK: 'TASK',
      QA: 'QA',
      DECISION_BLOCKER: 'DECISION_BLOCKER',
      epic: 'EPIC',
      feature: 'FEATURE',
      task: 'TASK',
      qa: 'QA',
      decision_blocker: 'DECISION_BLOCKER',
    };
    return map[type ?? ''] ?? 'TASK';
  }

  /**
   * Safely map a string to a CardState enum value.
   */
  private mapCardState(
    state: string,
  ): 'PLANNED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'TESTING' | 'BLOCKED' | 'DONE' | 'RELEASED' {
    const map: Record<
      string,
      'PLANNED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'TESTING' | 'BLOCKED' | 'DONE' | 'RELEASED'
    > = {
      PLANNED: 'PLANNED',
      IN_PROGRESS: 'IN_PROGRESS',
      UNDER_REVIEW: 'UNDER_REVIEW',
      TESTING: 'TESTING',
      BLOCKED: 'BLOCKED',
      DONE: 'DONE',
      RELEASED: 'RELEASED',
      planned: 'PLANNED',
      in_progress: 'IN_PROGRESS',
      under_review: 'UNDER_REVIEW',
      testing: 'TESTING',
      blocked: 'BLOCKED',
      done: 'DONE',
      released: 'RELEASED',
    };
    return map[state] ?? 'PLANNED';
  }

  /**
   * Safely map a string to a Priority enum value.
   */
  private mapPriority(priority?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const map: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
      CRITICAL: 'CRITICAL',
      low: 'LOW',
      medium: 'MEDIUM',
      high: 'HIGH',
      critical: 'CRITICAL',
    };
    return map[priority ?? ''] ?? 'MEDIUM';
  }

  /**
   * Safely map a string to a RiskRating enum value.
   */
  private mapRiskRating(rating?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    const map: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
      CRITICAL: 'CRITICAL',
      low: 'LOW',
      medium: 'MEDIUM',
      high: 'HIGH',
      critical: 'CRITICAL',
    };
    return map[rating ?? ''] ?? 'MEDIUM';
  }

  /**
   * Safely map a string to an Effort enum value.
   */
  private mapEffort(effort?: string): 'LOW' | 'MEDIUM' | 'HIGH' {
    const map: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
      LOW: 'LOW',
      MEDIUM: 'MEDIUM',
      HIGH: 'HIGH',
      low: 'LOW',
      medium: 'MEDIUM',
      high: 'HIGH',
    };
    return map[effort ?? ''] ?? 'MEDIUM';
  }

  /**
   * Safely map a string to a DocumentType enum value.
   */
  private mapDocumentType(
    type: string,
  ): 'BRD' | 'SDD' | 'API_SPEC' | 'RUNBOOK' | 'ADR' {
    const map: Record<string, 'BRD' | 'SDD' | 'API_SPEC' | 'RUNBOOK' | 'ADR'> = {
      BRD: 'BRD',
      SDD: 'SDD',
      API_SPEC: 'API_SPEC',
      RUNBOOK: 'RUNBOOK',
      ADR: 'ADR',
      brd: 'BRD',
      sdd: 'SDD',
      api_spec: 'API_SPEC',
      runbook: 'RUNBOOK',
      adr: 'ADR',
    };
    return map[type] ?? 'BRD';
  }

  /**
   * Infer a DocumentType from an artifact type string.
   * Falls back to BRD for unknown types.
   */
  private inferDocumentType(
    artifactType: string,
    artifactName?: string,
  ): 'BRD' | 'SDD' | 'API_SPEC' | 'RUNBOOK' | 'ADR' {
    const lower = artifactType.toLowerCase();
    const nameLower = (artifactName ?? '').toLowerCase();
    const combined = `${lower} ${nameLower}`;
    if (combined.includes('api') || combined.includes('openapi') || combined.includes('swagger')) {
      return 'API_SPEC';
    }
    if (combined.includes('architecture') || combined.includes('design') || combined.includes('sdd')) {
      return 'SDD';
    }
    if (combined.includes('runbook') || combined.includes('ops') || combined.includes('deploy')) {
      return 'RUNBOOK';
    }
    if (combined.includes('adr') || combined.includes('decision')) {
      return 'ADR';
    }
    return 'BRD';
  }

  // =========================================================================
  // UTILITY HELPERS
  // =========================================================================

  /**
   * Get the display name for an agent by shortName.
   * Falls back to the shortName itself if the definition isn't found.
   */
  /**
   * Determine if the pipeline should auto-continue after an agent completes.
   * Returns the next agent to invoke, or null if the chain should stop.
   */
  private getAutoChainTarget(
    completedAgent: string,
    parsed: ParsedResponse,
  ): { agent: string; context: (p: ParsedResponse) => string } | null {
    const actions = parsed.actions ?? [];
    const artifacts = parsed.artifacts ?? [];

    const hasCodeArtifacts = artifacts.some(
      (a) => a.type === 'CODE' || a.type === 'code' ||
             a.name.endsWith('.ts') || a.name.endsWith('.tsx') ||
             a.name.endsWith('.js') || a.name.endsWith('.jsx')
    );
    const hasTestArtifacts = artifacts.some(
      (a) => a.type === 'TEST' || a.type === 'test' || a.name.includes('.test.') || a.name.includes('.spec.')
    );

    // ── Upstream auto-chain rules (full SDLC pipeline) ──

    // BA approved BRD → SA designs architecture
    if (completedAgent === 'BA') {
      const hasBrdApproval = actions.some(
        (a) => a.type === 'approve_document' && (a.data?.type === 'BRD' || a.data?.type === 'brd')
      );
      if (hasBrdApproval) {
        return {
          agent: 'SA',
          context: (p) => `[PIPELINE] The Business Requirements Document (BRD) has been approved by the stakeholder. Please design the system architecture based on the requirements. Read the BRD from your context documents and produce a System Design Document (SDD) covering tech stack, database schema, API design, and component architecture.\n\nBA summary:\n${p.message}`,
        };
      }
    }

    // SA produced SDD → UX creates wireframes
    if (completedAgent === 'SA') {
      const hasSddOutput = actions.some(
        (a) => (a.type === 'create_document' || a.type === 'update_document') &&
               (a.data?.type === 'SDD' || a.data?.type === 'sdd')
      );
      if (hasSddOutput) {
        return {
          agent: 'UX',
          context: (p) => `[PIPELINE] The System Design Document (SDD) is ready. Please create wireframes and a design system for the application. Read the BRD and SDD from your context to understand the features and architecture. Produce wireframes for all key screens.\n\nSA summary:\n${p.message}`,
        };
      }
    }

    // UX produced wireframes → PM creates task cards
    if (completedAgent === 'UX') {
      const hasWireframes = artifacts.some(
        (a) => a.name.includes('wireframe') || a.name.includes('design') || a.name.includes('mockup')
      );
      if (hasWireframes || artifacts.length > 0) {
        return {
          agent: 'PM',
          context: (p) => `[PIPELINE] Wireframes and design system are complete. Please break down the project into task cards on the work board. Read the BRD, SDD, and wireframes from your context. Create TASK cards for each feature module using [ACTION:create_card] — include clear titles, descriptions, and priority levels.\n\nUX summary:\n${p.message}`,
        };
      }
    }

    // PM created cards → DO scaffolds the project
    if (completedAgent === 'PM') {
      const hasCardCreation = actions.some((a) => a.type === 'create_card');
      if (hasCardCreation) {
        return {
          agent: 'DO',
          context: (p) => `[PIPELINE] Task cards have been created on the work board. Please scaffold the project structure. Read the SDD from your context to understand the tech stack. Generate the project boilerplate: package.json, tsconfig.json, framework configuration, directory structure, Dockerfile, .gitignore, and entry point files using [ARTIFACT] markers.\n\nPM summary:\n${p.message}`,
        };
      }
    }

    // DO scaffolded → TL assigns tasks and starts dev
    if (completedAgent === 'DO') {
      const hasScaffold = artifacts.some(
        (a) => a.name === 'package.json' || a.name.includes('tsconfig') ||
               a.name.includes('Dockerfile') || a.name.includes('.gitignore')
      );
      if (hasScaffold) {
        return {
          agent: 'TL',
          context: (p) => `[PIPELINE] Project scaffold is ready (${artifacts.length} files generated). Please review the task cards on the board and coordinate development. Assign tasks to Junior Developer (JD) and Senior Developer (SD) based on complexity. Then start the first task by delegating to the appropriate developer.\n\nDO summary:\n${p.message}`,
        };
      }
    }

    // TL assigned tasks → JD starts first task
    if (completedAgent === 'TL') {
      // TL either explicitly delegates (handled by delegation handler) or
      // creates/updates cards with assignments. If no delegation, trigger JD.
      const hasAssignment = actions.some(
        (a) => a.type === 'update_card' || a.type === 'create_card'
      );
      if (hasAssignment && !parsed.delegateTo) {
        return {
          agent: 'JD',
          context: (p) => `[PIPELINE] The Tech Lead has assigned tasks. Please start working on your first assigned task from the board. Read the task cards, BRD, SDD, and existing code artifacts from your context. Write the implementation code using [ARTIFACT] markers for each file.\n\nTL summary:\n${p.message}`,
        };
      }
    }

    // ── Downstream auto-chain rules (existing) ──

    // After Junior/Senior Dev completes code → QA writes tests
    if ((completedAgent === 'JD' || completedAgent === 'SD') && hasCodeArtifacts) {
      return {
        agent: 'QA',
        context: (p) => `[PIPELINE] The developer has completed their task and delivered ${p.artifacts?.length ?? 0} code file(s). Please review the code quality and write tests for the implemented features.\n\nDeveloper's summary:\n${p.message}`,
      };
    }

    // After QA completes tests → Security audit
    if (completedAgent === 'QA' && hasTestArtifacts) {
      return {
        agent: 'SEC',
        context: (p) => `[PIPELINE] QA has completed testing. Please perform a security review of the implemented code.\n\nQA summary:\n${p.message}`,
      };
    }

    // After Security completes → PM summary
    if (completedAgent === 'SEC') {
      return {
        agent: 'PM',
        context: (p) => `[PIPELINE] The security review is complete. Please provide the stakeholder with a progress summary.\n\nSecurity review:\n${p.message}`,
      };
    }

    return null;
  }

  private getAgentName(shortName: string): string {
    try {
      return getAgentDefinition(shortName).name;
    } catch {
      return shortName;
    }
  }
}

// ---------------------------------------------------------------------------
// Singleton Export
// ---------------------------------------------------------------------------

export const orchestrationEngine = new OrchestrationEngine();

// Register event handlers for persistence
import './event-handlers';

// =============================================================================
// STANDALONE EXPORTED FUNCTIONS
// =============================================================================
// These are extracted from the OrchestrationEngine class so that both the legacy
// engine and the new LangGraph-based graph can share them without duplication.
// =============================================================================

/**
 * Save the user's message to the ChatMessage table.
 */
export async function saveUserMessage(
  projectId: string,
  content: string,
  cardId?: string,
): Promise<{ id: string }> {
  return prisma.chatMessage.create({
    data: {
      role: 'USER',
      content,
      projectId,
      cardId: cardId ?? null,
    },
    select: { id: true },
  });
}

/**
 * Save an agent's response to the ChatMessage table.
 * Resolves the agent's DB record to link via agentId.
 */
export async function saveAgentMessage(
  projectId: string,
  shortName: string,
  content: string,
  thinking?: string,
  artifacts?: Array<{ name: string; type: string }>,
): Promise<{ id: string }> {
  const agentRecord = await prisma.agent.findFirst({
    where: { projectId, shortName },
    select: { id: true },
  });

  return prisma.chatMessage.create({
    data: {
      role: 'AGENT',
      content,
      thinking: thinking ?? null,
      agentId: agentRecord?.id ?? null,
      projectId,
      artifacts: artifacts && artifacts.length > 0
        ? JSON.stringify(artifacts.map(a => ({ name: a.name, type: a.type })))
        : null,
    },
    select: { id: true },
  });
}

/**
 * Persist a code/document artifact with smart routing based on category.
 * - CODE, CONFIG, TEST → prisma.artifact.create()
 * - DOCUMENT → prisma.document.create() (legacy behavior)
 * Small artifacts (< 20 chars) are skipped.
 */
export async function persistArtifact(
  artifact: { name: string; type: string; content: string },
  projectId: string,
  agentShortName: string,
  messageId?: string,
): Promise<void> {
  if (!artifact.content || artifact.content.length < 20) return;

  const category = inferArtifactCategory(artifact.type, artifact.name, agentShortName);

  try {
    // Find active card for this agent (branch context)
    let cardId: string | null = null;
    let branchId: string | null = null;
    try {
      const activeCard = await prisma.card.findFirst({
        where: {
          projectId,
          ownerAgent: { shortName: agentShortName },
          state: 'IN_PROGRESS',
          gitBranchId: { not: null },
        },
        select: { id: true, gitBranchId: true },
        orderBy: { updatedAt: 'desc' },
      });
      if (activeCard) {
        cardId = activeCard.id;
        branchId = activeCard.gitBranchId;
      }
    } catch {
      // Non-fatal: artifact created without card link if lookup fails
    }

    // .pen wireframe files → save to wireframes table with penData
    if (artifact.name.endsWith('.pen')) {
      let penData: any = null;
      try {
        penData = JSON.parse(artifact.content);
      } catch {
        // If not valid JSON, store as content string
      }
      const screenName = artifact.name.replace(/^wireframe-/, '').replace(/\.pen$/, '');
      await prisma.wireframe.create({
        data: {
          title: screenName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          screen: screenName,
          content: artifact.content,
          penData,
          owner: agentShortName,
          components: penData?.children?.[0]?.children?.length ?? 0,
          projectId,
        },
      });
      return;
    }

    if (category === 'DOCUMENT') {
      const docType = inferDocumentType(artifact.type, artifact.name);
      const wordCount = artifact.content.split(/\s+/).filter(Boolean).length;

      await prisma.document.create({
        data: {
          title: artifact.name,
          type: docType,
          content: artifact.content,
          wordCount,
          owner: agentShortName,
          projectId,
        },
      });
    } else {
      await prisma.artifact.create({
        data: {
          name: artifact.name,
          type: category as 'CODE' | 'CONFIG' | 'TEST',
          content: artifact.content,
          ownerAgent: agentShortName,
          projectId,
          messageId: messageId ?? null,
          cardId,
        },
      });

      // Record commit on the card's branch
      if (branchId) {
        try {
          const { recordCommit } = await import('@/lib/git/repo-manager');
          await recordCommit(
            branchId,
            projectId,
            `Add ${artifact.name} (${category.toLowerCase()})`,
            agentShortName,
          );
        } catch {
          // Non-fatal: commit recording failure doesn't block artifact persistence
        }
      }
    }
  } catch (err) {
    console.error(
      `[persistArtifact] Failed to persist "${artifact.name}" (${category}):`,
      err,
    );
  }
}

/**
 * Execute all side effects from parsed agent actions.
 * Each action type maps to a specific Prisma operation.
 * Errors in individual actions are logged but do not block other actions.
 */
export async function executeSideEffects(
  actions: AgentAction[],
  projectId: string,
  userId: string,
  agentDbId?: string | null,
): Promise<void> {
  for (const action of actions) {
    try {
      switch (action.type) {
        case 'create_card': {
          const cardType = mapCardType(action.data.type);
          const priority = mapPriority(action.data.priority);
          await prisma.card.create({
            data: {
              title: action.data.title,
              description: action.data.description ?? '',
              type: cardType,
              priority,
              projectId,
              ownerAgentId: agentDbId ?? undefined,
              parentId: action.data.parentId ?? undefined,
              module: action.data.module ?? null,
            },
          });

          await eventBus.emit({
            type: 'action.executed',
            actor: 'system',
            projectId,
            payload: {
              actionType: 'create_card',
              title: action.data.title,
            },
          });
          break;
        }

        case 'update_card': {
          const updateData: Record<string, unknown> = {};
          if (action.data.state) {
            const newState = mapCardState(action.data.state);

            // DoD validation: check if state transition is allowed
            const existingCard = await prisma.card.findUnique({
              where: { id: action.cardId },
              select: { state: true, type: true },
            });
            if (existingCard) {
              const transitionResult = await validateCardTransition(
                action.cardId,
                projectId,
                existingCard.state as LifecycleCardState,
                newState as LifecycleCardState,
                existingCard.type as LifecycleCardType,
              );
              if (!transitionResult.allowed) {
                console.warn(
                  `[Engine] DoD blocked card ${action.cardId}: ${transitionResult.reason}`,
                  transitionResult.requirements,
                );
                // Skip this state change but continue processing other fields
              } else {
                updateData.state = newState;
              }
            } else {
              updateData.state = newState;
            }
          }
          if (action.data.title) {
            updateData.title = action.data.title;
          }
          if (action.data.priority) {
            updateData.priority = mapPriority(action.data.priority);
          }

          if (Object.keys(updateData).length > 0) {
            await prisma.card.update({
              where: { id: action.cardId },
              data: updateData,
            });
          }

          await eventBus.emit({
            type: 'action.executed',
            actor: 'system',
            projectId,
            payload: {
              actionType: 'update_card',
              cardId: action.cardId,
              changes: updateData,
            },
          });
          break;
        }

        case 'create_decision': {
          const riskRating = mapRiskRating(action.data.riskRating);
          await prisma.decision.create({
            data: {
              trigger: action.data.trigger,
              context: action.data.context ?? '',
              riskRating,
              recommendation: action.data.recommendation ?? '',
              ownerId: userId,
              projectId,
              options: action.data.options?.length
                ? {
                    create: action.data.options.map((opt) => ({
                      name: opt.name,
                      description: opt.description ?? '',
                      pros: opt.pros ?? [],
                      cons: opt.cons ?? [],
                      risk: mapRiskRating(opt.risk),
                      effort: mapEffort(opt.effort),
                    })),
                  }
                : undefined,
            },
          });

          await eventBus.emit({
            type: 'action.executed',
            actor: 'system',
            projectId,
            payload: {
              actionType: 'create_decision',
              trigger: action.data.trigger,
            },
          });
          break;
        }

        case 'create_document': {
          const docType = mapDocumentType(action.data.type);
          const wordCount = action.data.content
            ? action.data.content.split(/\s+/).filter(Boolean).length
            : 0;
          await prisma.document.create({
            data: {
              title: action.data.title,
              type: docType,
              content: action.data.content ?? '',
              wordCount,
              owner: action.data.owner ?? 'AI Team',
              projectId,
            },
          });

          await eventBus.emit({
            type: 'action.executed',
            actor: 'system',
            projectId,
            payload: {
              actionType: 'create_document',
              title: action.data.title,
            },
          });
          break;
        }

        case 'update_document': {
          const updateDocType = mapDocumentType(action.data.type);
          const existingDoc = await prisma.document.findFirst({
            where: { projectId, type: updateDocType, status: 'DRAFT' },
            orderBy: { createdAt: 'desc' },
          });

          if (existingDoc) {
            const mode = action.data.mode ?? 'append';
            const newContent = mode === 'append'
              ? existingDoc.content + '\n\n' + action.data.content
              : action.data.content;
            await prisma.document.update({
              where: { id: existingDoc.id },
              data: {
                content: newContent,
                wordCount: newContent.split(/\s+/).filter(Boolean).length,
              },
            });
            console.log(
              `[Engine] 📝 Updated staging ${action.data.type} (${mode}) — ${newContent.split(/\s+/).filter(Boolean).length} words`,
            );
          } else {
            const content = action.data.content;
            await prisma.document.create({
              data: {
                title: `Staging: ${action.data.type} Requirements`,
                type: updateDocType,
                content,
                wordCount: content.split(/\s+/).filter(Boolean).length,
                owner: 'BA',
                projectId,
              },
            });
            console.log(
              `[Engine] 📝 Created staging ${action.data.type} document`,
            );
          }

          await eventBus.emit({
            type: 'action.executed',
            actor: 'system',
            projectId,
            payload: {
              actionType: 'update_document',
              docType: action.data.type,
              mode: action.data.mode ?? 'append',
            },
          });
          break;
        }

        case 'approve_document': {
          const approveDocType = mapDocumentType(action.data.type);
          const updated = await prisma.document.updateMany({
            where: {
              projectId,
              type: approveDocType,
              status: { not: 'APPROVED' },
            },
            data: { status: 'APPROVED' },
          });

          console.log(
            `[Engine] ✅ Approved ${updated.count} ${action.data.type} document(s) for project ${projectId}`,
          );

          await eventBus.emit({
            type: 'action.executed',
            actor: 'system',
            projectId,
            payload: {
              actionType: 'approve_document',
              docType: action.data.type,
              count: updated.count,
            },
          });
          break;
        }

        case 'advance_sdlc': {
          // ── Quality Gate Check ──────────────────────────────────────
          const gateResult = await validateStageGate(projectId, action.stageName);
          if (!gateResult.passed) {
            console.warn(
              `[Engine] ⛔ advance_sdlc BLOCKED for "${action.stageName}": ${gateResult.reason}`,
            );
            await eventBus.emit({
              type: 'action.executed',
              actor: 'system',
              projectId,
              payload: {
                actionType: 'advance_sdlc_blocked',
                stageName: action.stageName,
                reason: gateResult.reason,
                blockedBy: gateResult.blockedBy,
              },
            });
            break;
          }

          const stages = await prisma.sDLCStage.findMany({
            where: { projectId },
            orderBy: { order: 'asc' },
          });

          const targetStage = stages.find(
            (s) => s.name.toLowerCase() === action.stageName.toLowerCase(),
          );

          if (targetStage) {
            const stagesToComplete = stages.filter(
              (s) => s.order <= targetStage.order && s.status !== 'COMPLETED',
            );
            for (const stage of stagesToComplete) {
              await prisma.sDLCStage.update({
                where: { id: stage.id },
                data: { status: 'COMPLETED', gatePassed: true },
              });
            }

            const nextStage = stages.find((s) => s.order === targetStage.order + 1);
            if (nextStage) {
              await prisma.sDLCStage.update({
                where: { id: nextStage.id },
                data: { status: 'ACTIVE' },
              });

              await prisma.project.update({
                where: { id: projectId },
                data: { currentStage: nextStage.name },
              });
            }
          }

          await eventBus.emit({
            type: 'action.executed',
            actor: 'system',
            projectId,
            payload: {
              actionType: 'advance_sdlc',
              stageName: action.stageName,
            },
          });
          break;
        }

        case 'update_agent_status': {
          const validStatuses = ['IDLE', 'WORKING', 'WAITING', 'BLOCKED'] as const;
          const status = validStatuses.find(
            (s) => s === action.status.toUpperCase(),
          );

          if (status) {
            await agentStateManager.setStatus(
              projectId,
              action.agentId,
              status,
              action.task ?? null,
            );
          }
          break;
        }

        case 'delegate': {
          // Delegation is handled at the orchestration level, not as a side effect.
          break;
        }

        case 'create_branch': {
          const branchData = action.data as { name: string; baseBranch?: string };
          await prisma.gitBranch.create({
            data: {
              name: branchData.name,
              status: 'ACTIVE',
              author: 'AI Agent',
              projectId,
            },
          });
          // Also create on GitHub if configured
          try {
            const gitProject = await prisma.project.findUnique({
              where: { id: projectId },
              select: { gitTokenEncrypted: true, gitRepoOwner: true, gitRepoName: true, gitDefaultBranch: true },
            });
            if (gitProject?.gitTokenEncrypted && gitProject.gitRepoOwner && gitProject.gitRepoName) {
              const { createGitHubClient, getRef, createBranchRef } = await import('@/lib/git/github-client');
              const ghClient = createGitHubClient(gitProject.gitTokenEncrypted);
              const baseBranch = branchData.baseBranch ?? gitProject.gitDefaultBranch ?? 'main';
              const baseSha = await getRef(ghClient, gitProject.gitRepoOwner, gitProject.gitRepoName, baseBranch);
              await createBranchRef(ghClient, gitProject.gitRepoOwner, gitProject.gitRepoName, branchData.name, baseSha);
            }
          } catch (ghErr) {
            console.warn(`[Engine] GitHub branch creation failed (DB record saved):`, ghErr);
          }
          break;
        }

        case 'create_pr': {
          const prData = action.data as { title: string; branch: string; description?: string };
          const maxPr = await prisma.gitPullRequest.findFirst({
            where: { projectId },
            orderBy: { number: 'desc' },
            select: { number: true },
          });
          const nextNumber = (maxPr?.number ?? 0) + 1;
          let ghPrNumber = nextNumber;
          try {
            const gitProject = await prisma.project.findUnique({
              where: { id: projectId },
              select: { gitTokenEncrypted: true, gitRepoOwner: true, gitRepoName: true, gitDefaultBranch: true },
            });
            if (gitProject?.gitTokenEncrypted && gitProject.gitRepoOwner && gitProject.gitRepoName) {
              const { createGitHubClient, createPullRequest: ghCreatePR } = await import('@/lib/git/github-client');
              const ghClient = createGitHubClient(gitProject.gitTokenEncrypted);
              const baseBranch = gitProject.gitDefaultBranch ?? 'main';
              const prResult = await ghCreatePR(
                ghClient, gitProject.gitRepoOwner, gitProject.gitRepoName,
                prData.title, prData.description ?? '', prData.branch, baseBranch,
              );
              ghPrNumber = prResult.number;
            }
          } catch (ghErr) {
            console.warn(`[Engine] GitHub PR creation failed (saving to DB only):`, ghErr);
          }
          await prisma.gitPullRequest.create({
            data: {
              number: ghPrNumber,
              title: prData.title,
              branch: prData.branch,
              status: 'OPEN',
              author: 'AI Agent',
              projectId,
            },
          });
          break;
        }

        case 'create_release': {
          const releaseData = action.data as { version: string; features?: string[] };
          await prisma.gitRelease.create({
            data: {
              version: releaseData.version,
              status: 'DRAFT',
              features: releaseData.features ?? [],
              projectId,
            },
          });
          break;
        }

        case 'create_repo': {
          const repoData = action.data as { name: string; description?: string; isPrivate?: boolean };
          try {
            const gitProject = await prisma.project.findUnique({
              where: { id: projectId },
              select: { gitTokenEncrypted: true, gitRepoOwner: true, gitRepoName: true },
            });
            if (gitProject?.gitRepoOwner && gitProject?.gitRepoName) {
              console.log(`[Engine] Repo already configured, skipping create_repo`);
            } else if (gitProject?.gitTokenEncrypted) {
              const { createGitHubClient, createRepository } = await import('@/lib/git/github-client');
              const { initializeRepo } = await import('@/lib/git/repo-manager');
              const ghClient = createGitHubClient(gitProject.gitTokenEncrypted);
              const repo = await createRepository(ghClient, {
                name: repoData.name,
                description: repoData.description,
                isPrivate: repoData.isPrivate ?? true,
                autoInit: true,
              });
              await prisma.project.update({
                where: { id: projectId },
                data: {
                  gitProvider: 'github',
                  gitRepoOwner: repo.owner,
                  gitRepoName: repo.name,
                  gitDefaultBranch: repo.defaultBranch,
                  gitSyncEnabled: true,
                },
              });
              await initializeRepo(projectId);
              console.log(`[Engine] Created GitHub repo: ${repo.fullName}`);
            }
          } catch (ghErr) {
            console.warn(`[Engine] GitHub repo creation failed:`, ghErr);
          }
          break;
        }

        case 'trigger_deploy': {
          const deployData = action.data as { pipelineName?: string; environment?: string; branch?: string };
          const pipeline = await prisma.deploymentPipeline.findFirst({
            where: {
              projectId,
              ...(deployData.pipelineName ? { name: deployData.pipelineName } : {}),
            },
          });
          if (pipeline) {
            await prisma.deploymentRun.create({
              data: {
                pipelineId: pipeline.id,
                status: 'PENDING',
                currentStage: 'BUILD',
                triggeredBy: agentDbId ?? 'system',
                branch: deployData.branch ?? 'main',
                projectId,
              },
            });
          }
          break;
        }

        case 'create_pipeline': {
          const pipelineData = action.data as { name: string; environment: string; trigger: string; config?: string };
          await prisma.deploymentPipeline.create({
            data: {
              name: pipelineData.name,
              environment: (pipelineData.environment?.toUpperCase() ?? 'STAGING') as any,
              trigger: (pipelineData.trigger?.toUpperCase() ?? 'MANUAL') as any,
              config: pipelineData.config ?? '{}',
              projectId,
            },
          });
          break;
        }

        case 'remember': {
          const memoryData = action.data as { category: string; content: string };
          await prisma.projectMemory.create({
            data: {
              projectId,
              category: memoryData.category,
              content: memoryData.content,
              source: `agent:${agentDbId ?? 'system'}`,
            },
          });
          console.log(`[executeSideEffects] Saved memory: [${memoryData.category}] ${memoryData.content.slice(0, 80)}`);
          break;
        }

        case 'run_code': {
          const runData = action.data as { language: string; code: string; stdin?: string; artifactName?: string };

          // Find linked artifact if artifactName was provided
          let artifactId: string | null = null;
          if (runData.artifactName) {
            const artifact = await prisma.artifact.findFirst({
              where: { projectId, name: runData.artifactName },
              orderBy: { version: 'desc' },
              select: { id: true },
            });
            artifactId = artifact?.id ?? null;
          }

          // Create CodeExecution record
          const execution = await prisma.codeExecution.create({
            data: {
              language: runData.language,
              code: runData.code,
              stdin: runData.stdin ?? '',
              artifactId,
              triggeredBy: agentDbId ?? 'agent',
              projectId,
            },
          });

          // Enqueue execution job
          const { addCodeExecutionJob } = await import('@/lib/queue/code-execution-queue');
          await addCodeExecutionJob({
            executionId: execution.id,
            projectId,
          });

          console.log(`[executeSideEffects] Queued code execution ${execution.id}: ${runData.language}`);

          await eventBus.emit({
            type: 'action.executed',
            actor: 'system',
            projectId,
            payload: {
              actionType: 'run_code',
              executionId: execution.id,
              language: runData.language,
            },
          });
          break;
        }

        default: {
          const _exhaustive: never = action;
          console.warn(
            '[executeSideEffects] Unhandled action type:',
            (_exhaustive as AgentAction).type,
          );
        }
      }
    } catch (err) {
      console.error(
        `[executeSideEffects] Side effect "${action.type}" failed:`,
        err,
      );
    }
  }
}

// =============================================================================
// STANDALONE ENUM MAPPERS
// =============================================================================

export function mapCardType(
  type?: string,
): 'EPIC' | 'FEATURE' | 'TASK' | 'QA' | 'DECISION_BLOCKER' {
  const map: Record<string, 'EPIC' | 'FEATURE' | 'TASK' | 'QA' | 'DECISION_BLOCKER'> = {
    EPIC: 'EPIC', FEATURE: 'FEATURE', TASK: 'TASK', QA: 'QA', DECISION_BLOCKER: 'DECISION_BLOCKER',
    epic: 'EPIC', feature: 'FEATURE', task: 'TASK', qa: 'QA', decision_blocker: 'DECISION_BLOCKER',
  };
  return map[type ?? ''] ?? 'TASK';
}

export function mapCardState(
  state: string,
): 'PLANNED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'TESTING' | 'BLOCKED' | 'DONE' | 'RELEASED' {
  const map: Record<string, 'PLANNED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'TESTING' | 'BLOCKED' | 'DONE' | 'RELEASED'> = {
    PLANNED: 'PLANNED', IN_PROGRESS: 'IN_PROGRESS', UNDER_REVIEW: 'UNDER_REVIEW',
    TESTING: 'TESTING', BLOCKED: 'BLOCKED', DONE: 'DONE', RELEASED: 'RELEASED',
    planned: 'PLANNED', in_progress: 'IN_PROGRESS', under_review: 'UNDER_REVIEW',
    testing: 'TESTING', blocked: 'BLOCKED', done: 'DONE', released: 'RELEASED',
  };
  return map[state] ?? 'PLANNED';
}

export function mapPriority(priority?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const map: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
    LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL',
    low: 'LOW', medium: 'MEDIUM', high: 'HIGH', critical: 'CRITICAL',
  };
  return map[priority ?? ''] ?? 'MEDIUM';
}

export function mapRiskRating(rating?: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const map: Record<string, 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'> = {
    LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH', CRITICAL: 'CRITICAL',
    low: 'LOW', medium: 'MEDIUM', high: 'HIGH', critical: 'CRITICAL',
  };
  return map[rating ?? ''] ?? 'MEDIUM';
}

export function mapEffort(effort?: string): 'LOW' | 'MEDIUM' | 'HIGH' {
  const map: Record<string, 'LOW' | 'MEDIUM' | 'HIGH'> = {
    LOW: 'LOW', MEDIUM: 'MEDIUM', HIGH: 'HIGH',
    low: 'LOW', medium: 'MEDIUM', high: 'HIGH',
  };
  return map[effort ?? ''] ?? 'MEDIUM';
}

export function mapDocumentType(
  type: string,
): 'BRD' | 'SDD' | 'API_SPEC' | 'RUNBOOK' | 'ADR' {
  const map: Record<string, 'BRD' | 'SDD' | 'API_SPEC' | 'RUNBOOK' | 'ADR'> = {
    BRD: 'BRD', SDD: 'SDD', API_SPEC: 'API_SPEC', RUNBOOK: 'RUNBOOK', ADR: 'ADR',
    brd: 'BRD', sdd: 'SDD', api_spec: 'API_SPEC', runbook: 'RUNBOOK', adr: 'ADR',
  };
  return map[type] ?? 'BRD';
}

export function inferArtifactCategory(
  artifactType: string,
  artifactName: string,
  agentShortName: string,
): 'CODE' | 'CONFIG' | 'TEST' | 'DOCUMENT' {
  const lower = artifactType.toLowerCase();
  const nameLower = artifactName.toLowerCase();

  if (['QA', 'AT'].includes(agentShortName) ||
      nameLower.includes('test') || nameLower.includes('spec') || nameLower.includes('e2e')) {
    return 'TEST';
  }

  const configTypes = ['json', 'yaml', 'toml', 'env', 'dockerfile', 'terraform', 'prisma', 'graphql', 'protobuf', 'xml'];
  if (configTypes.some(t => lower.includes(t))) return 'CONFIG';

  const docAgents = ['BA', 'PM', 'SA', 'DEC', 'AUD'];
  if ((lower.includes('markdown') || lower === 'text') && docAgents.includes(agentShortName)) {
    return 'DOCUMENT';
  }

  const codeTypes = ['typescript', 'javascript', 'python', 'java', 'go', 'rust', 'ruby', 'html', 'css', 'scss', 'shell', 'sql'];
  if (codeTypes.some(t => lower.includes(t))) return 'CODE';

  const ext = artifactName.split('.').pop()?.toLowerCase() ?? '';
  const codeExtensions = ['ts', 'tsx', 'js', 'jsx', 'py', 'java', 'go', 'rs', 'rb', 'sh', 'sql', 'html', 'css', 'scss'];
  if (codeExtensions.includes(ext)) return 'CODE';

  return 'DOCUMENT';
}

export function inferDocumentType(
  artifactType: string,
  artifactName?: string,
): 'BRD' | 'SDD' | 'API_SPEC' | 'RUNBOOK' | 'ADR' {
  const lower = artifactType.toLowerCase();
  const nameLower = (artifactName ?? '').toLowerCase();
  const combined = `${lower} ${nameLower}`;
  if (combined.includes('api') || combined.includes('openapi') || combined.includes('swagger')) {
    return 'API_SPEC';
  }
  if (combined.includes('architecture') || combined.includes('design') || combined.includes('sdd')) {
    return 'SDD';
  }
  if (combined.includes('runbook') || combined.includes('ops') || combined.includes('deploy')) {
    return 'RUNBOOK';
  }
  if (combined.includes('adr') || combined.includes('decision')) {
    return 'ADR';
  }
  return 'BRD';
}
