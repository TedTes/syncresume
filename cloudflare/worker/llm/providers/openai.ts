import {
  normalizeStructuredResume,
  parseResumeJson,
  resumeToPlainText,
  type StructuredResume,
} from "../../resume";
import type { CoverLetterInput, LLMEnv, LLMProvider, OptimizeInput, ReviseSectionInput } from "../types";

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

async function reviseSection(
  env: LLMEnv,
  { jobDescription, resume, sectionLabel, sectionText, instruction }: ReviseSectionInput,
) {
  return createTextResponse(env, {
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
