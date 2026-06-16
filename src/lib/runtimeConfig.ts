// Session-only API key override, set from the Settings page. Never written
// to localStorage/disk — it lives only in memory for this tab session and
// is lost on reload, falling back to the server/env-configured key.
let sessionApiKey = "";

export function setSessionApiKey(key: string): void {
  sessionApiKey = key.trim();
}

export function getSessionApiKey(): string {
  return sessionApiKey;
}

// TODO: Replace with a server-side proxy endpoint for production.
// For local development, set VITE_OPENAI_API_KEY in a .env file, or enter a
// key in Settings for the current session only.
export function getApiKey(): string {
  return sessionApiKey || (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) || "";
}
