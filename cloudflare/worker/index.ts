export interface Env {
  DB: D1Database;
  RESUME_BUCKET: R2Bucket;
  APP_ORIGIN?: string;
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
}

type JsonBody = Record<string, unknown> | Array<unknown>;

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

      return json({ error: "Not found" }, { status: 404, headers: corsHeaders });
    } catch (error) {
      return json(
        { error: error instanceof Error ? error.message : "Worker request failed" },
        { status: 500, headers: corsHeaders },
      );
    }
  },
};

function createCorsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers(defaultCorsHeaders);
  const requestOrigin = request.headers.get("Origin");
  const allowedOrigin = env.APP_ORIGIN || requestOrigin || "*";
  headers.set("Access-Control-Allow-Origin", allowedOrigin);
  headers.set("Vary", "Origin");
  return headers;
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
