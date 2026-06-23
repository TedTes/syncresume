const cloudflareApiUrl = import.meta.env.VITE_CLOUDFLARE_API_URL as string | undefined;

type AuthTokenProvider = () => Promise<string | null>;

let authTokenProvider: AuthTokenProvider | null = null;

export type CloudflareUser = {
  id: string;
  email: string;
  plan: string;
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
  };
  createdAt?: string;
};

export type BillingSessionResponse = {
  url: string;
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

export function createBillingCheckoutSession(): Promise<BillingSessionResponse> {
  return cloudflareRequest<BillingSessionResponse>("/api/billing/checkout", {
    method: "POST",
  });
}

export function createBillingPortalSession(): Promise<BillingSessionResponse> {
  return cloudflareRequest<BillingSessionResponse>("/api/billing/portal", {
    method: "POST",
  });
}
