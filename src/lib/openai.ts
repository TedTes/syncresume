import { getApiKey } from "./runtimeConfig";
import {
  normalizeStructuredResume,
  parseResumeJson,
  type StructuredResume,
} from "./resume";

export const DEFAULT_MODEL = "gpt-5.4-mini";
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

export async function createTextResponse({
  input,
  instructions,
  maxOutputTokens = 1800,
  responseFormat,
  timeoutMs = 60000,
}: CreateResponseOptions): Promise<string> {
  const body = {
    model: DEFAULT_MODEL,
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
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    timeoutMs,
  });

  const payload = (await response.json().catch(() => ({}))) as OpenAIResponseBody;

  if (!response.ok) {
    throw normalizeOpenAIError(payload, response.status);
  }

  if (payload.error) {
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

export async function createStructuredResumeResponse(
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

export function openAIErrorMessage(error: unknown): string {
  if (error instanceof OpenAIRequestError) {
    if (error.status === 401) {
      return "API key is missing or invalid. Set VITE_OPENAI_API_KEY in your environment.";
    }
    if (error.status === 429 || error.code === "rate_limit_exceeded") {
      return "Rate limit reached. Wait a moment, then retry.";
    }
    if (error.code === "timeout") {
      return "The request timed out. Retry when the network is stable.";
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Retry the request.";
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
  const timeoutId = window.setTimeout(() => controller.abort(), options.timeoutMs);

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
    window.clearTimeout(timeoutId);
  }
}

function normalizeOpenAIError(payload: OpenAIResponseBody, status: number): OpenAIRequestError {
  const message =
    payload.error?.message ??
    (status === 401
      ? "Invalid API key."
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
