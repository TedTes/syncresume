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

type ResponseFormat = {
  type: "json_schema";
  name: string;
  schema: Record<string, unknown>;
  strict: boolean;
};

type CreateResponseOptions = {
  input: string;
  instructions?: string;
  maxOutputTokens?: number;
  responseFormat?: ResponseFormat;
  timeoutMs?: number;
};

type OpenAIResponseBody = {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    code?: string;
    message?: string;
    type?: string;
  };
  incomplete_details?: {
    reason?: string;
  };
};

const RESPONSES_URL = "https://api.openai.com/v1/responses";

export const openAIProvider: LLMProvider = {
  optimize,
  structureResume,
  reviseSection,
  generateCoverLetter,
};

async function optimize(env: LLMEnv, { jobDescription, resumeText }: OptimizeInput) {
  return createStructuredResumeResponse(env, {
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
  return createStructuredResumeSectionsResponse(env, {
    instructions: [
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
      "Return only the requested structured JSON object.",
      ...strictRules.system,
    ].join(" "),
    input: [
      resumeName ? `RESUME FILE NAME: ${resumeName}` : "",
      "RAW EXTRACTED RESUME TEXT:",
      resumeText.trim(),
      "",
      "Categorization rules:",
      "- Output sections in the same order they appear in the original resume.",
      "- Use title Contact for personal details, links, email, phone, and location.",
      "- Use title Professional Summary or Summary only for actual summary/profile text.",
      "- Use title Technical Skills or Skills only for skills/tool lists.",
      "- If the raw resume has Professional Experience, Work Experience, Employment History, or similar, populate the top-level experience array with all roles and bullets preserved.",
      "- For each experience role, keep the role title/date/company line separate from its task bullets.",
      "- Use type languages only for spoken/written language sections.",
      "- Use type education only for degrees, schools, training, and education credentials.",
      "- Use type projects only when the original text is a projects section.",
      "- Do not omit content from later pages or sections near the end of the raw text.",
      "- Use type custom for any valid section that does not fit the known categories.",
      "- Set contentKind to bullets when the section is primarily bullet/list content; otherwise paragraph.",
      ...strictRules.input,
    ].filter(Boolean).join("\n"),
    maxOutputTokens: 12000,
    timeoutMs: 90000,
  });
}

async function reviseSection(
  env: LLMEnv,
  { jobDescription, resume, sectionLabel, sectionText, instruction }: ReviseSectionInput,
) {
  const text = await createTextResponse(env, {
    instructions: revisionBoundaryInstruction,
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
    responseFormat: revisionResponseFormat,
    timeoutMs: 45000,
  });

  return parseReviseSectionResult(text);
}

async function generateCoverLetter(
  env: LLMEnv,
  { jobDescription, resumeText, jobTitle }: CoverLetterInput,
) {
  return createTextResponse(env, {
    instructions: [
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
    instructions,
    maxOutputTokens = 1800,
    responseFormat,
    timeoutMs = 60000,
  }: CreateResponseOptions,
): Promise<string> {
  if (!env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured as a Cloudflare Worker secret.");
  }

  const body = {
    model: env.OPENAI_MODEL ?? "gpt-5.4-mini",
    input,
    instructions,
    max_output_tokens: maxOutputTokens,
    store: false,
    reasoning: { effort: "none" },
    ...(responseFormat
      ? {
          text: {
            format: responseFormat,
            verbosity: "low",
          },
        }
      : {}),
  };

  const response = await fetchWithTimeout(RESPONSES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    timeoutMs,
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAIResponseBody;

  if (!response.ok || payload.error) {
    throw new Error(normalizeOpenAIError(payload, response.status));
  }

  if (payload.incomplete_details?.reason === "max_output_tokens") {
    throw new Error("The model response was cut off. Retry with a shorter resume or job description.");
  }

  const text = extractOutputText(payload);
  if (!text) throw new Error("The model returned an empty response.");
  return text;
}

async function createStructuredResumeResponse(
  env: LLMEnv,
  options: Omit<CreateResponseOptions, "responseFormat">,
): Promise<StructuredResume> {
  const text = await createTextResponse(env, {
    ...options,
    responseFormat: resumeResponseFormat,
  });

  try {
    return parseResumeJson(text);
  } catch {
    return normalizeStructuredResume(JSON.parse(text));
  }
}

async function createStructuredResumeSectionsResponse(
  env: LLMEnv,
  options: Omit<CreateResponseOptions, "responseFormat">,
): Promise<StructuredResume> {
  const text = await createTextResponse(env, {
    ...options,
    responseFormat: resumeSectionsResponseFormat,
  });

  try {
    return parseResumeJson(text);
  } catch {
    return normalizeStructuredResume(JSON.parse(text));
  }
}

const resumeResponseFormat: ResponseFormat = {
  type: "json_schema",
  name: "optimized_resume",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "experience", "skills", "education"],
    properties: {
      summary: { type: "string" },
      experience: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "company", "location", "dates", "bullets"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            company: { type: "string" },
            location: { type: "string" },
            dates: { type: "string" },
            bullets: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
      },
      skills: {
        type: "array",
        items: { type: "string" },
      },
      education: {
        type: "array",
        items: { type: "string" },
      },
    },
  },
};

const revisionResponseFormat: ResponseFormat = {
  type: "json_schema",
  name: "resume_section_revision",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["type", "text"],
    properties: {
      type: {
        type: "string",
        enum: ["revision", "out_of_scope"],
      },
      text: {
        type: "string",
      },
    },
  },
};

const experienceRoleSchema = {
  type: "object",
  additionalProperties: false,
  required: ["id", "title", "company", "location", "dates", "bullets"],
  properties: {
    id: { type: "string" },
    title: { type: "string" },
    company: { type: "string" },
    location: { type: "string" },
    dates: { type: "string" },
    bullets: {
      type: "array",
      items: { type: "string" },
    },
  },
};

const resumeSectionsResponseFormat: ResponseFormat = {
  type: "json_schema",
  name: "structured_resume_sections",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "experience", "skills", "education", "sections"],
    properties: {
      summary: { type: "string" },
      experience: {
        type: "array",
        items: experienceRoleSchema,
      },
      skills: {
        type: "array",
        items: { type: "string" },
      },
      education: {
        type: "array",
        items: { type: "string" },
      },
      sections: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "type", "title", "content", "contentKind", "order"],
          properties: {
            id: { type: "string" },
            type: {
              type: "string",
              enum: [
                "contact",
                "summary",
                "skills",
                "languages",
                "experience",
                "education",
                "certifications",
                "projects",
                "awards",
                "publications",
                "volunteering",
                "custom",
              ],
            },
            title: { type: "string" },
            content: { type: "string" },
            contentKind: { type: "string", enum: ["paragraph", "bullets"] },
            order: { type: "number" },
          },
        },
      },
    },
  },
};

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

function normalizeOpenAIError(payload: OpenAIResponseBody, status: number): string {
  return (
    payload.error?.message ??
    (status === 401
      ? "Invalid OpenAI API key."
      : status === 429
        ? "Rate limit reached."
        : "The OpenAI request failed.")
  );
}

function extractOutputText(payload: OpenAIResponseBody): string {
  if (payload.output_text) return payload.output_text.trim();

  const fragments: string[] = [];
  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if ((content.type === "output_text" || content.type === "text") && content.text) {
        fragments.push(content.text);
      }
    }
  }

  return fragments.join("\n").trim();
}
