import {
  normalizeStructuredResume,
  parseResumeJson,
  resumeToPlainText,
  type StructuredResume,
} from "../../resume";
import type {
  CoverLetterInput,
  LLMEnv,
  LLMProvider,
  OptimizeInput,
  ReviseSectionInput,
  StructureResumeInput,
} from "../types";

type CreateMessageOptions = {
  input: string;
  system: string;
  maxOutputTokens?: number;
  timeoutMs?: number;
};

type AnthropicMessageResponse = {
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
  };
};

const MESSAGES_URL = "https://api.anthropic.com/v1/messages";

export const anthropicProvider: LLMProvider = {
  optimize,
  structureResume,
  reviseSection,
  generateCoverLetter,
};

async function optimize(env: LLMEnv, { jobDescription, resumeText }: OptimizeInput) {
  const text = await createTextResponse(env, {
    system: [
      "You are an expert resume optimizer for ATS-friendly resumes.",
      "Rewrite the resume to match the job description language while preserving truthfulness.",
      "Adjust the summary, rewrite bullets, inject matching keywords, and reorder skills by relevance.",
      "Do not fabricate employers, titles, dates, degrees, certifications, tools, metrics, responsibilities, or achievements.",
      "If a detail is not present in the original resume, do not add it.",
      "Return only valid JSON matching this shape: { summary: string, experience: [{ id, title, company, location, dates, bullets: string[] }], skills: string[], education: string[] }.",
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
      "- Return only the JSON object. Do not wrap it in Markdown.",
    ].join("\n"),
    maxOutputTokens: 7000,
    timeoutMs: 90000,
  });

  return parseStructuredResumeText(text);
}

async function structureResume(env: LLMEnv, { resumeName, resumeText }: StructureResumeInput) {
  const text = await createTextResponse(env, {
    system: [
      "You are an expert resume parser.",
      "Categorize raw extracted resume text into clean resume sections without optimizing, rewriting, or improving it.",
      "Preserve candidate facts, names, employers, titles, dates, links, tools, metrics, and wording as much as possible.",
      "Do not fabricate, infer, or add missing content.",
      "Do not shorten, summarize, or drop Professional Experience, Work Experience, Employment History, roles, bullets, or later-page content.",
      "The top-level experience array is authoritative for work history and must include every role from the original resume.",
      "Split each role header into title, company, location, and dates. Never put a role title, company, location, or date range into the role's bullets.",
      "The sections array must include every original resume section; the experience section content may mirror the top-level experience roles.",
      "Keep clear section boundaries. Do not mix languages with education, projects with experience, or contact details with summary.",
      "Unknown section headings should be returned as type custom with the original heading as title.",
      "Return only valid JSON matching this shape: { summary: string, experience: [{ id, title, company, location, dates, bullets: string[] }], skills: string[], education: string[], sections: [{ id, type, title, content, contentKind, order }] }.",
    ].join(" "),
    input: [
      resumeName ? `RESUME FILE NAME: ${resumeName}` : "",
      "RAW EXTRACTED RESUME TEXT:",
      resumeText.trim(),
      "",
      "Categorization rules:",
      "- Output sections in the same order they appear in the original resume.",
      "- Use type contact for personal details, links, email, phone, and location.",
      "- Use type summary only for actual summary/profile text.",
      "- Use type skills only for skills/tool lists.",
      "- If the raw resume has Professional Experience, Work Experience, Employment History, or similar, populate the top-level experience array with all roles and bullets preserved.",
      "- For each experience role, keep the role title/date/company line separate from its task bullets.",
      "- Use type languages only for spoken/written language sections.",
      "- Use type education only for degrees, schools, training, and education credentials.",
      "- Use type projects only when the original text is a projects section.",
      "- Do not omit content from later pages or sections near the end of the raw text.",
      "- Use type custom for any valid section that does not fit the known categories.",
      "- contentKind must be paragraph or bullets.",
      "- Return only the JSON object. Do not wrap it in Markdown.",
    ].filter(Boolean).join("\n"),
    maxOutputTokens: 12000,
    timeoutMs: 90000,
  });

  return parseStructuredResumeText(text);
}

async function reviseSection(
  env: LLMEnv,
  { jobDescription, resume, sectionLabel, sectionText, instruction }: ReviseSectionInput,
) {
  return createTextResponse(env, {
    system: [
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

async function generateCoverLetter(
  env: LLMEnv,
  { jobDescription, resumeText, jobTitle }: CoverLetterInput,
) {
  return createTextResponse(env, {
    system: [
      "You write concise, professional cover letters for job applications.",
      "Use only facts present in the resume and job description.",
      "Do not fabricate employers, titles, dates, degrees, certifications, metrics, projects, availability, or contact details.",
      "Align the candidate's strongest relevant experience to the role.",
      "Write in first person with a confident, direct tone.",
      "Return only the cover letter text. No Markdown, labels, or commentary.",
    ].join(" "),
    input: [
      jobTitle ? `TARGET ROLE: ${jobTitle}` : "",
      "JOB DESCRIPTION:",
      jobDescription.trim(),
      "",
      "CURRENT RESUME:",
      resumeText.trim(),
      "",
      "Output requirements:",
      "- 3 to 5 short paragraphs.",
      "- No recipient address block unless it is explicitly provided.",
      "- Do not repeat the full resume.",
      "- Keep it under 450 words.",
    ].filter(Boolean).join("\n"),
    maxOutputTokens: 1300,
    timeoutMs: 45000,
  });
}

async function createTextResponse(
  env: LLMEnv,
  {
    input,
    system,
    maxOutputTokens = 1800,
    timeoutMs = 60000,
  }: CreateMessageOptions,
): Promise<string> {
  if (!env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not configured as a Cloudflare Worker secret.");
  }

  const response = await fetchWithTimeout(MESSAGES_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
      "x-api-key": env.ANTHROPIC_API_KEY,
    },
    body: JSON.stringify({
      model: env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
      max_tokens: maxOutputTokens,
      system,
      messages: [
        {
          role: "user",
          content: input,
        },
      ],
    }),
    timeoutMs,
  });

  const payload = (await response.json().catch(() => ({}))) as AnthropicMessageResponse;

  if (!response.ok || payload.error) {
    throw new Error(normalizeAnthropicError(payload, response.status));
  }

  const text = extractOutputText(payload);
  if (!text) throw new Error("The model returned an empty response.");
  return text;
}

function parseStructuredResumeText(text: string): StructuredResume {
  try {
    return parseResumeJson(text);
  } catch {
    return normalizeStructuredResume(JSON.parse(text));
  }
}

function normalizeAnthropicError(payload: AnthropicMessageResponse, status: number): string {
  return (
    payload.error?.message ??
    (status === 401
      ? "Invalid Anthropic API key."
      : status === 429
        ? "Rate limit reached."
        : "The Anthropic request failed.")
  );
}

function extractOutputText(payload: AnthropicMessageResponse): string {
  return (payload.content ?? [])
    .filter((content) => content.type === "text" && content.text)
    .map((content) => content.text)
    .join("\n")
    .trim();
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs: number },
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}
