import { AgentDefinition } from './types';
import { allDefinitions } from './definitions';

const agentRegistry = new Map<string, AgentDefinition>();
allDefinitions.forEach(def => agentRegistry.set(def.shortName, def));

export function getAgentDefinition(shortName: string): AgentDefinition {
  const def = agentRegistry.get(shortName);
  if (!def) throw new Error(`Unknown agent: ${shortName}`);
  return def;
}

export function getAllAgentDefinitions(): AgentDefinition[] {
  return Array.from(agentRegistry.values());
}

export function getAgentsByGroup(group: AgentDefinition['group']): AgentDefinition[] {
  return getAllAgentDefinitions().filter(d => d.group === group);
}
