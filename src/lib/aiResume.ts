import { createStructuredResumeResponse, createTextResponse } from "./openai";
import { resumeToPlainText, type StructuredResume } from "./resume";

type OptimizeResumeOptions = {
  jobDescription: string;
  resumeText: string;
};

export async function optimizeResume({
  jobDescription,
  resumeText,
}: OptimizeResumeOptions): Promise<StructuredResume> {
  return createStructuredResumeResponse({
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

type ReviseSectionOptions = {
  jobDescription: string;
  resume: StructuredResume;
  sectionLabel: string;
  sectionText: string;
  instruction: string;
};

export async function reviseResumeSection({
  jobDescription,
  resume,
  sectionLabel,
  sectionText,
  instruction,
}: ReviseSectionOptions): Promise<string> {
  return createTextResponse({
    instructions: [
      "You revise exactly one resume section at a time.",
      "Follow the user's instruction while aligning the section to the job description.",
      "Do not fabricate employers, titles, dates, degrees, certifications, tools, metrics, responsibilities, or achievements.",
      "Return only replacement text for the requested section. No Markdown fences or commentary.",
    ].join(" "),
    input: [
      `SECTION: ${sectionLabel}`,
      "",
      "USER INSTRUCTION:",
      instruction.trim(),
      "",
      "JOB DESCRIPTION:",
      jobDescription.trim(),
      "",
      "FULL CURRENT RESUME:",
      resumeToPlainText(resume),
      "",
      "CURRENT SECTION TEXT:",
      sectionText.trim(),
    ].join("\n"),
    maxOutputTokens: 1200,
    timeoutMs: 45000,
  });
}
