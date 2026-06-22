import {
  normalizeStructuredResume,
  resumeToPlainText,
  scoreKeywords,
  type StructuredResume,
} from "../resume";
import type { RunRecord } from "../storage";
import { cloudflareRequest, hasCloudflareConfig } from "../cloudflare/client";
import { getProviderInfo, type LLMProvider } from "./types";

function notImplemented(provider: LLMProvider): never {
  const info = getProviderInfo(provider);
  // TODO: wire up a real client for this provider (see lib/providers/types.ts).
  throw new Error(
    `${info.label} integration is coming soon. Switch to OpenAI in Settings to run live optimization.`,
  );
}

type OptimizeArgs = {
  provider: LLMProvider;
  jobDescription: string;
  resumeText: string;
  resumeId?: string;
  resumeName?: string;
  saveRunHistory?: boolean;
  title?: string;
};

type OptimizeEdgeResponse = {
  resume?: unknown;
  score?: number;
  run?: RunRecord | null;
};

export type OptimizeProviderResult = {
  resume: StructuredResume;
  score: number;
  run?: RunRecord;
  persisted: boolean;
};

export async function optimizeResumeWithProvider({
  provider,
  jobDescription,
  resumeText,
  resumeId,
  resumeName,
  saveRunHistory,
  title,
}: OptimizeArgs): Promise<OptimizeProviderResult> {
  if (provider !== "openai") {
    notImplemented(provider);
  }

  if (!hasCloudflareConfig()) {
    throw new Error("Cloudflare API is not configured. Set VITE_CLOUDFLARE_API_URL.");
  }

  const data = await cloudflareRequest<OptimizeEdgeResponse>("/api/optimize", {
    method: "POST",
    body: {
      provider,
      jobDescription,
      resumeId,
      resumeText,
      resumeName,
      saveRunHistory,
      title,
    },
  });
  const resume = normalizeStructuredResume(data.resume);
  const score =
    typeof data.score === "number"
      ? data.score
      : Math.round(scoreKeywords(jobDescription, resumeToPlainText(resume)).ratio * 100);

  return {
    resume,
    score,
    run: data.run ?? undefined,
    persisted: true,
  };
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

  if (!hasCloudflareConfig()) {
    throw new Error("Cloudflare API is not configured. Set VITE_CLOUDFLARE_API_URL.");
  }

  const data = await cloudflareRequest<{ revisedText?: string }>("/api/revise-section", {
    method: "POST",
    body: {
      provider,
      jobDescription,
      resume,
      sectionLabel,
      sectionText,
      instruction,
    },
  });

  if (!data.revisedText?.trim()) {
    throw new Error("The backend returned an empty revision.");
  }

  return data.revisedText.trim();
}

type CoverLetterArgs = {
  provider: LLMProvider;
  jobDescription: string;
  resumeText: string;
  jobTitle?: string;
};

export async function generateCoverLetterWithProvider({
  provider,
  jobDescription,
  resumeText,
  jobTitle,
}: CoverLetterArgs): Promise<string> {
  if (provider !== "openai") {
    notImplemented(provider);
  }

  if (!hasCloudflareConfig()) {
    throw new Error("Cloudflare API is not configured. Set VITE_CLOUDFLARE_API_URL.");
  }

  const data = await cloudflareRequest<{ coverLetter?: string }>("/api/generate-cover-letter", {
    method: "POST",
    body: {
      provider,
      jobDescription,
      resumeText,
      jobTitle,
    },
  });

  if (!data.coverLetter?.trim()) {
    throw new Error("The backend returned an empty cover letter.");
  }

  return data.coverLetter.trim();
}
