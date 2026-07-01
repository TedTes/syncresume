import { openAIProvider } from "./providers/openai";
import { anthropicProvider } from "./providers/anthropic";
import { geminiProvider } from "./providers/gemini";
import type {
  CoverLetterInput,
  LLMEnv,
  LLMProvider,
  LLMProviderName,
  OptimizeInput,
  ReviseSectionInput,
  StructureResumeInput,
} from "./types";

const providers: Partial<Record<LLMProviderName, LLMProvider>> = {
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  openai: openAIProvider,
};

export function normalizeLLMProvider(value: string): LLMProviderName {
  if (value === "anthropic" || value === "gemini" || value === "openai") {
    return value;
  }
  return "openai";
}

export function resolveLLMProvider(env: LLMEnv, requestedValue: string): LLMProviderName {
  const requested = normalizeLLMProvider(requestedValue);
  if (isProviderAvailable(env, requested)) return requested;

  const configured = normalizeLLMProvider(env.DEFAULT_LLM_PROVIDER || env.LLM_PROVIDER || "");
  if (isProviderAvailable(env, configured)) return configured;

  if (isProviderAvailable(env, "openai")) return "openai";

  return providers[requested] ? requested : "openai";
}

export async function optimizeResumeWithProvider(
  env: LLMEnv,
  providerName: LLMProviderName,
  input: OptimizeInput,
) {
  return getProvider(providerName).optimize(env, input);
}

export async function structureResumeWithProvider(
  env: LLMEnv,
  providerName: LLMProviderName,
  input: StructureResumeInput,
) {
  return getProvider(providerName).structureResume(env, input);
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

function isProviderAvailable(env: LLMEnv, providerName: LLMProviderName): boolean {
  if (!providers[providerName]) return false;
  if (providerName === "openai") return Boolean(env.OPENAI_API_KEY);
  if (providerName === "anthropic") return Boolean(env.ANTHROPIC_API_KEY);
  if (providerName === "gemini") return Boolean(env.GEMINI_API_KEY);
  return false;
}
