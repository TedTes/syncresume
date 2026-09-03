const cloudflareApiUrl = import.meta.env.VITE_CLOUDFLARE_API_URL as string | undefined;

type AuthTokenProvider = () => Promise<string | null>;

let authTokenProvider: AuthTokenProvider | null = null;

export type BillingPlanKey = "monthly" | "six_month" | "yearly";

export type BillingCheckoutPlan = {
  key: BillingPlanKey;
  label: string;
  price: string;
  cadence: string;
  savings?: string;
};

export type CloudflareUser = {
  id: string;
  email: string;
  plan: string;
  billingPlanKey?: BillingPlanKey | null;
  subscriptionStatus?: string;
  subscriptionCurrentPeriodEnd?: string | null;
  usage?: {
    period: string;
    aiActionsUsed: number;
    aiActionsLimit: number;
    aiActionsRemaining: number;
  };
  billing?: {
    checkoutEnabled: boolean;
    portalEnabled: boolean;
    currentPlanKey?: BillingPlanKey | null;
    checkoutPlans?: BillingCheckoutPlan[];
  };
  createdAt?: string;
};

export type BillingSessionResponse = {
  url: string;
};

export type ExtensionSessionResponse = {
  token: string;
  expiresInDays: number;
  label: string;
};

export type JobCaptureRecord = {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  sourceUrl: string;
  duplicateOfId?: string | null;
  createdAt?: string;
  expiresAt?: string;
};

export type JobCaptureResponse = {
  capture: JobCaptureRecord;
};

export type JobStatus = "new" | "saved" | "dismissed" | "applied";

export type JobFeedRecord = {
  id: string;
  source: string;
  externalId?: string | null;
  title: string;
  company: string;
  location: string;
  url: string;
  description: string;
  salary: string;
  employmentType: string;
  remote: string;
  status: JobStatus;
  postedAt?: string | null;
  discoveredAt?: string;
  updatedAt?: string;
};

export type JobFeedInput = {
  source?: string;
  externalId?: string | null;
  title: string;
  company?: string;
  location?: string;
  url?: string;
  description?: string;
  salary?: string;
  employmentType?: string;
  remote?: string;
  status?: JobStatus;
  postedAt?: string | null;
};

export type JobSourceProvider = "custom" | "greenhouse" | "lever" | "ashby" | "apify";

export type JobSyncCriteria = {
  targetTitles?: string[];
  location?: "any" | "remote-canada" | "remote-us";
  workType?: "any" | "remote" | "remote-hybrid";
  seniority?: "any" | "mid-senior" | "senior-staff";
  salaryFloor?: "none" | "140k" | "160k";
  sponsorship?: "any" | "not-needed" | "needed";
  dailyLimit?: number;
};

export type JobSourceConfig = {
  provider: JobSourceProvider;
  enabled?: boolean;
  limit?: number;
  source?: string;
  url?: string;
  method?: "GET" | "POST";
  headers?: Record<string, string>;
  queryParams?: Record<string, unknown>;
  body?: Record<string, unknown>;
  itemsPath?: string;
  boardToken?: string;
  company?: string;
  query?: string;
  location?: string;
  actorId?: string;
  actorTaskId?: string;
  input?: Record<string, unknown>;
  resultMapping?: Record<string, string>;
  criteria?: JobSyncCriteria;
};

export type JobsResponse = {
  jobs: JobFeedRecord[];
};

export type JobsSyncResponse = JobsResponse & {
  criteria?: JobSyncCriteria;
  sources: Array<{
    provider: JobSourceProvider;
    source: string;
    fetched: number;
  }>;
  errors: Array<{
    provider: JobSourceProvider;
    source: string;
    message: string;
  }>;
};

export type JobResponse = {
  job: JobFeedRecord;
};

export type ApplySessionRecord = {
  id: string;
  runId?: string | null;
  jobUrl: string;
  fileName: string;
  templateId: string;
  createdAt?: string;
  expiresAt?: string;
};

export type ApplySessionResponse = {
  session: ApplySessionRecord;
  token: string;
  expiresInMinutes: number;
};

export class AuthTokenUnavailableError extends Error {
  constructor() {
    super("Session token is not ready yet.");
    this.name = "AuthTokenUnavailableError";
  }
}

export function hasCloudflareConfig(): boolean {
  return Boolean(cloudflareApiUrl);
}

export function setCloudflareAuthTokenProvider(provider: AuthTokenProvider | null): void {
  authTokenProvider = provider;
}

function getCloudflareRequestUrl(path: string): string {
  if (!cloudflareApiUrl) {
    throw new Error("Cloudflare API is not configured.");
  }

  return `${cloudflareApiUrl.replace(/\/$/, "")}${path}`;
}

async function getAuthHeaders(authToken?: string): Promise<Headers> {
  const headers = new Headers();
  const token = authToken ?? (authTokenProvider ? await authTokenProvider() : null);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  } else if (authTokenProvider) {
    throw new AuthTokenUnavailableError();
  }

  return headers;
}

async function readErrorMessage(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  return payload.error ?? payload.message ?? `Request failed (${response.status}).`;
}

export async function cloudflareRequest<TResponse>(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    formData?: FormData;
    auth?: boolean;
    authToken?: string;
  } = {},
): Promise<TResponse> {
  const headers = options.auth === false ? new Headers() : await getAuthHeaders(options.authToken);

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(getCloudflareRequestUrl(path), {
    method: options.method ?? "GET",
    headers,
    body,
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json().catch(() => ({}))) as unknown;
  return payload as TResponse;
}

export async function cloudflareBlobRequest(path: string): Promise<Blob> {
  const response = await fetch(getCloudflareRequestUrl(path), {
    method: "GET",
    headers: await getAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.blob();
}

export async function cloudflareBlobPostRequest(path: string, body: Record<string, unknown>): Promise<Blob> {
  const headers = await getAuthHeaders();
  headers.set("Content-Type", "application/json");

  const response = await fetch(getCloudflareRequestUrl(path), {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  return response.blob();
}

export function createBillingCheckoutSession(plan: BillingPlanKey = "monthly"): Promise<BillingSessionResponse> {
  return cloudflareRequest<BillingSessionResponse>("/api/billing/checkout", {
    method: "POST",
    body: { plan },
  });
}

export function createBillingPortalSession(): Promise<BillingSessionResponse> {
  return cloudflareRequest<BillingSessionResponse>("/api/billing/portal", {
    method: "POST",
  });
}

export function createExtensionSession(label = "Browser extension"): Promise<ExtensionSessionResponse> {
  return cloudflareRequest<ExtensionSessionResponse>("/api/extension/sessions", {
    method: "POST",
    body: { label },
  });
}

export function getJobCapture(captureId: string): Promise<JobCaptureResponse> {
  return cloudflareRequest<JobCaptureResponse>(`/api/job-captures/${encodeURIComponent(captureId)}`);
}

export function listJobs(params: {
  status?: JobStatus;
  source?: string;
  q?: string;
  limit?: number;
} = {}): Promise<JobsResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.source) query.set("source", params.source);
  if (params.q) query.set("q", params.q);
  if (params.limit) query.set("limit", String(params.limit));
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return cloudflareRequest<JobsResponse>(`/api/jobs${suffix}`);
}

export function ingestJobs(jobs: JobFeedInput | JobFeedInput[]): Promise<JobsResponse> {
  return cloudflareRequest<JobsResponse>("/api/jobs", {
    method: "POST",
    body: {
      jobs: Array.isArray(jobs) ? jobs : [jobs],
    },
  });
}

export function syncJobs(input?: JobSourceConfig[] | { criteria?: JobSyncCriteria; sources?: JobSourceConfig[] }): Promise<JobsSyncResponse> {
  const body = Array.isArray(input) ? { sources: input } : input ?? {};

  return cloudflareRequest<JobsSyncResponse>("/api/jobs/sync", {
    method: "POST",
    body,
  });
}

export function updateJobStatus(jobId: string, status: JobStatus): Promise<JobResponse> {
  return cloudflareRequest<JobResponse>(`/api/jobs/${encodeURIComponent(jobId)}`, {
    method: "PATCH",
    body: { status },
  });
}

export function createJobCaptureFromJob(jobId: string): Promise<JobCaptureResponse & { duplicate?: boolean }> {
  return cloudflareRequest<JobCaptureResponse & { duplicate?: boolean }>(
    `/api/jobs/${encodeURIComponent(jobId)}/capture`,
    { method: "POST" },
  );
}

export function createApplySession(input: {
  runId?: string | null;
  jobUrl: string;
  fileName: string;
  templateId: string;
  html: string;
}): Promise<ApplySessionResponse> {
  return cloudflareRequest<ApplySessionResponse>("/api/apply-sessions", {
    method: "POST",
    body: {
      runId: input.runId ?? null,
      jobUrl: input.jobUrl,
      fileName: input.fileName,
      templateId: input.templateId,
      html: input.html,
    },
  });
}
