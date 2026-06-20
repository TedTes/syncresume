import { fetchJobPageText } from "./jobPage";
import {
  normalizeLLMProvider,
  optimizeResumeWithProvider,
  reviseSectionWithProvider,
} from "./llm/dispatch";
import { normalizeStructuredResume, resumeToPlainText, scoreKeywords } from "./resume";
import { getClerkEmail, verifyClerkRequest } from "./auth/clerk";

export interface Env {
  DB: D1Database;
  RESUME_BUCKET: R2Bucket;
  APP_ORIGIN?: string;
  CLERK_JWKS_URL?: string;
  CLERK_ISSUER?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
}

type JsonBody = Record<string, unknown> | Array<unknown>;
type JsonRecord = Record<string, unknown>;

type UserRow = {
  id: string;
  email: string;
  plan: string;
  created_at: string;
  updated_at: string;
};

type ResumeRow = {
  id: string;
  name: string;
  file_type: "pdf" | "docx" | "text";
  storage_key: string | null;
  extracted_text: string;
  character_count: number;
  usage_count: number;
  is_active: number;
  selected_template_id: string;
  version_type: "base" | "tailored";
  source_resume_id: string | null;
  source_run_id: string | null;
  tailored_for: string | null;
  match_score: number | null;
  uploaded_at: string;
};

type RunRow = {
  id: string;
  title: string;
  resume_id: string;
  resume_name: string;
  job_description: string;
  score: number;
  status: "draft" | "exported";
  created_at: string;
};

class HttpError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

const MAX_RESUME_BYTES = 25 * 1024 * 1024;
const MIN_RESUME_TEXT_LENGTH = 20;
const RESUME_TEMPLATE_IDS = new Set(["ats-simple", "modern", "compact", "executive"]);
const RESUME_VERSION_TYPES = new Set(["base", "tailored"]);
const JOB_TITLE_WORDS = [
  "analyst",
  "architect",
  "consultant",
  "designer",
  "developer",
  "director",
  "engineer",
  "lead",
  "manager",
  "product",
  "scientist",
  "specialist",
  "strategist",
];
const JOB_TITLE_SKIP_PREFIXES = [
  "about ",
  "benefits",
  "company",
  "compensation",
  "department",
  "employment type",
  "equal opportunity",
  "location",
  "qualifications",
  "reports to",
  "requirements",
  "responsibilities",
  "salary",
  "the role",
  "what you",
  "who you",
];

const defaultCorsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsHeaders = createCorsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);

    try {
      if (url.pathname === "/api/health" && request.method === "GET") {
        const db = await env.DB.prepare("select 1 as ok").first<{ ok: number }>();
        return json({ ok: true, database: db?.ok === 1 }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/me" && request.method === "GET") {
        const { user } = await requireSession(request, env);
        return json({ user: publicUser(user) }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/resumes" && request.method === "GET") {
        return await handleListResumes(request, env, corsHeaders);
      }

      if (url.pathname === "/api/resumes" && request.method === "POST") {
        return await handleCreateResume(request, env, corsHeaders);
      }

      const activeResumeMatch = url.pathname.match(/^\/api\/resumes\/([^/]+)\/active$/);
      if (activeResumeMatch && request.method === "PATCH") {
        return await handleSetActiveResume(request, env, corsHeaders, activeResumeMatch[1]);
      }

      const resumeTextMatch = url.pathname.match(/^\/api\/resumes\/([^/]+)\/text$/);
      if (resumeTextMatch && request.method === "PATCH") {
        return await handleUpdateResumeText(request, env, corsHeaders, resumeTextMatch[1]);
      }

      const resumeTemplateMatch = url.pathname.match(/^\/api\/resumes\/([^/]+)\/template$/);
      if (resumeTemplateMatch && request.method === "PATCH") {
        return await handleUpdateResumeTemplate(request, env, corsHeaders, resumeTemplateMatch[1]);
      }

      const resumeFileMatch = url.pathname.match(/^\/api\/resumes\/([^/]+)\/file$/);
      if (resumeFileMatch && request.method === "GET") {
        return await handleGetResumeFile(request, env, corsHeaders, resumeFileMatch[1]);
      }

      const resumeMatch = url.pathname.match(/^\/api\/resumes\/([^/]+)$/);
      if (resumeMatch && request.method === "DELETE") {
        return await handleDeleteResume(request, env, corsHeaders, resumeMatch[1]);
      }

      const resumeUsageMatch = url.pathname.match(/^\/api\/resumes\/([^/]+)\/usage$/);
      if (resumeUsageMatch && request.method === "PATCH") {
        return await handleIncrementResumeUsage(request, env, corsHeaders, resumeUsageMatch[1]);
      }

      if (url.pathname === "/api/runs" && request.method === "GET") {
        return await handleListRuns(request, env, corsHeaders);
      }

      if (url.pathname === "/api/runs" && request.method === "POST") {
        return await handleCreateRun(request, env, corsHeaders);
      }

      const runStatusMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/status$/);
      if (runStatusMatch && request.method === "PATCH") {
        return await handleUpdateRunStatus(request, env, corsHeaders, runStatusMatch[1]);
      }

      if (url.pathname === "/api/exports" && request.method === "POST") {
        return await handleRecordExport(request, env, corsHeaders);
      }

      if (url.pathname === "/api/optimize" && request.method === "POST") {
        return await handleOptimize(request, env, corsHeaders);
      }

      if (url.pathname === "/api/revise-section" && request.method === "POST") {
        return await handleReviseSection(request, env, corsHeaders);
      }

      if (url.pathname === "/api/fetch-job-page" && request.method === "POST") {
        return await handleFetchJobPage(request, corsHeaders);
      }

      return json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    } catch (error) {
      const status = error instanceof HttpError ? error.status : 500;
      return json(
        { error: error instanceof Error ? error.message : "Worker request failed" },
        { status, headers: corsHeaders },
      );
    }
  },
};

async function handleOptimize(request: Request, env: Env, headers: Headers): Promise<Response> {
  const { user } = await requireSession(request, env);
  const body = await readJson(request);
  const provider = normalizeLLMProvider(String(body.provider || "openai"));
  const jobDescription = asNonEmptyString(body.jobDescription);
  const resumeId = asNonEmptyString(body.resumeId);
  let resumeText = asNonEmptyString(body.resumeText);
  let resumeName = asNonEmptyString(body.resumeName) || "Resume";
  let usageCount = 0;

  if (jobDescription.length < 20) {
    return json({ error: "Paste a complete job description before optimizing." }, { status: 400, headers });
  }

  if (resumeId) {
    const resume = await env.DB.prepare(
      "select name, extracted_text, usage_count from resumes where user_id = ? and id = ?",
    )
      .bind(user.id, resumeId)
      .first<{ name: string; extracted_text: string; usage_count: number }>();

    if (!resume) {
      return json({ error: "Resume not found." }, { status: 404, headers });
    }

    resumeText = resume.extracted_text;
    resumeName = resume.name;
    usageCount = resume.usage_count;
  }

  if (resumeText.length < 50) {
    return json({ error: "Upload or paste a readable resume before optimizing." }, { status: 400, headers });
  }

  const optimizedResume = await optimizeResumeWithProvider(env, provider, {
    jobDescription,
    resumeText,
  });
  const score = scoreKeywords(jobDescription, resumeToPlainText(optimizedResume));
  let run = null;

  if (resumeId) {
    await env.DB.prepare(
      "update resumes set usage_count = ?, updated_at = current_timestamp where user_id = ? and id = ?",
    )
      .bind(usageCount + 1, user.id, resumeId)
      .run();
  }

  if (body.saveRunHistory !== false && resumeId) {
    const row = await env.DB.prepare(
      [
        "insert into optimization_runs",
        "(id, user_id, resume_id, resume_name, title, job_description, optimized_resume, score, status)",
        "values (?, ?, ?, ?, ?, ?, ?, ?, 'draft')",
        "returning id, title, resume_id, resume_name, job_description, score, status, created_at",
      ].join(" "),
    )
      .bind(
        crypto.randomUUID(),
        user.id,
        resumeId,
        resumeName,
        asNonEmptyString(body.title) || deriveRunTitle(jobDescription),
        jobDescription,
        JSON.stringify(optimizedResume),
        score,
      )
      .first<RunRow>();

    run = row ? mapRun(row) : null;
  }

  return json({ resume: optimizedResume, score, run }, { headers });
}

async function handleReviseSection(request: Request, env: Env, headers: Headers): Promise<Response> {
  await requireSession(request, env);
  const body = await readJson(request);
  const provider = normalizeLLMProvider(String(body.provider || "openai"));
  const jobDescription = asNonEmptyString(body.jobDescription);
  const instruction = asNonEmptyString(body.instruction);
  const sectionText = asNonEmptyString(body.sectionText);
  const sectionLabel = asNonEmptyString(body.sectionLabel) || "Resume section";

  if (!instruction) {
    return json({ error: "Add a revision instruction before submitting." }, { status: 400, headers });
  }

  if (jobDescription.length < 20 || sectionText.length < 5) {
    return json({ error: "Missing job description or section text." }, { status: 400, headers });
  }

  const revisedText = await reviseSectionWithProvider(env, provider, {
    jobDescription,
    resume: normalizeStructuredResume(body.resume),
    sectionLabel,
    sectionText,
    instruction,
  });

  return json({ revisedText }, { headers });
}

async function handleFetchJobPage(request: Request, headers: Headers): Promise<Response> {
  const body = await readJson(request);
  const text = await fetchJobPageText(asNonEmptyString(body.url));
  return json({ text }, { headers });
}

async function handleListResumes(request: Request, env: Env, headers: Headers): Promise<Response> {
  const { user } = await requireSession(request, env);
  const { results } = await env.DB.prepare(
    [
      "select id, name, file_type, storage_key, extracted_text, character_count,",
      "usage_count, is_active, selected_template_id, version_type, source_resume_id,",
      "source_run_id, tailored_for, match_score, uploaded_at",
      "from resumes",
      "where user_id = ?",
      "order by uploaded_at desc",
    ].join(" "),
  )
    .bind(user.id)
    .all<ResumeRow>();

  return json({ resumes: results.map(mapResume) }, { headers });
}

async function handleCreateResume(request: Request, env: Env, headers: Headers): Promise<Response> {
  const { user } = await requireSession(request, env);
  const input = await readResumeInput(request);

  if (!input.name || !input.text || input.characterCount < MIN_RESUME_TEXT_LENGTH) {
    return json({ error: "Resume name and extracted text are required." }, { status: 400, headers });
  }

  if (input.byteSize > MAX_RESUME_BYTES) {
    return json({ error: "Resume file is larger than 25 MB." }, { status: 400, headers });
  }

  if (!["pdf", "docx", "text"].includes(input.fileType)) {
    return json({ error: "Upload a PDF, DOCX, or plain text resume." }, { status: 400, headers });
  }

  const id = crypto.randomUUID();
  const storageKey = `${user.id}/${id}/${sanitizeFileName(input.name)}`;
  const existing = await env.DB.prepare("select count(*) as count from resumes where user_id = ?")
    .bind(user.id)
    .first<{ count: number }>();
  const isFirst = (existing?.count ?? 0) === 0;

  await env.RESUME_BUCKET.put(storageKey, input.file ?? input.text, {
    httpMetadata: {
      contentType: input.contentType,
    },
  });

  try {
    const row = await env.DB.prepare(
      [
        "insert into resumes",
        "(id, user_id, name, file_type, storage_key, extracted_text, character_count, is_active, selected_template_id, version_type, source_resume_id, source_run_id, tailored_for, match_score)",
        "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        "returning id, name, file_type, storage_key, extracted_text, character_count, usage_count, is_active, selected_template_id, version_type, source_resume_id, source_run_id, tailored_for, match_score, uploaded_at",
      ].join(" "),
    )
      .bind(
        id,
        user.id,
        input.name,
        input.fileType,
        storageKey,
        input.text,
        input.text.length,
        isFirst ? 1 : 0,
        input.templateId,
        input.versionType,
        input.sourceResumeId,
        input.sourceRunId,
        input.tailoredFor,
        input.matchScore,
      )
      .first<ResumeRow>();

    if (!row) throw new Error("Could not save resume.");
    return json({ resume: mapResume(row) }, { headers });
  } catch (error) {
    await env.RESUME_BUCKET.delete(storageKey);
    throw error;
  }
}

async function handleSetActiveResume(
  request: Request,
  env: Env,
  headers: Headers,
  resumeId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  await env.DB.batch([
    env.DB.prepare("update resumes set is_active = 0, updated_at = current_timestamp where user_id = ?")
      .bind(user.id),
    env.DB.prepare(
      "update resumes set is_active = 1, updated_at = current_timestamp where user_id = ? and id = ?",
    ).bind(user.id, resumeId),
  ]);

  return json({ ok: true }, { headers });
}

async function handleUpdateResumeText(
  request: Request,
  env: Env,
  headers: Headers,
  resumeId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const body = await readJson(request);
  const text = asNonEmptyString(body.text);

  if (text.length < MIN_RESUME_TEXT_LENGTH) {
    return json({ error: "Resume text must be at least 20 characters." }, { status: 400, headers });
  }

  const row = await env.DB.prepare(
    [
      "update resumes",
      "set extracted_text = ?, character_count = ?, updated_at = current_timestamp",
      "where user_id = ? and id = ?",
      "returning id, name, file_type, storage_key, extracted_text, character_count, usage_count, is_active, selected_template_id, version_type, source_resume_id, source_run_id, tailored_for, match_score, uploaded_at",
    ].join(" "),
  )
    .bind(text, text.length, user.id, resumeId)
    .first<ResumeRow>();

  if (!row) {
    return json({ error: "Resume not found." }, { status: 404, headers });
  }

  return json({ resume: mapResume(row) }, { headers });
}

async function handleUpdateResumeTemplate(
  request: Request,
  env: Env,
  headers: Headers,
  resumeId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const body = await readJson(request);
  const templateId = asNonEmptyString(body.templateId);

  if (!RESUME_TEMPLATE_IDS.has(templateId)) {
    return json({ error: "Unknown resume template." }, { status: 400, headers });
  }

  const row = await env.DB.prepare(
    [
      "update resumes",
      "set selected_template_id = ?, updated_at = current_timestamp",
      "where user_id = ? and id = ?",
      "returning id, name, file_type, storage_key, extracted_text, character_count, usage_count, is_active, selected_template_id, version_type, source_resume_id, source_run_id, tailored_for, match_score, uploaded_at",
    ].join(" "),
  )
    .bind(templateId, user.id, resumeId)
    .first<ResumeRow>();

  if (!row) {
    return json({ error: "Resume not found." }, { status: 404, headers });
  }

  return json({ resume: mapResume(row) }, { headers });
}

async function handleGetResumeFile(
  request: Request,
  env: Env,
  headers: Headers,
  resumeId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const resume = await env.DB.prepare(
    "select name, file_type, storage_key from resumes where user_id = ? and id = ?",
  )
    .bind(user.id, resumeId)
    .first<Pick<ResumeRow, "name" | "file_type" | "storage_key">>();

  if (!resume?.storage_key) {
    return json({ error: "Resume file not found." }, { status: 404, headers });
  }

  const object = await env.RESUME_BUCKET.get(resume.storage_key);
  if (!object?.body) {
    return json({ error: "Resume file not found." }, { status: 404, headers });
  }

  const responseHeaders = new Headers(headers);
  responseHeaders.set(
    "Content-Type",
    object.httpMetadata?.contentType || contentTypeForFileType(resume.file_type),
  );
  responseHeaders.set(
    "Content-Disposition",
    `inline; filename="${sanitizeDispositionFileName(resume.name)}"`,
  );
  responseHeaders.set("Cache-Control", "private, no-store");
  responseHeaders.set("Access-Control-Expose-Headers", "Content-Disposition, Content-Type");

  return new Response(object.body, { headers: responseHeaders });
}

async function handleDeleteResume(
  request: Request,
  env: Env,
  headers: Headers,
  resumeId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const resume = await env.DB.prepare(
    "select storage_key, is_active from resumes where user_id = ? and id = ?",
  )
    .bind(user.id, resumeId)
    .first<{ storage_key: string | null; is_active: number }>();

  await env.DB.prepare("delete from resumes where user_id = ? and id = ?")
    .bind(user.id, resumeId)
    .run();

  if (resume?.storage_key) {
    await env.RESUME_BUCKET.delete(resume.storage_key);
  }

  if (resume?.is_active === 1) {
    const nextResume = await env.DB.prepare(
      "select id from resumes where user_id = ? order by uploaded_at desc limit 1",
    )
      .bind(user.id)
      .first<{ id: string }>();

    if (nextResume) {
      await env.DB.prepare(
        "update resumes set is_active = 1, updated_at = current_timestamp where user_id = ? and id = ?",
      )
        .bind(user.id, nextResume.id)
        .run();
    }
  }

  return json({ ok: true }, { headers });
}

async function handleIncrementResumeUsage(
  request: Request,
  env: Env,
  headers: Headers,
  resumeId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const resume = await env.DB.prepare(
    "select usage_count from resumes where user_id = ? and id = ?",
  )
    .bind(user.id, resumeId)
    .first<{ usage_count: number }>();

  if (!resume) {
    return json({ error: "Resume not found." }, { status: 404, headers });
  }

  await env.DB.prepare(
    "update resumes set usage_count = ?, updated_at = current_timestamp where user_id = ? and id = ?",
  )
    .bind(resume.usage_count + 1, user.id, resumeId)
    .run();

  return json({ ok: true }, { headers });
}

async function handleListRuns(request: Request, env: Env, headers: Headers): Promise<Response> {
  const { user } = await requireSession(request, env);
  const { results } = await env.DB.prepare(
    [
      "select id, title, resume_id, resume_name, job_description, score, status, created_at",
      "from optimization_runs",
      "where user_id = ?",
      "order by created_at desc",
    ].join(" "),
  )
    .bind(user.id)
    .all<RunRow>();

  return json({ runs: results.map(mapRun) }, { headers });
}

async function handleCreateRun(request: Request, env: Env, headers: Headers): Promise<Response> {
  const { user } = await requireSession(request, env);
  const body = await readJson(request);
  const id = crypto.randomUUID();
  const resumeId = asNonEmptyString(body.resumeId);
  const resumeName = asNonEmptyString(body.resumeName);
  const title = asNonEmptyString(body.title);
  const jobDescription = asNonEmptyString(body.jobDescription);
  const score = Number(body.score ?? 0);
  const status = body.status === "exported" ? "exported" : "draft";

  if (!resumeId || !resumeName || !title || !jobDescription) {
    return json({ error: "Run title, resume, and job description are required." }, { status: 400, headers });
  }

  const row = await env.DB.prepare(
    [
      "insert into optimization_runs",
      "(id, user_id, resume_id, resume_name, title, job_description, score, status)",
      "values (?, ?, ?, ?, ?, ?, ?, ?)",
      "returning id, title, resume_id, resume_name, job_description, score, status, created_at",
    ].join(" "),
  )
    .bind(id, user.id, resumeId, resumeName, title, jobDescription, Math.round(score), status)
    .first<RunRow>();

  if (!row) throw new Error("Could not save run.");
  return json({ run: mapRun(row) }, { headers });
}

async function handleUpdateRunStatus(
  request: Request,
  env: Env,
  headers: Headers,
  runId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const body = await readJson(request);
  const status = body.status === "exported" ? "exported" : "draft";

  await env.DB.prepare(
    "update optimization_runs set status = ?, updated_at = current_timestamp where user_id = ? and id = ?",
  )
    .bind(status, user.id, runId)
    .run();

  return json({ ok: true }, { headers });
}

async function handleRecordExport(request: Request, env: Env, headers: Headers): Promise<Response> {
  const { user } = await requireSession(request, env);
  const body = await readJson(request);
  const runId = asNonEmptyString(body.runId);
  const exportType = body.exportType;

  if (!runId || !["docx", "pdf", "copy"].includes(String(exportType))) {
    return json({ error: "Run id and export type are required." }, { status: 400, headers });
  }

  await env.DB.batch([
    env.DB.prepare(
      "insert into export_events (id, user_id, run_id, export_type) values (?, ?, ?, ?)",
    ).bind(crypto.randomUUID(), user.id, runId, String(exportType)),
    env.DB.prepare(
      "update optimization_runs set status = 'exported', updated_at = current_timestamp where user_id = ? and id = ?",
    ).bind(user.id, runId),
  ]);

  return json({ ok: true }, { headers });
}

async function requireSession(
  request: Request,
  env: Env,
): Promise<{ user: UserRow }> {
  try {
    const claims = await verifyClerkRequest(request, env);
    const email = getClerkEmail(claims);
    const user = await findOrCreateUser(env, claims.sub, email);
    return { user };
  } catch (error) {
    throw new HttpError(error instanceof Error ? error.message : "Sign in before continuing.", 401);
  }
}

async function findOrCreateUser(env: Env, clerkUserId: string, email: string): Promise<UserRow> {
  let user = await env.DB.prepare(
    "select id, email, plan, created_at, updated_at from users where email = ?",
  )
    .bind(email)
    .first<UserRow>();

  if (!user) {
    user = await env.DB.prepare(
      "select id, email, plan, created_at, updated_at from users where id = ?",
    )
      .bind(clerkUserId)
      .first<UserRow>();
  }

  if (!user) {
    await env.DB.prepare("insert into users (id, email) values (?, ?)")
      .bind(clerkUserId, email)
      .run();
    user = await env.DB.prepare(
      "select id, email, plan, created_at, updated_at from users where id = ?",
    )
      .bind(clerkUserId)
      .first<UserRow>();
  }

  if (!user) {
    throw new Error("Could not create user.");
  }

  return user;
}

function createCorsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers(defaultCorsHeaders);
  const requestOrigin = normalizeOrigin(request.headers.get("Origin") ?? "");
  const allowedOrigins = getAllowedCorsOrigins(env);
  const allowedOrigin =
    requestOrigin && allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : allowedOrigins[0] || requestOrigin || "*";

  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Vary", "Origin");
  return headers;
}

function getAllowedCorsOrigins(env: Env): string[] {
  return [env.APP_ORIGIN, env.CLERK_AUTHORIZED_PARTIES]
    .filter(Boolean)
    .flatMap((value) => String(value).split(","))
    .map(normalizeOrigin)
    .filter((value, index, origins) => Boolean(value) && origins.indexOf(value) === index);
}

function normalizeOrigin(value: string): string {
  const trimmed = value.trim().replace(/\/$/, "");
  if (!trimmed) return "";

  try {
    return new URL(trimmed).origin;
  } catch {
    return trimmed;
  }
}

async function readJson(request: Request): Promise<JsonRecord> {
  const body = (await request.json().catch(() => ({}))) as unknown;
  return body && typeof body === "object" && !Array.isArray(body) ? body as JsonRecord : {};
}

type ResumeInput = {
  name: string;
  fileType: "pdf" | "docx" | "text";
  text: string;
  characterCount: number;
  templateId: string;
  versionType: "base" | "tailored";
  sourceResumeId: string | null;
  sourceRunId: string | null;
  tailoredFor: string | null;
  matchScore: number | null;
  file?: File;
  contentType: string;
  byteSize: number;
};

async function readResumeInput(request: Request): Promise<ResumeInput> {
  const contentType = request.headers.get("Content-Type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const fileValue = form.get("file");
    const file = isFileLike(fileValue) ? fileValue : undefined;
    const text = String(form.get("text") ?? "").trim();
    const name = String(form.get("name") || file?.name || "Resume.txt").trim();
    const fileType = normalizeFileType(String(form.get("fileType") || fileTypeFromName(name)));
    const templateId = normalizeResumeTemplateId(String(form.get("templateId") || ""));
    const versionType = normalizeResumeVersionType(String(form.get("versionType") || ""));
    const contentType = file?.type || contentTypeForFileType(fileType);
    const matchScore = Number(form.get("matchScore"));

    return {
      name,
      fileType,
      text,
      characterCount: text.length,
      templateId,
      versionType,
      sourceResumeId: asNullableString(form.get("sourceResumeId")),
      sourceRunId: asNullableString(form.get("sourceRunId")),
      tailoredFor: asNullableString(form.get("tailoredFor")),
      matchScore: Number.isFinite(matchScore) ? Math.round(matchScore) : null,
      file,
      contentType,
      byteSize: file?.size ?? new TextEncoder().encode(text).byteLength,
    };
  }

  const body = await readJson(request);
  const text = asNonEmptyString(body.text);
  const name = asNonEmptyString(body.name) || "Resume.txt";
  const fileType = normalizeFileType(String(body.fileType || fileTypeFromName(name)));
  const templateId = normalizeResumeTemplateId(String(body.templateId || ""));
  const versionType = normalizeResumeVersionType(String(body.versionType || ""));
  const matchScore = typeof body.matchScore === "number" ? body.matchScore : Number(body.matchScore);

  return {
    name,
    fileType,
    text,
    characterCount: text.length,
    templateId,
    versionType,
    sourceResumeId: asNullableString(body.sourceResumeId),
    sourceRunId: asNullableString(body.sourceRunId),
    tailoredFor: asNullableString(body.tailoredFor),
    matchScore: Number.isFinite(matchScore) ? Math.round(matchScore) : null,
    contentType: "text/plain",
    byteSize: new TextEncoder().encode(text).byteLength,
  };
}

function json(
  body: JsonBody,
  init: ResponseInit & { headers?: Headers } = {},
): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

function mapResume(row: ResumeRow): JsonRecord {
  return {
    id: row.id,
    name: row.name,
    fileType: row.file_type,
    text: row.extracted_text,
    characterCount: row.character_count,
    uploadedAt: row.uploaded_at,
    usageCount: row.usage_count,
    isActive: row.is_active === 1,
    templateId: row.selected_template_id || "ats-simple",
    versionType: row.version_type || "base",
    sourceResumeId: row.source_resume_id,
    sourceRunId: row.source_run_id,
    tailoredFor: row.tailored_for,
    matchScore: row.match_score,
  };
}

function mapRun(row: RunRow): JsonRecord {
  return {
    id: row.id,
    title: row.title,
    resumeId: row.resume_id,
    resumeName: row.resume_name,
    jobDescription: row.job_description,
    score: row.score,
    status: row.status,
    createdAt: row.created_at,
  };
}

function normalizeFileType(value: string): "pdf" | "docx" | "text" {
  return value === "pdf" || value === "docx" || value === "text" ? value : "text";
}

function normalizeResumeTemplateId(value: string): string {
  return RESUME_TEMPLATE_IDS.has(value) ? value : "ats-simple";
}

function normalizeResumeVersionType(value: string): "base" | "tailored" {
  return RESUME_VERSION_TYPES.has(value) ? value as "base" | "tailored" : "base";
}

function contentTypeForFileType(fileType: "pdf" | "docx" | "text"): string {
  if (fileType === "pdf") return "application/pdf";
  if (fileType === "docx") {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  return "text/plain";
}

function fileTypeFromName(name: string): "pdf" | "docx" | "text" {
  const normalized = name.toLowerCase();
  if (normalized.endsWith(".pdf")) return "pdf";
  if (normalized.endsWith(".docx")) return "docx";
  return "text";
}

function sanitizeFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-") || "resume.txt";
}

function sanitizeDispositionFileName(name: string): string {
  return sanitizeFileName(name).replace(/"/g, "");
}

function asNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const text = asNonEmptyString(value);
  return text || null;
}

function deriveRunTitle(jobDescription: string): string {
  const lines = jobDescription
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 20)) {
    const prefixed = line.match(/^(job\s*title|title|position|role)\s*[:\-]\s*(.+)$/i);
    const title = cleanRunTitle(prefixed?.[2] ?? "");
    if (title) return title;
  }

  const candidate = lines.slice(0, 12).find((line) => {
    const normalized = line.toLowerCase();
    if (line.length > 86 || /[.!?]$/.test(line)) return false;
    if (JOB_TITLE_SKIP_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
    return JOB_TITLE_WORDS.some((word) => normalized.includes(word));
  });

  return cleanRunTitle(candidate ?? "") || "Untitled role";
}

function cleanRunTitle(value: string): string {
  const cleaned = value.replace(/^\W+|\W+$/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length < 3) return "";
  if (JOB_TITLE_SKIP_PREFIXES.some((prefix) => cleaned.toLowerCase().startsWith(prefix))) return "";
  return cleaned.length > 70 ? `${cleaned.slice(0, 67)}...` : cleaned;
}

function isFileLike(value: unknown): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      "name" in value &&
      "type" in value,
  );
}

function publicUser(user: UserRow): JsonRecord {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan,
    createdAt: user.created_at,
  };
}
