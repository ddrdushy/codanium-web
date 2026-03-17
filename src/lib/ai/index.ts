// =============================================================================
// AI Team Studio — Backend AI Module
// =============================================================================
// Central re-export for the entire AI orchestration system.
// Import from '@/lib/ai' to access any component.
// =============================================================================

// Provider types & mock
export * from './providers/types';
export { MockProvider } from './providers/mock-provider';

// LLM Gateway (BYOM router)
export { llmGateway, LLMGateway } from './gateway';

// Agent system
export * from './agents/types';
export { getAgentDefinition, getAllAgentDefinitions, getAgentsByGroup } from './agents/registry';
export { parseAgentResponse } from './agents/response-parser';

// Context builder
export { contextBuilder, ContextBuilder } from './context/context-builder';

// Orchestration engine (LangGraph-based)
export { saveUserMessage, saveAgentMessage, persistArtifact } from './orchestration/engine';
export { messageRouter } from './orchestration/router';
export { agentStateManager } from './orchestration/state-manager';
export { eventBus } from './orchestration/event-bus';
export { buildOrchestrationGraph } from './orchestration/graph/build-graph';
export * from './orchestration/types';

// Tool system
export * from './tools';
