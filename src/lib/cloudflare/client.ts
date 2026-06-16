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

export async function cloudflareRequest<TResponse>(
  path: string,
  options: {
    method?: string;
    body?: Record<string, unknown>;
    formData?: FormData;
    auth?: boolean;
  } = {},
): Promise<TResponse> {
  if (!cloudflareApiUrl) {
    throw new Error("Cloudflare API is not configured.");
  }

  const headers = new Headers();
  const token = getCloudflareSessionToken();

  if (options.auth !== false && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  let body: BodyInit | undefined;
  if (options.formData) {
    body = options.formData;
  } else if (options.body) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`${cloudflareApiUrl.replace(/\/$/, "")}${path}`, {
    method: options.method ?? "GET",
    headers,
    body,
  });

  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.error ?? payload.message ?? `Request failed (${response.status}).`);
  }

  return payload as TResponse;
}
