import { AgentDefinition } from '../types';
import { governanceAgents } from './governance';
import { sdlcAgents } from './sdlc';
import { engineeringAgents } from './engineering';
import { platformAgents } from './platform';
import { aiCostAgents } from './ai-cost';

export { governanceAgents } from './governance';
export { sdlcAgents } from './sdlc';
export { engineeringAgents } from './engineering';
export { platformAgents } from './platform';
export { aiCostAgents } from './ai-cost';

export const allDefinitions: AgentDefinition[] = [
  ...governanceAgents,
  ...sdlcAgents,
  ...engineeringAgents,
  ...platformAgents,
  ...aiCostAgents,
];
