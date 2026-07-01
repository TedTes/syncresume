import {
  normalizeStructuredResume,
  resumeToPlainText,
  scoreKeywords,
  type StructuredResume,
} from "../resume";
import type { RunRecord } from "../storage";
import { cloudflareRequest, hasCloudflareConfig } from "../cloudflare/client";
import type { LLMProvider } from "./types";

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

type StructureResumeArgs = {
  provider: LLMProvider;
  resumeText: string;
  resumeName?: string;
};

type StructureResumeEdgeResponse = {
  resume?: unknown;
  text?: string;
};

export type OptimizeProviderResult = {
  resume: StructuredResume;
  score: number;
  run?: RunRecord;
  persisted: boolean;
};

export type StructureResumeProviderResult = {
  resume: StructuredResume;
  text: string;
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

export async function structureResumeWithProvider({
  provider,
  resumeText,
  resumeName,
}: StructureResumeArgs): Promise<StructureResumeProviderResult> {
  if (!hasCloudflareConfig()) {
    throw new Error("Cloudflare API is not configured. Set VITE_CLOUDFLARE_API_URL.");
  }

  const data = await cloudflareRequest<StructureResumeEdgeResponse>("/api/resumes/structure", {
    method: "POST",
    body: {
      provider,
      resumeName,
      resumeText,
    },
  });
  const resume = normalizeStructuredResume(data.resume);
  const text = data.text?.trim() || resumeToPlainText(resume);

  if (!text) {
    throw new Error("The backend returned an empty structured resume.");
  }

  return { resume, text };
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
  runId?: string;
};

export async function generateCoverLetterWithProvider({
  provider,
  jobDescription,
  resumeText,
  jobTitle,
  runId,
}: CoverLetterArgs): Promise<string> {
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
      runId,
    },
  });

  if (!data.coverLetter?.trim()) {
    throw new Error("The backend returned an empty cover letter.");
  }

  return data.coverLetter.trim();
}
