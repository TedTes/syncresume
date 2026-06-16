const FETCH_TIMEOUT_MS = 20000;

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

    const contentType = response.headers.get("Content-Type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("text/plain")) {
      throw new Error("That URL did not return a readable job page.");
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
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
