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

      return json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Worker request failed" },
        { status: 500, headers: corsHeaders },
      );
    }
  },
};

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

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") return "";
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "";
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
