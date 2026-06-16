import { fetchJobPageText } from "./jobPage";
import { optimizeResume, reviseResumeSection } from "./openai";
import { normalizeStructuredResume, resumeToPlainText, scoreKeywords } from "./resume";

export interface Env {
  DB: D1Database;
  RESUME_BUCKET: R2Bucket;
  APP_ORIGIN?: string;
  APP_BASE_URL?: string;
  AUTH_DEV_MODE?: string;
  AUTH_EMAIL_FROM?: string;
  RESEND_API_KEY?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
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

type MagicLinkRow = {
  id: string;
  email: string;
  expires_at: string;
  used_at: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
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

      if (url.pathname === "/api/auth/login" && request.method === "POST") {
        return handleLogin(request, env, corsHeaders);
      }

      if (url.pathname === "/api/auth/verify" && request.method === "POST") {
        return handleVerify(request, env, corsHeaders);
      }

      if (url.pathname === "/api/auth/logout" && request.method === "POST") {
        return handleLogout(request, env, corsHeaders);
      }

      if (url.pathname === "/api/me" && request.method === "GET") {
        const session = await requireSession(request, env);
        return json({ user: publicUser(session.user) }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/resumes" && request.method === "GET") {
        return handleListResumes(request, env, corsHeaders);
      }

      if (url.pathname === "/api/resumes" && request.method === "POST") {
        return handleCreateResume(request, env, corsHeaders);
      }

      const activeResumeMatch = url.pathname.match(/^\/api\/resumes\/([^/]+)\/active$/);
      if (activeResumeMatch && request.method === "PATCH") {
        return handleSetActiveResume(request, env, corsHeaders, activeResumeMatch[1]);
      }

      const resumeMatch = url.pathname.match(/^\/api\/resumes\/([^/]+)$/);
      if (resumeMatch && request.method === "DELETE") {
        return handleDeleteResume(request, env, corsHeaders, resumeMatch[1]);
      }

      if (url.pathname === "/api/runs" && request.method === "GET") {
        return handleListRuns(request, env, corsHeaders);
      }

      if (url.pathname === "/api/runs" && request.method === "POST") {
        return handleCreateRun(request, env, corsHeaders);
      }

      const runStatusMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/status$/);
      if (runStatusMatch && request.method === "PATCH") {
        return handleUpdateRunStatus(request, env, corsHeaders, runStatusMatch[1]);
      }

      if (url.pathname === "/api/exports" && request.method === "POST") {
        return handleRecordExport(request, env, corsHeaders);
      }

      if (url.pathname === "/api/optimize" && request.method === "POST") {
        return handleOptimize(request, env, corsHeaders);
      }

      if (url.pathname === "/api/revise-section" && request.method === "POST") {
        return handleReviseSection(request, env, corsHeaders);
      }

      if (url.pathname === "/api/fetch-job-page" && request.method === "POST") {
        return handleFetchJobPage(request, corsHeaders);
      }

      return json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Worker request failed" },
        { status: 500, headers: corsHeaders },
      );
    }
  },
};

async function handleOptimize(request: Request, env: Env, headers: Headers): Promise<Response> {
  const { user } = await requireSession(request, env);
  const body = await readJson(request);
  const provider = String(body.provider || "openai");
  const jobDescription = asNonEmptyString(body.jobDescription);
  const resumeId = asNonEmptyString(body.resumeId);
  let resumeText = asNonEmptyString(body.resumeText);
  let resumeName = asNonEmptyString(body.resumeName) || "Resume";
  let usageCount = 0;

  if (provider !== "openai") {
    return json({ error: `${provider} optimization is not wired on Cloudflare yet.` }, { status: 400, headers });
  }

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

  const optimizedResume = await optimizeResume(env, { jobDescription, resumeText });
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
  const provider = String(body.provider || "openai");
  const jobDescription = asNonEmptyString(body.jobDescription);
  const instruction = asNonEmptyString(body.instruction);
  const sectionText = asNonEmptyString(body.sectionText);
  const sectionLabel = asNonEmptyString(body.sectionLabel) || "Resume section";

  if (provider !== "openai") {
    return json({ error: `${provider} section revision is not wired on Cloudflare yet.` }, { status: 400, headers });
  }

  if (!instruction) {
    return json({ error: "Add a revision instruction before submitting." }, { status: 400, headers });
  }

  if (jobDescription.length < 20 || sectionText.length < 5) {
    return json({ error: "Missing job description or section text." }, { status: 400, headers });
  }

  const revisedText = await reviseResumeSection(env, {
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
      "usage_count, is_active, uploaded_at",
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

  if (!input.name || !input.text || input.characterCount <= 0) {
    return json({ error: "Resume name and extracted text are required." }, { status: 400, headers });
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
        "(id, user_id, name, file_type, storage_key, extracted_text, character_count, is_active)",
        "values (?, ?, ?, ?, ?, ?, ?, ?)",
        "returning id, name, file_type, storage_key, extracted_text, character_count, usage_count, is_active, uploaded_at",
      ].join(" "),
    )
      .bind(
        id,
        user.id,
        input.name,
        input.fileType,
        storageKey,
        input.text,
        input.characterCount,
        isFirst ? 1 : 0,
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

async function handleDeleteResume(
  request: Request,
  env: Env,
  headers: Headers,
  resumeId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const resume = await env.DB.prepare(
    "select storage_key from resumes where user_id = ? and id = ?",
  )
    .bind(user.id, resumeId)
    .first<{ storage_key: string | null }>();

  await env.DB.prepare("delete from resumes where user_id = ? and id = ?")
    .bind(user.id, resumeId)
    .run();

  if (resume?.storage_key) {
    await env.RESUME_BUCKET.delete(resume.storage_key);
  }

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

async function handleLogin(request: Request, env: Env, headers: Headers): Promise<Response> {
  const body = await readJson(request);
  const email = normalizeEmail(body.email);

  if (!email) {
    return json({ error: "Enter a valid email address." }, { status: 400, headers });
  }

  const token = createToken();
  const tokenHash = await hashToken(token);
  const expiresAt = minutesFromNow(15);
  const id = crypto.randomUUID();

  await env.DB.prepare(
    "insert into magic_links (id, email, token_hash, expires_at) values (?, ?, ?, ?)",
  )
    .bind(id, email, tokenHash, expiresAt)
    .run();

  const link = `${env.APP_BASE_URL || env.APP_ORIGIN || "http://localhost:5173"}/settings?cf_token=${encodeURIComponent(token)}`;
  const sent = await sendMagicLinkEmail(env, email, link);
  const devMode = env.AUTH_DEV_MODE === "true" || !env.RESEND_API_KEY;

  return json(
    {
      sent,
      devLink: devMode ? link : undefined,
    },
    { headers },
  );
}

async function handleVerify(request: Request, env: Env, headers: Headers): Promise<Response> {
  const body = await readJson(request);
  const token = typeof body.token === "string" ? body.token.trim() : "";

  if (!token) {
    return json({ error: "Missing sign-in token." }, { status: 400, headers });
  }

  const tokenHash = await hashToken(token);
  const magicLink = await env.DB.prepare(
    "select id, email, expires_at, used_at from magic_links where token_hash = ?",
  )
    .bind(tokenHash)
    .first<MagicLinkRow>();

  if (!magicLink || magicLink.used_at || Date.parse(magicLink.expires_at) <= Date.now()) {
    return json({ error: "That sign-in link is expired or already used." }, { status: 401, headers });
  }

  let user = await env.DB.prepare(
    "select id, email, plan, created_at, updated_at from users where email = ?",
  )
    .bind(magicLink.email)
    .first<UserRow>();

  if (!user) {
    const userId = crypto.randomUUID();
    await env.DB.prepare("insert into users (id, email) values (?, ?)")
      .bind(userId, magicLink.email)
      .run();
    user = await env.DB.prepare(
      "select id, email, plan, created_at, updated_at from users where id = ?",
    )
      .bind(userId)
      .first<UserRow>();
  }

  if (!user) {
    throw new Error("Could not create user.");
  }

  const sessionToken = createToken();
  const sessionHash = await hashToken(sessionToken);
  const sessionId = crypto.randomUUID();
  const expiresAt = daysFromNow(30);

  await env.DB.batch([
    env.DB.prepare("update magic_links set used_at = current_timestamp where id = ?").bind(
      magicLink.id,
    ),
    env.DB.prepare(
      "insert into sessions (id, user_id, token_hash, expires_at) values (?, ?, ?, ?)",
    ).bind(sessionId, user.id, sessionHash, expiresAt),
  ]);

  return json(
    {
      sessionToken,
      user: publicUser(user),
    },
    { headers },
  );
}

async function handleLogout(request: Request, env: Env, headers: Headers): Promise<Response> {
  const token = getBearerToken(request);
  if (token) {
    await env.DB.prepare("delete from sessions where token_hash = ?")
      .bind(await hashToken(token))
      .run();
  }
  return json({ ok: true }, { headers });
}

async function requireSession(
  request: Request,
  env: Env,
): Promise<{ session: SessionRow; user: UserRow }> {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error("Sign in before continuing.");
  }

  const tokenHash = await hashToken(token);
  const row = await env.DB.prepare(
    [
      "select",
      "sessions.id as session_id, sessions.user_id, sessions.expires_at,",
      "users.id as user_id, users.email, users.plan, users.created_at, users.updated_at",
      "from sessions",
      "join users on users.id = sessions.user_id",
      "where sessions.token_hash = ?",
    ].join(" "),
  )
    .bind(tokenHash)
    .first<{
      session_id: string;
      user_id: string;
      expires_at: string;
      email: string;
      plan: string;
      created_at: string;
      updated_at: string;
    }>();

  if (!row || Date.parse(row.expires_at) <= Date.now()) {
    throw new Error("Session expired. Sign in again.");
  }

  return {
    session: {
      id: row.session_id,
      user_id: row.user_id,
      expires_at: row.expires_at,
    },
    user: {
      id: row.user_id,
      email: row.email,
      plan: row.plan,
      created_at: row.created_at,
      updated_at: row.updated_at,
    },
  };
}

function createCorsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers(defaultCorsHeaders);
  const requestOrigin = request.headers.get("Origin");
  const allowedOrigin = env.APP_ORIGIN || requestOrigin || "*";
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Vary", "Origin");
  return headers;
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
  file?: File;
  contentType: string;
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

    return {
      name,
      fileType,
      text,
      characterCount: Number(form.get("characterCount") ?? text.length),
      file,
      contentType: file?.type || "text/plain",
    };
  }

  const body = await readJson(request);
  const text = asNonEmptyString(body.text);
  const name = asNonEmptyString(body.name) || "Resume.txt";
  const fileType = normalizeFileType(String(body.fileType || fileTypeFromName(name)));

  return {
    name,
    fileType,
    text,
    characterCount: Number(body.characterCount ?? text.length),
    contentType: "text/plain",
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

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
}

function normalizeFileType(value: string): "pdf" | "docx" | "text" {
  return value === "pdf" || value === "docx" || value === "text" ? value : "text";
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

function asNonEmptyString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function deriveRunTitle(jobDescription: string): string {
  const firstLine = jobDescription
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) return "Untitled role";
  return firstLine.length > 70 ? `${firstLine.slice(0, 67)}...` : firstLine;
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

function createToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return base64Url(new Uint8Array(digest));
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function getBearerToken(request: Request): string {
  const header = request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function publicUser(user: UserRow): JsonRecord {
  return {
    id: user.id,
    email: user.email,
    plan: user.plan,
    createdAt: user.created_at,
  };
}

async function sendMagicLinkEmail(env: Env, email: string, link: string): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: env.AUTH_EMAIL_FROM || "SyncResume <noreply@syncresume.io>",
      to: email,
      subject: "Sign in to SyncResume",
      text: `Use this link to sign in to SyncResume:\n\n${link}\n\nThis link expires in 15 minutes.`,
      html: `<p>Use this link to sign in to SyncResume:</p><p><a href="${link}">Sign in</a></p><p>This link expires in 15 minutes.</p>`,
    }),
  });

  if (!response.ok) {
    throw new Error("Could not send the sign-in email.");
  }

  return true;
}
