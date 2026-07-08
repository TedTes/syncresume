import type { StructuredResume } from "../resume";

export type LLMProviderName = "openai" | "anthropic" | "gemini";

export type LLMEnv = {
  DEFAULT_LLM_PROVIDER?: string;
  LLM_PROVIDER?: string;
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

export type StructureResumeInput = {
  resumeName?: string;
  resumeText: string;
  strictPreservation?: boolean;
  minimumOutputCharacters?: number;
  retryReason?: string;
};

export type ReviseSectionInput = {
  jobDescription: string;
  resume: StructuredResume;
  sectionLabel: string;
  sectionText: string;
  instruction: string;
};

export type ReviseSectionResult =
  | {
      type: "revision";
      text: string;
    }
  | {
      type: "out_of_scope";
    };

export type CoverLetterInput = {
  jobDescription: string;
  resumeText: string;
  jobTitle?: string;
};

export type LLMProvider = {
  optimize(env: LLMEnv, input: OptimizeInput): Promise<StructuredResume>;
  structureResume(env: LLMEnv, input: StructureResumeInput): Promise<StructuredResume>;
  reviseSection(env: LLMEnv, input: ReviseSectionInput): Promise<ReviseSectionResult>;
  generateCoverLetter(env: LLMEnv, input: CoverLetterInput): Promise<string>;
};
