export type ClerkAuthEnv = {
  CLERK_JWKS_URL?: string;
  CLERK_ISSUER?: string;
  CLERK_AUTHORIZED_PARTIES?: string;
  APP_ORIGIN?: string;
};

export type ClerkJwtPayload = {
  sub: string;
  exp?: number;
  nbf?: number;
  iat?: number;
  iss?: string;
  azp?: string;
  email?: string;
  primary_email?: string;
  primary_email_address?: string;
};

type JwksResponse = {
  keys?: ClerkJsonWebKey[];
};

type JwtHeader = {
  alg?: string;
  kid?: string;
  typ?: string;
};

type ClerkJsonWebKey = JsonWebKey & {
  kid?: string;
};

const JWKS_CACHE_MS = 5 * 60 * 1000;
let cachedJwks: { url: string; fetchedAt: number; keys: ClerkJsonWebKey[] } | null = null;

export async function verifyClerkRequest(
  request: Request,
  env: ClerkAuthEnv,
): Promise<ClerkJwtPayload> {
  const token = getBearerToken(request);
  if (!token) {
    throw new Error("Sign in before continuing.");
  }

  return verifyClerkJwt(token, env);
}

export function getClerkEmail(payload: ClerkJwtPayload): string {
  const email = payload.email || payload.primary_email || payload.primary_email_address;
  if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return email.toLowerCase();
  }

  return `${payload.sub}@clerk.local`;
}

async function verifyClerkJwt(token: string, env: ClerkAuthEnv): Promise<ClerkJwtPayload> {
  const [encodedHeader, encodedPayload, encodedSignature] = token.split(".");
  if (!encodedHeader || !encodedPayload || !encodedSignature) {
    throw new Error("Invalid session token.");
  }

  const header = decodeJwtPart<JwtHeader>(encodedHeader);
  const payload = decodeJwtPart<ClerkJwtPayload>(encodedPayload);

  if (header.alg !== "RS256" || !header.kid) {
    throw new Error("Unsupported session token.");
  }

  if (!payload.sub) {
    throw new Error("Invalid session token subject.");
  }

  const key = await getSigningKey(env, header.kid);
  const cryptoKey = await crypto.subtle.importKey(
    "jwk",
    key,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const isValidSignature = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    decodeBase64Url(encodedSignature),
    new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
  );

  if (!isValidSignature) {
    throw new Error("Invalid session token signature.");
  }

  assertValidClaims(payload, env);
  return payload;
}

async function getSigningKey(env: ClerkAuthEnv, kid: string): Promise<ClerkJsonWebKey> {
  if (!env.CLERK_JWKS_URL) {
    throw new Error("Worker Clerk JWKS URL is not configured.");
  }

  const keys = await getJwks(env.CLERK_JWKS_URL);
  const key = keys.find((candidate) => candidate.kid === kid);
  if (!key) {
    throw new Error("No matching Clerk signing key found.");
  }

  return key;
}

async function getJwks(url: string): Promise<ClerkJsonWebKey[]> {
  if (cachedJwks && cachedJwks.url === url && Date.now() - cachedJwks.fetchedAt < JWKS_CACHE_MS) {
    return cachedJwks.keys;
  }

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Could not load Clerk signing keys.");
  }

  const payload = (await response.json()) as JwksResponse;
  const keys = payload.keys ?? [];
  cachedJwks = { url, fetchedAt: Date.now(), keys };
  return keys;
}

function assertValidClaims(payload: ClerkJwtPayload, env: ClerkAuthEnv): void {
  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp <= now) {
    throw new Error("Session expired. Sign in again.");
  }

  if (payload.nbf && payload.nbf > now + 30) {
    throw new Error("Session is not active yet.");
  }

  if (env.CLERK_ISSUER && payload.iss !== env.CLERK_ISSUER) {
    throw new Error("Session issuer is not trusted.");
  }

  const allowedParties = getAllowedParties(env);
  if (payload.azp && allowedParties.length > 0 && !allowedParties.includes(payload.azp)) {
    throw new Error("Session origin is not authorized.");
  }
}

function getAllowedParties(env: ClerkAuthEnv): string[] {
  const configured = env.CLERK_AUTHORIZED_PARTIES || env.APP_ORIGIN || "";
  return configured
    .split(",")
    .map((value) => value.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function getBearerToken(request: Request): string {
  const header = request.headers.get("Authorization") ?? "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? "";
}

function decodeJwtPart<T>(part: string): T {
  const bytes = decodeBase64Url(part);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
