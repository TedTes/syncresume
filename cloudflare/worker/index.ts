import { fetchJobPageText } from "./jobPage";
import {
  generateCoverLetterWithProvider,
  normalizeLLMProvider,
  optimizeResumeWithProvider,
  reviseSectionWithProvider,
} from "./llm/dispatch";
import {
  buildResumeReviewSnapshot,
  normalizeStructuredResume,
  resumeToPlainText,
} from "./resume";
import { getClerkEmail, verifyClerkRequest } from "./auth/clerk";

type JsonBody = Record<string, unknown> | Array<unknown>;
type JsonRecord = Record<string, unknown>;

type UserRow = {
  id: string;
  email: string;
  plan: string;
  stripe_customer_id?: string | null;
  subscription_status?: string | null;
  subscription_current_period_end?: string | null;
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
  original_resume_text?: string | null;
  optimized_resume?: string | null;
  optimized_resume_text?: string | null;
  before_score?: number | null;
  matched_keywords?: string | null;
  partial_keywords?: string | null;
  missing_keywords?: string | null;
  selected_template_id?: string | null;
  tailored_resume_id?: string | null;
  cover_letter_text?: string | null;
  has_cover_letter?: number | null;
  has_review?: number | null;
  score: number;
  status: "draft" | "exported";
  created_at: string;
};

type AiActionType = "optimize_resume" | "revise_section" | "cover_letter";

type UsageSummary = {
  period: string;
  aiActionsUsed: number;
  aiActionsLimit: number;
  aiActionsRemaining: number;
};

type BillingSummary = {
  plan: string;
  subscriptionStatus: string;
  subscriptionCurrentPeriodEnd: string | null;
  usage: UsageSummary;
  checkoutEnabled: boolean;
  portalEnabled: boolean;
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
const RESUME_TEMPLATE_IDS = new Set([
  "ats-simple",
  "classic",
  "modern",
  "crisp",
  "compact",
  "minimal",
  "executive",
  "leadership",
  "editorial",
  "academic",
  "sidebar",
  "portfolio",
  "timeline",
  "metro",
  "technical",
  "product",
  "startup",
  "split",
  "typewriter",
  "gradient",
  "nordic",
  "zen",
  "deco",
  "impact",
  "stripe",
  "frost",
  "terra",
]);
const RESUME_VERSION_TYPES = new Set(["base", "tailored"]);
const BILLING_PLAN_FREE = "Free";
const BILLING_PLAN_PRO = "Pro";
const DEFAULT_FREE_AI_ACTIONS = 3;
const DEFAULT_PRO_AI_ACTIONS = 100;
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"]);
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
const JOB_TITLE_RESPONSIBILITY_PREFIXES = [
  "build ",
  "champion ",
  "collaborate ",
  "create ",
  "deliver ",
  "design ",
  "develop ",
  "drive ",
  "ensure ",
  "implement ",
  "improve ",
  "own ",
  "partner ",
  "provide ",
  "refactor ",
  "support ",
  "work ",
];
const LOW_QUALITY_JOB_TITLE_PATTERNS = [
  /^\d+\+?\s*(years?|yrs?)\b/i,
  /^\d+\s*[-–]\s*\d+\s*(years?|yrs?)\b/i,
  /\b(years?|yrs?)\s+of\s+experience\b/i,
  /\bexperience\s+(in|with|required)\b/i,
  /\bmust\s+have\b/i,
  /\breports?\s+to\b/i,
];

const defaultCorsHeaders = {
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const LOCAL_DEV_CORS_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:5177",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5176",
  "http://127.0.0.1:5177",
];

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
        const billing = await getBillingSummary(env, user);
        return json({ user: publicUser(user, billing) }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/billing/checkout" && request.method === "POST") {
        return await handleCreateBillingCheckout(request, env, corsHeaders);
      }

      if (url.pathname === "/api/billing/portal" && request.method === "POST") {
        return await handleCreateBillingPortal(request, env, corsHeaders);
      }

      if (url.pathname === "/api/stripe/webhook" && request.method === "POST") {
        return await handleStripeWebhook(request, env, corsHeaders);
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

      const resumeNameMatch = url.pathname.match(/^\/api\/resumes\/([^/]+)\/name$/);
      if (resumeNameMatch && request.method === "PATCH") {
        return await handleUpdateResumeName(request, env, corsHeaders, resumeNameMatch[1]);
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

      const runReviewMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/review$/);
      if (runReviewMatch && request.method === "PATCH") {
        return await handleUpdateRunReview(request, env, corsHeaders, runReviewMatch[1]);
      }

      const runCoverLetterMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/cover-letter$/);
      if (runCoverLetterMatch && request.method === "PATCH") {
        return await handleUpdateRunCoverLetter(request, env, corsHeaders, runCoverLetterMatch[1]);
      }

      const runTitleMatch = url.pathname.match(/^\/api\/runs\/([^/]+)\/title$/);
      if (runTitleMatch && request.method === "PATCH") {
        return await handleUpdateRunTitle(request, env, corsHeaders, runTitleMatch[1]);
      }

      const runDetailMatch = url.pathname.match(/^\/api\/runs\/([^/]+)$/);
      if (runDetailMatch && request.method === "GET") {
        return await handleGetRun(request, env, corsHeaders, runDetailMatch[1]);
      }

      if (runDetailMatch && request.method === "DELETE") {
        return await handleDeleteRun(request, env, corsHeaders, runDetailMatch[1]);
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

      if (url.pathname === "/api/generate-cover-letter" && request.method === "POST") {
        return await handleGenerateCoverLetter(request, env, corsHeaders);
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
  let templateId = "ats-simple";

  if (jobDescription.length < 20) {
    return json({ error: "Paste a complete job description before optimizing." }, { status: 400, headers });
  }

  if (resumeId) {
    const resume = await env.DB.prepare(
      "select name, extracted_text, usage_count, selected_template_id from resumes where user_id = ? and id = ?",
    )
      .bind(user.id, resumeId)
      .first<{ name: string; extracted_text: string; usage_count: number; selected_template_id: string | null }>();

    if (!resume) {
      return json({ error: "Resume not found." }, { status: 404, headers });
    }

    resumeText = resume.extracted_text;
    resumeName = resume.name;
    usageCount = resume.usage_count;
    templateId = resume.selected_template_id || templateId;
  }

  if (resumeText.length < 50) {
    return json({ error: "Upload or paste a readable resume before optimizing." }, { status: 400, headers });
  }

  await assertAiActionAllowed(env, user, "optimize_resume");

  const optimizedResume = await optimizeResumeWithProvider(env, provider, {
    jobDescription,
    resumeText,
  });
  const snapshot = buildResumeReviewSnapshot({
    jobDescription,
    originalResumeText: resumeText,
    optimizedResume,
  });
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
        [
          "(id, user_id, resume_id, resume_name, title, job_description, original_resume_text,",
          "optimized_resume, optimized_resume_text, before_score, score, matched_keywords,",
          "partial_keywords, missing_keywords, selected_template_id, status)",
        ].join(" "),
        "values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')",
        [
          "returning id, title, resume_id, resume_name, job_description, original_resume_text,",
          "optimized_resume, optimized_resume_text, before_score, score, matched_keywords,",
          "partial_keywords, missing_keywords, selected_template_id, tailored_resume_id, cover_letter_text,",
          "status, created_at",
        ].join(" "),
      ].join(" "),
    )
      .bind(
        crypto.randomUUID(),
        user.id,
        resumeId,
        resumeName,
        cleanRunTitle(asNonEmptyString(body.title)) || deriveRunTitle(jobDescription),
        jobDescription,
        resumeText,
        JSON.stringify(optimizedResume),
        snapshot.optimizedResumeText,
        snapshot.beforeScore,
        snapshot.score,
        JSON.stringify(snapshot.matchedKeywords),
        JSON.stringify(snapshot.partialKeywords),
        JSON.stringify(snapshot.missingKeywords),
        templateId,
      )
      .first<RunRow>();

    run = row ? mapRun(row) : null;
  }

  await recordAiUsage(env, user, "optimize_resume", {
    provider,
    model: getProviderModel(env, provider),
    inputChars: jobDescription.length + resumeText.length,
    outputChars: snapshot.optimizedResumeText.length,
    runId: run && typeof run.id === "string" ? run.id : null,
  });

  return json({ resume: optimizedResume, score: snapshot.score, run }, { headers });
}

async function handleReviseSection(request: Request, env: Env, headers: Headers): Promise<Response> {
  const { user } = await requireSession(request, env);
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

  await assertAiActionAllowed(env, user, "revise_section");

  const revisedText = await reviseSectionWithProvider(env, provider, {
    jobDescription,
    resume: normalizeStructuredResume(body.resume),
    sectionLabel,
    sectionText,
    instruction,
  });

  await recordAiUsage(env, user, "revise_section", {
    provider,
    model: getProviderModel(env, provider),
    inputChars: jobDescription.length + sectionText.length + instruction.length,
    outputChars: revisedText.length,
  });

  return json({ revisedText }, { headers });
}

async function handleGenerateCoverLetter(
  request: Request,
  env: Env,
  headers: Headers,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const body = await readJson(request);
  const provider = normalizeLLMProvider(String(body.provider || "openai"));
  const jobDescription = asNonEmptyString(body.jobDescription);
  const directResumeText = asNonEmptyString(body.resumeText);
  const resumeText = directResumeText || resumeToPlainText(normalizeStructuredResume(body.resume));
  const jobTitle = asNonEmptyString(body.jobTitle);
  const runId = asNonEmptyString(body.runId);

  if (jobDescription.length < 20) {
    return json(
      { error: "Add a complete job description before generating a cover letter." },
      { status: 400, headers },
    );
  }

  if (resumeText.length < MIN_RESUME_TEXT_LENGTH) {
    return json(
      { error: "A readable resume is required before generating a cover letter." },
      { status: 400, headers },
    );
  }

  await assertAiActionAllowed(env, user, "cover_letter");

  const coverLetter = await generateCoverLetterWithProvider(env, provider, {
    jobDescription,
    resumeText,
    jobTitle,
  });

  if (runId) {
    await env.DB.prepare(
      [
        "update optimization_runs",
        "set cover_letter_text = ?, updated_at = current_timestamp",
        "where user_id = ? and id = ?",
      ].join(" "),
    )
      .bind(coverLetter, user.id, runId)
      .run();
  }

  await recordAiUsage(env, user, "cover_letter", {
    provider,
    model: getProviderModel(env, provider),
    inputChars: jobDescription.length + resumeText.length + jobTitle.length,
    outputChars: coverLetter.length,
  });

  return json({ coverLetter }, { headers });
}

async function handleFetchJobPage(request: Request, headers: Headers): Promise<Response> {
  const body = await readJson(request);
  const text = await fetchJobPageText(asNonEmptyString(body.url));
  return json({ text }, { headers });
}

async function handleCreateBillingCheckout(
  request: Request,
  env: Env,
  headers: Headers,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  requireStripeRuntime(env, ["STRIPE_SECRET_KEY", "STRIPE_PRICE_ID"]);

  const customerId = await getOrCreateStripeCustomer(env, user);
  const successUrl = resolveAppUrl(env.BILLING_SUCCESS_URL, env.APP_ORIGIN, "/settings?billing=success");
  const cancelUrl = resolveAppUrl(env.BILLING_CANCEL_URL, env.APP_ORIGIN, "/settings?billing=cancelled");
  const session = await stripePost(env, "/checkout/sessions", {
    mode: "subscription",
    customer: customerId,
    "line_items[0][price]": env.STRIPE_PRICE_ID,
    "line_items[0][quantity]": "1",
    client_reference_id: user.id,
    "metadata[user_id]": user.id,
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: "true",
  });
  const url = asNonEmptyString(session.url);

  if (!url) {
    throw new HttpError("Stripe did not return a checkout URL.", 502);
  }

  return json({ url }, { headers });
}

async function handleCreateBillingPortal(
  request: Request,
  env: Env,
  headers: Headers,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  requireStripeRuntime(env, ["STRIPE_SECRET_KEY"]);

  if (!user.stripe_customer_id) {
    throw new HttpError("Upgrade before opening billing management.", 400);
  }

  const session = await stripePost(env, "/billing_portal/sessions", {
    customer: user.stripe_customer_id,
    return_url: resolveAppUrl(env.BILLING_PORTAL_RETURN_URL, env.APP_ORIGIN, "/settings"),
  });
  const url = asNonEmptyString(session.url);

  if (!url) {
    throw new HttpError("Stripe did not return a billing portal URL.", 502);
  }

  return json({ url }, { headers });
}

async function handleStripeWebhook(
  request: Request,
  env: Env,
  headers: Headers,
): Promise<Response> {
  requireStripeRuntime(env, ["STRIPE_WEBHOOK_SECRET"]);
  const payload = await request.text();
  const signature = request.headers.get("Stripe-Signature") ?? "";

  await verifyStripeSignature(payload, signature, env.STRIPE_WEBHOOK_SECRET);

  const event = JSON.parse(payload) as {
    id?: string;
    type?: string;
    data?: { object?: JsonRecord };
  };

  if (!event.id || !event.type) {
    throw new HttpError("Invalid Stripe webhook event.", 400);
  }

  const alreadyProcessed = await env.DB.prepare(
    "select id from billing_events where provider_event_id = ?",
  )
    .bind(event.id)
    .first<{ id: string }>();

  if (alreadyProcessed) {
    return json({ received: true, duplicate: true }, { headers });
  }

  await env.DB.prepare(
    "insert into billing_events (id, provider_event_id, event_type, payload) values (?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), event.id, event.type, payload)
    .run();

  await processStripeEvent(env, event.type, event.data?.object ?? {});

  return json({ received: true }, { headers });
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
    if (input.sourceRunId) {
      await env.DB.prepare(
        [
          "update optimization_runs",
          "set tailored_resume_id = ?, updated_at = current_timestamp",
          "where user_id = ? and id = ?",
        ].join(" "),
      )
        .bind(row.id, user.id, input.sourceRunId)
        .run();
    }
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
  const target = await env.DB.prepare("select id from resumes where user_id = ? and id = ?")
    .bind(user.id, resumeId)
    .first<{ id: string }>();

  if (!target) {
    return json({ error: "Resume not found." }, { status: 404, headers });
  }

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

async function handleUpdateResumeName(
  request: Request,
  env: Env,
  headers: Headers,
  resumeId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const body = await readJson(request);
  const name = asNonEmptyString(body.name);

  if (!name) {
    return json({ error: "Resume name is required." }, { status: 400, headers });
  }

  if (name.length > 160) {
    return json({ error: "Resume name must be 160 characters or fewer." }, { status: 400, headers });
  }

  const row = await env.DB.prepare(
    [
      "update resumes",
      "set name = ?, updated_at = current_timestamp",
      "where user_id = ? and id = ?",
      "returning id, name, file_type, storage_key, extracted_text, character_count, usage_count, is_active, selected_template_id, version_type, source_resume_id, source_run_id, tailored_for, match_score, uploaded_at",
    ].join(" "),
  )
    .bind(name, user.id, resumeId)
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
      "select id, title, resume_id, resume_name, job_description, score,",
      "case when optimized_resume is not null then 1 else 0 end as has_review,",
      "case when cover_letter_text is not null and length(trim(cover_letter_text)) > 0 then 1 else 0 end as has_cover_letter,",
      "tailored_resume_id, status, created_at",
      "from optimization_runs",
      "where user_id = ?",
      "order by created_at desc",
    ].join(" "),
  )
    .bind(user.id)
    .all<RunRow>();

  return json({ runs: results.map(mapRun) }, { headers });
}

async function handleGetRun(
  request: Request,
  env: Env,
  headers: Headers,
  runId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const row = await env.DB.prepare(
    [
      "select id, title, resume_id, resume_name, job_description, original_resume_text,",
      "optimized_resume, optimized_resume_text, before_score, score, matched_keywords,",
      "partial_keywords, missing_keywords, selected_template_id, tailored_resume_id, cover_letter_text,",
      "status, created_at",
      "from optimization_runs",
      "where user_id = ? and id = ?",
    ].join(" "),
  )
    .bind(user.id, runId)
    .first<RunRow>();

  if (!row) {
    return json({ error: "Run not found." }, { status: 404, headers });
  }

  return json({ run: mapRun(row) }, { headers });
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

  const normalizedTitle = cleanRunTitle(title) || deriveRunTitle(jobDescription);

  if (!resumeId || !resumeName || !normalizedTitle || !jobDescription) {
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
    .bind(id, user.id, resumeId, resumeName, normalizedTitle, jobDescription, Math.round(score), status)
    .first<RunRow>();

  if (!row) throw new Error("Could not save run.");
  return json({ run: mapRun(row) }, { headers });
}

async function handleUpdateRunTitle(
  request: Request,
  env: Env,
  headers: Headers,
  runId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const body = await readJson(request);
  const title = normalizeManualRunTitle(body.title);

  if (!title) {
    return json({ error: "Role name is required." }, { status: 400, headers });
  }

  const row = await env.DB.prepare(
    [
      "update optimization_runs",
      "set title = ?, updated_at = current_timestamp",
      "where user_id = ? and id = ?",
      [
        "returning id, title, resume_id, resume_name, job_description, original_resume_text,",
        "optimized_resume, optimized_resume_text, before_score, score, matched_keywords,",
        "partial_keywords, missing_keywords, selected_template_id, tailored_resume_id, cover_letter_text,",
        "status, created_at",
      ].join(" "),
    ].join(" "),
  )
    .bind(title, user.id, runId)
    .first<RunRow>();

  if (!row) {
    return json({ error: "Run not found." }, { status: 404, headers });
  }

  if (row.tailored_resume_id) {
    await env.DB.prepare(
      [
        "update resumes",
        "set name = ?, tailored_for = ?, updated_at = current_timestamp",
        "where user_id = ? and id = ? and version_type = 'tailored'",
      ].join(" "),
    )
      .bind(formatTailoredResumeVersionName(title, row.created_at), title, user.id, row.tailored_resume_id)
      .run();
  }

  return json({ run: mapRun(row) }, { headers });
}

async function handleUpdateRunReview(
  request: Request,
  env: Env,
  headers: Headers,
  runId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const body = await readJson(request);
  const existing = await env.DB.prepare(
    [
      "select id, title, resume_id, resume_name, job_description, original_resume_text,",
      "selected_template_id from optimization_runs where user_id = ? and id = ?",
    ].join(" "),
  )
    .bind(user.id, runId)
    .first<RunRow>();

  if (!existing) {
    return json({ error: "Run not found." }, { status: 404, headers });
  }

  const optimizedResume = normalizeStructuredResume(body.resume);
  const jobDescription = asNonEmptyString(body.jobDescription) || existing.job_description;
  const originalResumeText = asNonEmptyString(body.originalResumeText) || existing.original_resume_text || "";
  const templateId = normalizeResumeTemplateId(
    asNonEmptyString(body.templateId) || existing.selected_template_id || "",
  );
  const snapshot = buildResumeReviewSnapshot({
    jobDescription,
    originalResumeText,
    optimizedResume,
  });

  if (jobDescription.length < 20) {
    return json({ error: "Job description is required before saving review changes." }, { status: 400, headers });
  }

  if (snapshot.optimizedResumeText.length < MIN_RESUME_TEXT_LENGTH) {
    return json({ error: "Optimized resume content is too short to save." }, { status: 400, headers });
  }

  const row = await env.DB.prepare(
    [
      "update optimization_runs",
      [
        "set job_description = ?, original_resume_text = ?, optimized_resume = ?,",
        "optimized_resume_text = ?, before_score = ?, score = ?, matched_keywords = ?,",
        "partial_keywords = ?, missing_keywords = ?, selected_template_id = ?,",
        "updated_at = current_timestamp",
      ].join(" "),
      "where user_id = ? and id = ?",
      [
        "returning id, title, resume_id, resume_name, job_description, original_resume_text,",
        "optimized_resume, optimized_resume_text, before_score, score, matched_keywords,",
        "partial_keywords, missing_keywords, selected_template_id, tailored_resume_id, cover_letter_text,",
        "status, created_at",
      ].join(" "),
    ].join(" "),
  )
    .bind(
      jobDescription,
      originalResumeText,
      JSON.stringify(optimizedResume),
      snapshot.optimizedResumeText,
      snapshot.beforeScore,
      snapshot.score,
      JSON.stringify(snapshot.matchedKeywords),
      JSON.stringify(snapshot.partialKeywords),
      JSON.stringify(snapshot.missingKeywords),
      templateId,
      user.id,
      runId,
    )
    .first<RunRow>();

  if (!row) throw new Error("Could not save review changes.");
  return json({ run: mapRun(row) }, { headers });
}

async function handleUpdateRunCoverLetter(
  request: Request,
  env: Env,
  headers: Headers,
  runId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const body = await readJson(request);
  const coverLetterText = String(body.coverLetterText ?? "").replace(/\r/g, "").trim();

  if (coverLetterText.length > 15000) {
    return json({ error: "Cover letter must be 15,000 characters or fewer." }, { status: 400, headers });
  }

  const row = await env.DB.prepare(
    [
      "update optimization_runs",
      "set cover_letter_text = ?, updated_at = current_timestamp",
      "where user_id = ? and id = ?",
      [
        "returning id, title, resume_id, resume_name, job_description, original_resume_text,",
        "optimized_resume, optimized_resume_text, before_score, score, matched_keywords,",
        "partial_keywords, missing_keywords, selected_template_id, tailored_resume_id, cover_letter_text,",
        "status, created_at",
      ].join(" "),
    ].join(" "),
  )
    .bind(coverLetterText, user.id, runId)
    .first<RunRow>();

  if (!row) {
    return json({ error: "Run not found." }, { status: 404, headers });
  }

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

async function handleDeleteRun(
  request: Request,
  env: Env,
  headers: Headers,
  runId: string,
): Promise<Response> {
  const { user } = await requireSession(request, env);
  const run = await env.DB.prepare(
    "select id, tailored_resume_id from optimization_runs where user_id = ? and id = ?",
  )
    .bind(user.id, runId)
    .first<{ id: string; tailored_resume_id: string | null }>();

  if (!run) {
    return json({ error: "Application not found." }, { status: 404, headers });
  }

  const generatedResumes = await env.DB.prepare(
    [
      "select id, storage_key, is_active",
      "from resumes",
      "where user_id = ? and version_type = 'tailored'",
      "and (source_run_id = ? or id = ?)",
    ].join(" "),
  )
    .bind(user.id, runId, run.tailored_resume_id)
    .all<{ id: string; storage_key: string | null; is_active: number }>();

  const deletedActiveResume = generatedResumes.results.some((resume) => resume.is_active === 1);

  await env.DB.batch([
    env.DB.prepare("delete from optimization_runs where user_id = ? and id = ?").bind(user.id, runId),
    env.DB.prepare(
      [
        "delete from resumes",
        "where user_id = ? and version_type = 'tailored'",
        "and (source_run_id = ? or id = ?)",
      ].join(" "),
    ).bind(user.id, runId, run.tailored_resume_id),
  ]);

  await Promise.all(
    generatedResumes.results
      .map((resume) => resume.storage_key)
      .filter((storageKey): storageKey is string => Boolean(storageKey))
      .map((storageKey) => env.RESUME_BUCKET.delete(storageKey)),
  );

  if (deletedActiveResume) {
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
  let claims;
  try {
    claims = await verifyClerkRequest(request, env);
  } catch (error) {
    throw new HttpError(error instanceof Error ? error.message : "Sign in before continuing.", 401);
  }

  const email = getClerkEmail(claims);
  const user = await findOrCreateUser(env, claims.sub, email);
  return { user };
}

async function findOrCreateUser(env: Env, clerkUserId: string, email: string): Promise<UserRow> {
  const userColumns = [
    "id, email, plan, stripe_customer_id, subscription_status,",
    "subscription_current_period_end, created_at, updated_at",
  ].join(" ");
  let user = await env.DB.prepare(
    `select ${userColumns} from users where email = ?`,
  )
    .bind(email)
    .first<UserRow>();

  if (!user) {
    user = await env.DB.prepare(
      `select ${userColumns} from users where id = ?`,
    )
      .bind(clerkUserId)
      .first<UserRow>();
  }

  if (!user) {
    await env.DB.prepare("insert into users (id, email) values (?, ?)")
      .bind(clerkUserId, email)
      .run();
    user = await env.DB.prepare(
      `select ${userColumns} from users where id = ?`,
    )
      .bind(clerkUserId)
      .first<UserRow>();
  }

  if (!user) {
    throw new Error("Could not create user.");
  }

  return user;
}

async function getBillingSummary(env: Env, user: UserRow): Promise<BillingSummary> {
  const plan = resolveEffectivePlan(user);
  const usage = await getUsageSummary(env, user.id, plan);

  return {
    plan,
    subscriptionStatus: user.subscription_status || (plan === BILLING_PLAN_PRO ? "active" : "free"),
    subscriptionCurrentPeriodEnd: user.subscription_current_period_end ?? null,
    usage,
    checkoutEnabled: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_PRICE_ID),
    portalEnabled: Boolean(env.STRIPE_SECRET_KEY && user.stripe_customer_id),
  };
}

async function getUsageSummary(env: Env, userId: string, plan: string): Promise<UsageSummary> {
  const period = getCurrentBillingPeriod();
  const limit = await getMonthlyAiActionLimit(env, plan);
  const row = await env.DB.prepare(
    [
      "select coalesce(sum(request_units), 0) as used",
      "from usage_ledger",
      "where user_id = ? and billing_period = ?",
    ].join(" "),
  )
    .bind(userId, period)
    .first<{ used: number | null }>()
    .catch(() => null);
  const used = Math.max(0, Number(row?.used ?? 0));

  return {
    period,
    aiActionsUsed: used,
    aiActionsLimit: limit,
    aiActionsRemaining: Math.max(0, limit - used),
  };
}

async function getMonthlyAiActionLimit(env: Env, plan: string): Promise<number> {
  const fallback = plan === BILLING_PLAN_PRO ? DEFAULT_PRO_AI_ACTIONS : DEFAULT_FREE_AI_ACTIONS;
  const row = await env.DB.prepare("select monthly_ai_actions from usage_limits where plan = ?")
    .bind(plan)
    .first<{ monthly_ai_actions: number }>()
    .catch(() => null);
  const limit = Number(row?.monthly_ai_actions ?? fallback);
  return Number.isFinite(limit) && limit > 0 ? limit : fallback;
}

async function assertAiActionAllowed(
  env: Env,
  user: UserRow,
  actionType: AiActionType,
): Promise<void> {
  const plan = resolveEffectivePlan(user);
  const usage = await getUsageSummary(env, user.id, plan);

  if (usage.aiActionsRemaining <= 0) {
    const label = aiActionLabel(actionType);
    throw new HttpError(
      `Monthly ${label} limit reached for the ${plan} plan. Upgrade to Pro to continue.`,
      402,
    );
  }
}

async function recordAiUsage(
  env: Env,
  user: UserRow,
  actionType: AiActionType,
  details: {
    provider: string;
    model?: string;
    inputChars?: number;
    outputChars?: number;
    runId?: string | null;
  },
): Promise<void> {
  await env.DB.prepare(
    [
      "insert into usage_ledger",
      "(id, user_id, action_type, provider, model, request_units, input_chars, output_chars, run_id, billing_period)",
      "values (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)",
    ].join(" "),
  )
    .bind(
      crypto.randomUUID(),
      user.id,
      actionType,
      details.provider,
      details.model ?? null,
      Math.max(0, Math.round(details.inputChars ?? 0)),
      Math.max(0, Math.round(details.outputChars ?? 0)),
      details.runId ?? null,
      getCurrentBillingPeriod(),
    )
    .run();
}

function resolveEffectivePlan(user: UserRow): string {
  const plan = normalizeBillingPlan(user.plan);
  const status = (user.subscription_status ?? "").toLowerCase();

  if (status && status !== "free") {
    return plan === BILLING_PLAN_PRO && ACTIVE_SUBSCRIPTION_STATUSES.has(status)
      ? BILLING_PLAN_PRO
      : BILLING_PLAN_FREE;
  }

  return plan;
}

function normalizeBillingPlan(plan: string | null | undefined): string {
  return String(plan ?? "").toLowerCase() === "pro" ? BILLING_PLAN_PRO : BILLING_PLAN_FREE;
}

function getCurrentBillingPeriod(date = new Date()): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function aiActionLabel(actionType: AiActionType): string {
  if (actionType === "cover_letter") return "cover letter";
  if (actionType === "revise_section") return "AI revision";
  return "resume optimization";
}

function getProviderModel(env: Env, provider: string): string {
  const llmEnv = env as Env & { ANTHROPIC_MODEL?: string; GEMINI_MODEL?: string };
  if (provider === "openai") return env.OPENAI_MODEL || "gpt-5.4-mini";
  if (provider === "anthropic") return llmEnv.ANTHROPIC_MODEL || "anthropic";
  if (provider === "gemini") return llmEnv.GEMINI_MODEL || "gemini";
  return provider;
}

async function getOrCreateStripeCustomer(env: Env, user: UserRow): Promise<string> {
  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  const customer = await stripePost(env, "/customers", {
    email: user.email,
    "metadata[user_id]": user.id,
  });
  const customerId = asNonEmptyString(customer.id);

  if (!customerId) {
    throw new HttpError("Stripe did not return a customer id.", 502);
  }

  await env.DB.prepare(
    "update users set stripe_customer_id = ?, updated_at = current_timestamp where id = ?",
  )
    .bind(customerId, user.id)
    .run();
  user.stripe_customer_id = customerId;

  return customerId;
}

async function processStripeEvent(env: Env, eventType: string, object: JsonRecord): Promise<void> {
  if (eventType === "checkout.session.completed") {
    const userId = getString(object.client_reference_id) || getMetadataValue(object, "user_id");
    const customerId = getString(object.customer);

    if (userId && customerId) {
      await env.DB.prepare(
        [
          "update users",
          "set stripe_customer_id = ?, plan = ?, subscription_status = ?, updated_at = current_timestamp",
          "where id = ?",
        ].join(" "),
      )
        .bind(customerId, BILLING_PLAN_PRO, "active", userId)
        .run();
    }
    return;
  }

  if (eventType === "customer.subscription.updated" || eventType === "customer.subscription.deleted") {
    await syncStripeSubscription(env, object);
  }
}

async function syncStripeSubscription(env: Env, object: JsonRecord): Promise<void> {
  const stripeSubscriptionId = getString(object.id);
  const stripeCustomerId = getString(object.customer);
  const status = getString(object.status) || "unknown";
  const userIdFromMetadata = getMetadataValue(object, "user_id");
  const currentPeriodEnd = stripeTimestampToIso(object.current_period_end);
  const cancelAtPeriodEnd = Boolean(object.cancel_at_period_end) ? 1 : 0;

  if (!stripeSubscriptionId || !stripeCustomerId) return;

  let userId = userIdFromMetadata;
  if (!userId) {
    const user = await env.DB.prepare("select id from users where stripe_customer_id = ?")
      .bind(stripeCustomerId)
      .first<{ id: string }>();
    userId = user?.id ?? "";
  }

  if (!userId) return;

  await env.DB.prepare(
    [
      "insert into subscriptions",
      [
        "(id, user_id, stripe_customer_id, stripe_subscription_id, plan, status,",
        "current_period_end, cancel_at_period_end)",
      ].join(" "),
      "values (?, ?, ?, ?, ?, ?, ?, ?)",
      "on conflict(stripe_subscription_id) do update set",
      [
        "status = excluded.status,",
        "current_period_end = excluded.current_period_end,",
        "cancel_at_period_end = excluded.cancel_at_period_end,",
        "updated_at = current_timestamp",
      ].join(" "),
    ].join(" "),
  )
    .bind(
      crypto.randomUUID(),
      userId,
      stripeCustomerId,
      stripeSubscriptionId,
      BILLING_PLAN_PRO,
      status,
      currentPeriodEnd,
      cancelAtPeriodEnd,
    )
    .run();

  const plan = ACTIVE_SUBSCRIPTION_STATUSES.has(status.toLowerCase())
    ? BILLING_PLAN_PRO
    : BILLING_PLAN_FREE;
  await env.DB.prepare(
    [
      "update users",
      [
        "set stripe_customer_id = ?, plan = ?, subscription_status = ?,",
        "subscription_current_period_end = ?, updated_at = current_timestamp",
      ].join(" "),
      "where id = ?",
    ].join(" "),
  )
    .bind(stripeCustomerId, plan, status, currentPeriodEnd, userId)
    .run();
}

function requireStripeRuntime(env: Env, keys: Array<keyof Env>): void {
  const missing = keys.filter((key) => !env[key]);
  if (missing.length) {
    throw new HttpError(`${missing.join(", ")} is not configured.`, 500);
  }
}

async function stripePost(
  env: Env,
  path: string,
  fields: Record<string, string | number | boolean | null | undefined>,
): Promise<JsonRecord> {
  const body = new URLSearchParams();
  Object.entries(fields).forEach(([key, value]) => {
    if (value !== null && value !== undefined && String(value) !== "") {
      body.set(key, String(value));
    }
  });

  const response = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = (await response.json().catch(() => ({}))) as JsonRecord & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new HttpError(payload.error?.message || "Stripe request failed.", 502);
  }

  return payload;
}

async function verifyStripeSignature(
  payload: string,
  signatureHeader: string,
  webhookSecret: string,
): Promise<void> {
  const parts = Object.fromEntries(
    signatureHeader
      .split(",")
      .map((part) => part.split("="))
      .filter(([key, value]) => key && value),
  );
  const timestamp = parts.t;
  const signature = parts.v1;

  if (!timestamp || !signature) {
    throw new HttpError("Missing Stripe signature.", 400);
  }

  const signedPayload = `${timestamp}.${payload}`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(signedPayload));
  const expected = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  if (!constantTimeEqual(expected, signature)) {
    throw new HttpError("Invalid Stripe signature.", 400);
  }
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

function resolveAppUrl(configured: string | undefined, appOrigin: string, fallbackPath: string): string {
  if (configured) return configured;
  return new URL(fallbackPath, appOrigin).toString();
}

function stripeTimestampToIso(value: unknown): string | null {
  const seconds = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return new Date(seconds * 1000).toISOString();
}

function getString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function getMetadataValue(object: JsonRecord, key: string): string {
  const metadata = object.metadata;
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return "";
  const value = (metadata as JsonRecord)[key];
  return typeof value === "string" ? value : "";
}

function createCorsHeaders(request: Request, env: Env): Headers {
  const headers = new Headers(defaultCorsHeaders);
  const requestOrigin = normalizeOrigin(request.headers.get("Origin") ?? "");
  const allowedOrigins = getAllowedCorsOrigins(env);
  const allowedOrigin = requestOrigin
    ? allowedOrigins.includes(requestOrigin)
      ? requestOrigin
      : ""
    : allowedOrigins[0] || "*";

  if (allowedOrigin) {
    headers.set("Access-Control-Allow-Origin", allowedOrigin);
  }
  headers.set("Vary", "Origin");
  return headers;
}

function getAllowedCorsOrigins(env: Env): string[] {
  const appBaseUrl = (env as Env & { APP_BASE_URL?: string }).APP_BASE_URL;
  return [env.APP_ORIGIN, appBaseUrl, env.CLERK_AUTHORIZED_PARTIES, ...LOCAL_DEV_CORS_ORIGINS]
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
  const run: JsonRecord = {
    id: row.id,
    title: row.title,
    resumeId: row.resume_id,
    resumeName: row.resume_name,
    jobDescription: row.job_description,
    score: row.score,
    status: row.status,
    createdAt: row.created_at,
    hasReview: row.has_review === 1 || Boolean(row.optimized_resume),
    hasCoverLetter: row.has_cover_letter === 1 || Boolean(row.cover_letter_text),
  };

  if (row.original_resume_text !== undefined) {
    run.originalResumeText = row.original_resume_text ?? "";
  }
  if (row.optimized_resume !== undefined) {
    run.optimizedResume = parseStructuredResumeSnapshot(row.optimized_resume);
  }
  if (row.optimized_resume_text !== undefined) {
    run.optimizedResumeText = row.optimized_resume_text ?? "";
  }
  if (row.before_score !== undefined) {
    run.beforeScore = row.before_score ?? 0;
  }
  if (row.matched_keywords !== undefined) {
    run.matchedKeywords = parseStringArray(row.matched_keywords);
  }
  if (row.partial_keywords !== undefined) {
    run.partialKeywords = parseStringArray(row.partial_keywords);
  }
  if (row.missing_keywords !== undefined) {
    run.missingKeywords = parseStringArray(row.missing_keywords);
  }
  if (row.selected_template_id !== undefined) {
    run.templateId = row.selected_template_id || "ats-simple";
  }
  if (row.tailored_resume_id !== undefined) {
    run.tailoredResumeId = row.tailored_resume_id;
  }
  if (row.cover_letter_text !== undefined) {
    run.coverLetterText = row.cover_letter_text ?? "";
    run.hasCoverLetter = Boolean(row.cover_letter_text?.trim());
  }

  return run;
}

function parseStructuredResumeSnapshot(value: string | null | undefined): JsonRecord | null {
  if (!value) return null;
  try {
    return normalizeStructuredResume(JSON.parse(value)) as unknown as JsonRecord;
  } catch {
    return null;
  }
}

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
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

    const headerTitle = extractHeaderRunTitle(line);
    if (headerTitle) return headerTitle;
  }

  const candidate = lines.slice(0, 12).find((line) => {
    const normalized = line.toLowerCase();
    if (line.length > 86 || /[.!?]$/.test(line)) return false;
    if (JOB_TITLE_SKIP_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
    if (JOB_TITLE_RESPONSIBILITY_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
    if (LOW_QUALITY_JOB_TITLE_PATTERNS.some((pattern) => pattern.test(line))) return false;
    return JOB_TITLE_WORDS.some((word) => normalized.includes(word));
  });

  return cleanRunTitle(candidate ?? "") || "Untitled role";
}

function cleanRunTitle(value: string): string {
  const cleaned = value.replace(/^\W+|\W+$/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length < 3) return "";
  if (cleaned.toLowerCase() === "untitled role") return "";
  if (JOB_TITLE_SKIP_PREFIXES.some((prefix) => cleaned.toLowerCase().startsWith(prefix))) return "";
  if (LOW_QUALITY_JOB_TITLE_PATTERNS.some((pattern) => pattern.test(cleaned))) return "";
  return cleaned.length > 70 ? `${cleaned.slice(0, 67)}...` : cleaned;
}

function extractHeaderRunTitle(line: string): string {
  const normalized = line.toLowerCase();
  if (line.length > 110 || /[.!?]$/.test(line)) return "";
  if (JOB_TITLE_SKIP_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return "";
  if (JOB_TITLE_RESPONSIBILITY_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return "";
  if (LOW_QUALITY_JOB_TITLE_PATTERNS.some((pattern) => pattern.test(line))) return "";
  if (!JOB_TITLE_WORDS.some((word) => normalized.includes(word))) return "";

  const firstSegment = line.split(/\s+(?:[-–—|]|at)\s+/i)[0] ?? "";
  return cleanRunTitle(firstSegment) || cleanRunTitle(line);
}

function normalizeManualRunTitle(value: unknown): string {
  const cleaned = asNonEmptyString(value).replace(/^\W+|\W+$/g, "").replace(/\s+/g, " ").trim();
  if (!cleaned || cleaned.length < 3) return "";
  return cleaned.length > 90 ? `${cleaned.slice(0, 87)}...` : cleaned;
}

function formatTailoredResumeVersionName(title: string, isoDate: string): string {
  const date = new Date(isoDate);
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][
    date.getUTCMonth()
  ] ?? "Date";
  const day = Number.isFinite(date.getUTCDate()) ? date.getUTCDate() : "";
  return `Resume - ${title} - ${month}${day ? ` ${day}` : ""}`;
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

function publicUser(user: UserRow, billing?: BillingSummary): JsonRecord {
  return {
    id: user.id,
    email: user.email,
    plan: billing?.plan ?? user.plan,
    subscriptionStatus: billing?.subscriptionStatus ?? user.subscription_status ?? "free",
    subscriptionCurrentPeriodEnd:
      billing?.subscriptionCurrentPeriodEnd ?? user.subscription_current_period_end ?? null,
    usage: billing?.usage,
    billing: billing
      ? {
          checkoutEnabled: billing.checkoutEnabled,
          portalEnabled: billing.portalEnabled,
        }
      : undefined,
    createdAt: user.created_at,
  };
}
