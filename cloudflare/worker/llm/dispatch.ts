import { openAIProvider } from "./providers/openai";
import type {
  CoverLetterInput,
  LLMEnv,
  LLMProvider,
  LLMProviderName,
  OptimizeInput,
  ReviseSectionInput,
} from "./types";

const providers: Partial<Record<LLMProviderName, LLMProvider>> = {
  openai: openAIProvider,
};

export function normalizeLLMProvider(value: string): LLMProviderName {
  if (value === "anthropic" || value === "gemini" || value === "openai") {
    return value;
  }
  return "openai";
}

export async function optimizeResumeWithProvider(
  env: LLMEnv,
  providerName: LLMProviderName,
  input: OptimizeInput,
) {
  return getProvider(providerName).optimize(env, input);
}

export async function reviseSectionWithProvider(
  env: LLMEnv,
  providerName: LLMProviderName,
  input: ReviseSectionInput,
) {
  return getProvider(providerName).reviseSection(env, input);
}

export async function generateCoverLetterWithProvider(
  env: LLMEnv,
  providerName: LLMProviderName,
  input: CoverLetterInput,
) {
  return getProvider(providerName).generateCoverLetter(env, input);
}

function getProvider(providerName: LLMProviderName): LLMProvider {
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`${providerName} integration is not wired on Cloudflare yet.`);
  }
  return provider;
}
