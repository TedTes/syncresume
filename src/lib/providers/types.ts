export type LLMProvider = "anthropic" | "openai" | "gemini";

export type ProviderInfo = {
  id: LLMProvider;
  label: string;
  model: string;
  /** Whether this provider has a live integration wired up yet. */
  enabled: boolean;
};

export const PROVIDERS: ProviderInfo[] = [
  { id: "openai", label: "OpenAI", model: "gpt-5.4-mini", enabled: true },
  { id: "anthropic", label: "Anthropic", model: "claude-sonnet-4-5", enabled: true },
  { id: "gemini", label: "Gemini", model: "gemini-2.5-flash", enabled: true },
];

export function getProviderInfo(id: LLMProvider): ProviderInfo {
  return PROVIDERS.find((provider) => provider.id === id) ?? PROVIDERS[0];
}
