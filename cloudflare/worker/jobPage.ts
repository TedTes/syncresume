const FETCH_TIMEOUT_MS = 20000;
const MAX_JOB_PAGE_BYTES = 1_500_000;

const BLOCKED_HOSTS: Array<{ match: string; hint: string }> = [
  {
    match: "linkedin.com",
    hint: "LinkedIn requires sign-in to view jobs. Open the posting, copy the full description text, and paste it into the field.",
  },
  {
    match: "glassdoor.com",
    hint: "Glassdoor may block automated access. Copy the job description text from the page and paste it here.",
  },
];

export async function fetchJobPageText(rawUrl: string): Promise<string> {
  const url = parseUrl(rawUrl);

  if (isBlockedInternalHostname(url.hostname)) {
    throw new Error("That URL cannot be fetched. Paste the job description text directly.");
  }

  for (const entry of BLOCKED_HOSTS) {
    if (url.hostname.includes(entry.match)) {
      throw new Error(entry.hint);
    }
  }

  const html = await fetchHtml(url);
  const text = extractReadableText(html);

  if (text.length < 150) {
    throw new Error("Could not extract readable job description text. Paste it directly instead.");
  }

  return text;
}

function parseUrl(rawUrl: string): URL {
  try {
    const url = new URL(rawUrl);
    if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid URL protocol.");
    return url;
  } catch {
    throw new Error("Invalid URL. Paste the job description text directly.");
  }
}

async function fetchHtml(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; SyncResumeBot/1.0; +https://syncresume.io)",
      },
    });

    if (!response.ok) {
      throw new Error("Could not reach the job page. Paste the description text directly.");
    }

    const contentLength = Number(response.headers.get("Content-Length") || 0);
    if (contentLength > MAX_JOB_PAGE_BYTES) {
      throw new Error("That page is too large to read safely. Paste the job description text directly.");
    }

    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("That URL did not return a readable job page.");
    }

    return await readTextWithLimit(response);
  } finally {
    clearTimeout(timeoutId);
  }
}

function isBlockedInternalHostname(hostname: string): boolean {
  const host = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const ipv4Parts = host.split(".").map((part) => Number(part));

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "::1" ||
    host === "0.0.0.0" ||
    host === "metadata.google.internal" ||
    host === "metadata" ||
    (!host.includes(".") && !host.includes(":"))
  ) {
    return true;
  }

  if (ipv4Parts.length === 4 && ipv4Parts.every((part) => Number.isInteger(part))) {
    const [first, second] = ipv4Parts;
    return (
      first === 10 ||
      first === 127 ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168)
    );
  }

  return false;
}

async function readTextWithLimit(response: Response): Promise<string> {
  if (!response.body) return response.text();

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;

    if (received > MAX_JOB_PAGE_BYTES) {
      await reader.cancel();
      throw new Error("That page is too large to read safely. Paste the job description text directly.");
    }

    text += decoder.decode(value, { stream: true });
  }

  return text + decoder.decode();
}

function extractReadableText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<header[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ");

  return decodeHtmlEntities(withoutNoise)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|section|article|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([a-f0-9]+);/gi, (_, code: string) =>
      String.fromCharCode(Number.parseInt(code, 16)),
    );
}
