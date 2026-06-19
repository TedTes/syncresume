const cloudflareApiUrl = import.meta.env.VITE_CLOUDFLARE_API_URL as string | undefined;

type AuthTokenProvider = () => Promise<string | null>;

let authTokenProvider: AuthTokenProvider | null = null;

export type CloudflareUser = {
  id: string;
  email: string;
  plan: string;
  createdAt?: string;
};

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

async function getAuthHeaders(): Promise<Headers> {
  const headers = new Headers();
  const token = authTokenProvider ? await authTokenProvider() : null;

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
  const headers = options.auth === false ? new Headers() : await getAuthHeaders();

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
