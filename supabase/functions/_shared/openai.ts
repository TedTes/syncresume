import {
  normalizeStructuredResume,
  parseResumeJson,
  resumeToPlainText,
  type StructuredResume,
} from "./resume.ts";

const RESPONSES_URL = "https://api.openai.com/v1/responses";

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

export class OpenAIRequestError extends Error {
  code?: string;
  status?: number;

  constructor(message: string, options: { code?: string; status?: number } = {}) {
    super(message);
    this.name = "OpenAIRequestError";
    this.code = options.code;
    this.status = options.status;
  }
}

export async function optimizeResume({
  jobDescription,
  resumeText,
}: {
  jobDescription: string;
  resumeText: string;
}): Promise<StructuredResume> {
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

export async function reviseResumeSection({
  jobDescription,
  resume,
  sectionLabel,
  sectionText,
  instruction,
}: {
  jobDescription: string;
  resume: StructuredResume;
  sectionLabel: string;
  sectionText: string;
  instruction: string;
}): Promise<string> {
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

async function createTextResponse({
  input,
  instructions,
  maxOutputTokens = 1800,
  responseFormat,
  timeoutMs = 60000,
}: CreateResponseOptions): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new OpenAIRequestError("OPENAI_API_KEY is not configured in Supabase secrets.", {
      status: 500,
    });
  }

  const body = {
    model: Deno.env.get("OPENAI_MODEL") ?? "gpt-5.4-mini",
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
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    timeoutMs,
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAIResponseBody;

  if (!response.ok || payload.error) {
    throw normalizeOpenAIError(payload, response.status);
  }

  if (payload.incomplete_details?.reason === "max_output_tokens") {
    throw new OpenAIRequestError(
      "The model response was cut off. Retry with a shorter resume or job description.",
      { code: "max_output_tokens", status: response.status },
    );
  }

  const text = extractOutputText(payload);
  if (!text) {
    throw new OpenAIRequestError("The model returned an empty response.", {
      status: response.status,
    });
  }

  return text;
}

async function createStructuredResumeResponse(
  options: Omit<CreateResponseOptions, "responseFormat">,
): Promise<StructuredResume> {
  const text = await createTextResponse({
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
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new OpenAIRequestError("The request timed out.", { code: "timeout" });
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function normalizeOpenAIError(payload: OpenAIResponseBody, status: number): OpenAIRequestError {
  const message =
    payload.error?.message ??
    (status === 401
      ? "Invalid OpenAI API key."
      : status === 429
        ? "Rate limit reached."
        : "The OpenAI request failed.");

  return new OpenAIRequestError(message, {
    code: payload.error?.code ?? payload.error?.type,
    status,
  });
}

function extractOutputText(payload: OpenAIResponseBody): string {
  if (payload.output_text) {
    return payload.output_text.trim();
  }

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
