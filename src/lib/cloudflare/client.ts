const cloudflareApiUrl = import.meta.env.VITE_CLOUDFLARE_API_URL as string | undefined;
const SESSION_KEY = "syncresume.cloudflare.session.v1";

export type CloudflareUser = {
  id: string;
  email: string;
  plan: string;
  createdAt?: string;
};

export function hasCloudflareConfig(): boolean {
  return Boolean(cloudflareApiUrl);
}

export function getCloudflareSessionToken(): string {
  return window.localStorage.getItem(SESSION_KEY) ?? "";
}

export function setCloudflareSessionToken(token: string): void {
  window.localStorage.setItem(SESSION_KEY, token);
}

export function clearCloudflareSessionToken(): void {
  window.localStorage.removeItem(SESSION_KEY);
}

function getCloudflareRequestUrl(path: string): string {
  if (!cloudflareApiUrl) {
    throw new Error("Cloudflare API is not configured.");
  }

  return `${cloudflareApiUrl.replace(/\/$/, "")}${path}`;
}

function getAuthHeaders(): Headers {
  const headers = new Headers();
  const token = getCloudflareSessionToken();

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
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
  } = {},
): Promise<TResponse> {
  const headers = options.auth === false ? new Headers() : getAuthHeaders();

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
    if (response.status === 401) {
      clearCloudflareSessionToken();
    }
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json().catch(() => ({}))) as unknown;
  return payload as TResponse;
}

export async function cloudflareBlobRequest(path: string): Promise<Blob> {
  const response = await fetch(getCloudflareRequestUrl(path), {
    method: "GET",
    headers: getAuthHeaders(),
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearCloudflareSessionToken();
    }
    throw new Error(await readErrorMessage(response));
  }

  return response.blob();
}
