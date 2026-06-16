import { optimizeResume as openaiOptimizeResume, reviseResumeSection as openaiReviseSection } from "../aiResume";
import type { StructuredResume } from "../resume";
import { getProviderInfo, type LLMProvider } from "./types";

function notImplemented(provider: LLMProvider): never {
  const info = getProviderInfo(provider);
  // TODO: wire up a real client for this provider (see lib/providers/types.ts).
  throw new Error(
    `${info.label} integration is coming soon. Switch to OpenAI in Settings to run live optimization.`,
  );
}

type OptimizeArgs = { provider: LLMProvider; jobDescription: string; resumeText: string };

export async function optimizeResumeWithProvider({
  provider,
  jobDescription,
  resumeText,
}: OptimizeArgs): Promise<StructuredResume> {
  if (provider !== "openai") {
    notImplemented(provider);
  }
  return openaiOptimizeResume({ jobDescription, resumeText });
}

type ReviseArgs = {
  provider: LLMProvider;
  jobDescription: string;
  resume: StructuredResume;
  sectionLabel: string;
  sectionText: string;
  instruction: string;
};

export async function reviseResumeSectionWithProvider({
  provider,
  jobDescription,
  resume,
  sectionLabel,
  sectionText,
  instruction,
}: ReviseArgs): Promise<string> {
  if (provider !== "openai") {
    notImplemented(provider);
  }
  return openaiReviseSection({ jobDescription, resume, sectionLabel, sectionText, instruction });
}
