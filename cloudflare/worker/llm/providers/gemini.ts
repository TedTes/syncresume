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
import { parseReviseSectionResult, revisionBoundaryInstruction } from "../revision";

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
  structureResume,
  reviseSection,
  generateCoverLetter,
};

async function optimize(
  env: LLMEnv,
  { jobDescription, resumeText, strictPreservation, retryReason }: OptimizeInput,
) {
  const text = await createTextResponse(env, {
    system: [
      "You are an expert resume optimizer for ATS-friendly resumes.",
      "Rewrite the resume to match the job description language while preserving truthfulness.",
      "Optimize existing content only: adjust wording, reorder skills, and align language to the job without deleting accomplishments.",
      "Preserve every original role, accomplishment, responsibility, project, metric, tool, employer, title, date, education item, and certification unless it is clearly duplicated.",
      "Do not remove accomplishments to improve ATS score; rewrite or reorganize them while keeping the underlying evidence.",
      "Do not fabricate employers, titles, dates, degrees, certifications, tools, metrics, responsibilities, or achievements.",
      "If a detail is not present in the original resume, do not add it.",
      ...(strictPreservation
        ? [
            "STRICT RETRY: The previous optimized output omitted too much source resume content.",
            "This attempt must retain all non-duplicative accomplishments and responsibilities from the original resume.",
            retryReason ? `Retry reason: ${retryReason}` : "",
          ]
        : []),
      "Return only valid JSON matching this shape: { summary: string, experience: [{ id, title, company, location, dates, bullets: string[] }], skills: string[], education: string[] }.",
    ].filter(Boolean).join(" "),
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
      "- Keep every original role and all non-duplicative accomplishment/responsibility bullets. If a bullet is weak, improve it instead of dropping it.",
      "- Use concise, impact-oriented bullets without inventing metrics or removing evidence.",
      "- You may combine only clearly duplicate bullets; do not compress unrelated accomplishments into vague summaries.",
      "- Keep the resume ATS-safe and single-column friendly.",
      "- Return only the JSON object. Do not wrap it in Markdown.",
    ].join("\n"),
    maxOutputTokens: 7000,
    responseMimeType: "application/json",
    timeoutMs: 90000,
  });

  return parseStructuredResumeText(text);
}

async function structureResume(
  env: LLMEnv,
  {
    resumeName,
    resumeText,
    strictPreservation,
    minimumOutputCharacters,
    retryReason,
  }: StructureResumeInput,
) {
  const strictRules = strictResumeStructureRules(strictPreservation, minimumOutputCharacters, retryReason);
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
      ...strictRules.system,
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
      ...strictRules.input,
    ].filter(Boolean).join("\n"),
    maxOutputTokens: 12000,
    responseMimeType: "application/json",
    timeoutMs: 90000,
  });

  return parseStructuredResumeText(text);
}

function strictResumeStructureRules(
  strictPreservation?: boolean,
  minimumOutputCharacters?: number,
  retryReason?: string,
): { system: string[]; input: string[] } {
  if (!strictPreservation) return { system: [], input: [] };

  return {
    system: [
      "Strict preservation retry mode: a previous parse was rejected because it omitted too much source content.",
      "Your priority is faithful categorization, not brevity.",
      "Copy every original role, bullet, project, skill, education line, certification, award, publication, volunteer item, and custom section into the structured output.",
      "If a line is readable but hard to categorize, keep it in a custom section instead of dropping it.",
    ],
    input: [
      retryReason ? `Previous failure reason: ${retryReason}` : "",
      minimumOutputCharacters
        ? `The represented plain-text resume should be at least ${minimumOutputCharacters} normalized characters unless the source contains unreadable extraction noise.`
        : "",
      "- Preserve all readable lines. Do not compress multiple bullets into one sentence.",
      "- Keep every experience role and every bullet under that role.",
      "- Keep every skills/category line instead of merging away uncommon tools.",
      "- Keep every later-page section even if it looks less important.",
      "- Do not return a shortened resume for visual fit; fitting happens later in templates.",
    ].filter(Boolean),
  };
}

async function reviseSection(
  env: LLMEnv,
  { jobDescription, resume, sectionLabel, sectionText, instruction }: ReviseSectionInput,
) {
  const text = await createTextResponse(env, {
    system: revisionBoundaryInstruction,
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
    responseMimeType: "application/json",
    timeoutMs: 45000,
  });

  return parseReviseSectionResult(text);
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
