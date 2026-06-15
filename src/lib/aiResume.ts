import { createStructuredResumeResponse } from "./openai";
import type { StructuredResume } from "./resume";

type OptimizeResumeOptions = {
  apiKey: string;
  jobDescription: string;
  resumeText: string;
};

export async function optimizeResume({
  apiKey,
  jobDescription,
  resumeText,
}: OptimizeResumeOptions): Promise<StructuredResume> {
  return createStructuredResumeResponse({
    apiKey,
    instructions: [
      "You are an expert resume optimizer for ATS-friendly resumes.",
      "Rewrite the resume to match the job description language while preserving truthfulness.",
      "Adjust the summary, rewrite bullets, inject matching keywords, and reorder skills by relevance.",
      "Do not fabricate employers, titles, dates, degrees, certifications, tools, metrics, responsibilities, or achievements.",
      "If a detail is not present in the original resume, do not add it.",
      "Return only the requested structured JSON object.",
    ].join(" "),
    input: [
      "JOB DESCRIPTION:",
      jobDescription.trim(),
      "",
      "ORIGINAL RESUME:",
      resumeText.trim(),
      "",
      "Required output notes:",
      "- Preserve the candidate's real experience and education.",
      "- Convert experience into roles with stable ids role-1, role-2, etc.",
      "- Use concise, impact-oriented bullets without inventing metrics.",
      "- Keep the resume ATS-safe and single-column friendly.",
    ].join("\n"),
    maxOutputTokens: 7000,
    timeoutMs: 90000,
  });
}
