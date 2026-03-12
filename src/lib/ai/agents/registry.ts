import { AgentDefinition } from './types';
import { allDefinitions } from './definitions';

const agentRegistry = new Map<string, AgentDefinition>();
allDefinitions.forEach(def => agentRegistry.set(def.shortName, def));

// Reverse lookup: full name variants → shortName
// LLMs sometimes use full names like "SOLUTION_ARCHITECT" instead of "SA"
const agentNameAliases = new Map<string, string>();
allDefinitions.forEach(def => {
  // "Solution Architect" → "SA"
  agentNameAliases.set(def.name.toUpperCase(), def.shortName);
  // "SOLUTION_ARCHITECT" → "SA" (underscore-joined)
  agentNameAliases.set(def.name.toUpperCase().replace(/[\s/&]+/g, '_'), def.shortName);
  // "SOLUTIONARCHITECT" → "SA" (no separators)
  agentNameAliases.set(def.name.toUpperCase().replace(/[\s/&]+/g, ''), def.shortName);
});

/**
 * Resolve an agent identifier to its short name.
 * Handles: "SA", "SOLUTION_ARCHITECT", "Solution Architect", etc.
 */
export function resolveAgentShortName(name: string): string {
  const upper = name.trim().toUpperCase();
  // Direct shortName match
  if (agentRegistry.has(upper)) return upper;
  if (agentRegistry.has(name.trim())) return name.trim();
  // Alias lookup
  const alias = agentNameAliases.get(upper);
  if (alias) return alias;
  // Fallback: return as-is (will throw in getAgentDefinition)
  return name.trim();
}

export function getAgentDefinition(shortName: string): AgentDefinition {
  const resolved = resolveAgentShortName(shortName);
  const def = agentRegistry.get(resolved);
  if (!def) throw new Error(`Unknown agent: ${shortName} (resolved: ${resolved})`);
  return def;
}

export function getAllAgentDefinitions(): AgentDefinition[] {
  return Array.from(agentRegistry.values());
}

export function getAgentsByGroup(group: AgentDefinition['group']): AgentDefinition[] {
  return getAllAgentDefinitions().filter(d => d.group === group);
}
