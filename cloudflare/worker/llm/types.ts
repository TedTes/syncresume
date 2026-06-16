import type { StructuredResume } from "../resume";

export type LLMProviderName = "openai" | "anthropic" | "gemini";

export type LLMEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
};

export type OptimizeInput = {
  jobDescription: string;
  resumeText: string;
};

export type ReviseSectionInput = {
  jobDescription: string;
  resume: StructuredResume;
  sectionLabel: string;
  sectionText: string;
  instruction: string;
};

export type LLMProvider = {
  optimize(env: LLMEnv, input: OptimizeInput): Promise<StructuredResume>;
  reviseSection(env: LLMEnv, input: ReviseSectionInput): Promise<string>;
};
