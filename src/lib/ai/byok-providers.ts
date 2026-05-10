// =============================================================================
// BYOK provider catalog — single source of truth for the user-facing list of
// LLM providers + their suggested default models. Used by the onboarding
// wizard and the platform-settings drawer so the two stay in sync.
//
// `apiKeyOptional` providers (Ollama) work with a base URL only and don't
// require a key. Self-hosted endpoints can be reached through any of the
// OpenAI-compatible providers by overriding the base URL at runtime.
// =============================================================================

export interface BYOKProvider {
  /** Provider id stored in DB and matched by the gateway. */
  id: string;
  /** Display name shown in the UI. */
  label: string;
  /** Default models offered in the dropdown. Users can override later. */
  models: readonly string[];
  /** Where users can find their API key. */
  keyDocsUrl?: string;
  /** Whether the API key field is optional (e.g. local Ollama). */
  apiKeyOptional?: boolean;
  /** Default base URL pre-filled for the user (mostly for Ollama). */
  defaultBaseUrl?: string;
}

export const BYOK_PROVIDERS: readonly BYOKProvider[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
    keyDocsUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    label: 'Anthropic',
    models: ['claude-opus-4-6', 'claude-sonnet-4-6', 'claude-haiku-4-5-20251001'],
    keyDocsUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    models: ['llama3', 'mistral', 'gemma2', 'phi3', 'qwen2.5-coder'],
    apiKeyOptional: true,
    defaultBaseUrl: 'http://localhost:11434',
  },
  {
    id: 'mistral',
    label: 'Mistral AI',
    models: ['mistral-large-latest', 'mistral-small-latest'],
    keyDocsUrl: 'https://console.mistral.ai/api-keys/',
  },
  {
    id: 'groq',
    label: 'Groq',
    models: ['llama-3.3-70b-versatile', 'mixtral-8x7b-32768'],
    keyDocsUrl: 'https://console.groq.com/keys',
  },
  {
    id: 'together',
    label: 'Together AI',
    models: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    keyDocsUrl: 'https://api.together.xyz/settings/api-keys',
  },
] as const;

export type BYOKProviderId = (typeof BYOK_PROVIDERS)[number]['id'];

export function getProvider(id: string): BYOKProvider | undefined {
  return BYOK_PROVIDERS.find(p => p.id === id);
}
