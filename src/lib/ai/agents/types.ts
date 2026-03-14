export interface AgentDefinition {
  shortName: string;           // Matches DB Agent.shortName
  name: string;                // Full display name
  systemPrompt: string;        // The agent's core persona and instructions
  group: 'GOVERNANCE' | 'SDLC' | 'ENGINEERING' | 'PLATFORM' | 'AI_COST';
  capabilities: AgentCapability[];
  contextSources: ContextSource[];
  outputTypes: OutputType[];
  authority: {
    canWrite: string[];
    canRead: string[];
    canNever: string[];
  };
  temperature: number;         // Default temperature for this agent
  maxHistory?: number;         // Max chat history messages (default: 10)
}

export type AgentCapability =
  | 'route_tasks' | 'validate_state' | 'manage_decisions' | 'audit_quality' | 'security_scan'
  | 'gather_requirements' | 'design_architecture' | 'design_ui' | 'manage_scope' | 'technical_authority'
  | 'implement_code' | 'review_code' | 'test_functionality' | 'automate_tests' | 'perf_test'
  | 'manage_platform' | 'manage_cicd' | 'manage_integrations' | 'manage_secrets' | 'monitor_reliability'
  | 'manage_llm_routing' | 'engineer_prompts' | 'analyze_costs';

export type ContextSource =
  | 'project_info' | 'sdlc_stages' | 'cards' | 'decisions' | 'documents'
  | 'chat_history' | 'agents_status' | 'llm_usage' | 'wireframes'
  | 'artifacts' | 'project_memory';

export type OutputType =
  | 'message' | 'document' | 'card' | 'decision' | 'state_change'
  | 'agent_assignment' | 'code_artifact' | 'wireframe';

export type AgentAction =
  | { type: 'create_card'; data: { title: string; description?: string; type?: string; priority?: string; parentId?: string; module?: string } }
  | { type: 'update_card'; cardId: string; data: { state?: string; title?: string; priority?: string } }
  | { type: 'create_decision'; data: { trigger: string; context?: string; riskRating?: string; recommendation?: string; options?: Array<{ name: string; description?: string; pros?: string[]; cons?: string[]; risk?: string; effort?: string }> } }
  | { type: 'update_agent_status'; agentId: string; status: string; task?: string }
  | { type: 'create_document'; data: { title: string; type: string; content: string; owner?: string } }
  | { type: 'approve_document'; data: { type: string } }
  | { type: 'update_document'; data: { type: string; content: string; mode?: 'append' | 'replace' } }
  | { type: 'advance_sdlc'; stageName: string }
  | { type: 'delegate'; targetAgent: string; context: string }
  | { type: 'create_branch'; data: { name: string; baseBranch?: string } }
  | { type: 'create_pr'; data: { title: string; branch: string; description?: string } }
  | { type: 'create_release'; data: { version: string; features?: string[] } }
  | { type: 'trigger_deploy'; data: { pipelineName?: string; environment?: string; branch?: string } }
  | { type: 'create_pipeline'; data: { name: string; environment: string; trigger: string; config?: string } }
  | { type: 'remember'; data: { category: string; content: string } }
  | { type: 'run_code'; data: { language: string; code: string; stdin?: string; artifactName?: string } }
  | { type: 'create_repo'; data: { name: string; description?: string; isPrivate?: boolean } };

export interface AgentExecutionResult {
  message: string;
  thinking?: string;
  agentShortName: string;
  artifacts?: Array<{ name: string; type: string; content?: string }>;
  actions?: AgentAction[];
  delegateTo?: string;
}
