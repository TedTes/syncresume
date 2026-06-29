import {
  normalizeStructuredResume,
  parseResumeJson,
  resumeToPlainText,
  type StructuredResume,
} from "../../resume";
import type { CoverLetterInput, LLMEnv, LLMProvider, OptimizeInput, ReviseSectionInput } from "../types";

type CreateContentOptions = {
  input: string;
  system: string;
  maxOutputTokens?: number;
  responseMimeType?: "application/json" | "text/plain";
  timeoutMs?: number;
};

type GeminiGenerateContentResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

export const geminiProvider: LLMProvider = {
  optimize,
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
    responseMimeType: "application/json",
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
    responseMimeType,
    timeoutMs = 60000,
  }: CreateContentOptions,
): Promise<string> {
  if (!env.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is not configured as a Cloudflare Worker secret.");
  }

  const model = env.GEMINI_MODEL ?? "gemini-2.5-flash";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`;

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: input }],
        },
      ],
      generationConfig: {
        maxOutputTokens,
        ...(responseMimeType ? { responseMimeType } : {}),
      },
    }),
    timeoutMs,
  });

  const payload = (await response.json().catch(() => ({}))) as GeminiGenerateContentResponse;

  if (!response.ok || payload.error) {
    throw new Error(normalizeGeminiError(payload, response.status));
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

function normalizeGeminiError(payload: GeminiGenerateContentResponse, status: number): string {
  return (
    payload.error?.message ??
    (status === 401 || status === 403
      ? "Invalid Gemini API key."
      : status === 429
        ? "Rate limit reached."
        : "The Gemini request failed.")
  );
}

function extractOutputText(payload: GeminiGenerateContentResponse): string {
  const fragments: string[] = [];
  for (const candidate of payload.candidates ?? []) {
    for (const part of candidate.content?.parts ?? []) {
      if (part.text) fragments.push(part.text);
    }
  }
  return fragments.join("\n").trim();
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
