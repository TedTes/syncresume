type AllOriginsResponse = {
  contents?: string;
};

const ALLORIGINS_BASE = "https://api.allorigins.win/get";
const FETCH_TIMEOUT_MS = 20000;

// Sites that block automated fetching — give a precise hint before even trying.
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
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Invalid URL. Paste the job description text directly.");
  }

  for (const entry of BLOCKED_HOSTS) {
    if (url.hostname.includes(entry.match)) {
      throw new Error(entry.hint);
    }
  }

  const proxyUrl = `${ALLORIGINS_BASE}?url=${encodeURIComponent(rawUrl)}`;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(proxyUrl, { signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Fetch timed out. Paste the job description text directly.");
    }
    throw new Error("Network error — check your connection.");
  } finally {
    window.clearTimeout(timer);
  }

  if (!response.ok) {
    throw new Error("Could not reach the job page. Paste the description text directly.");
  }

  const data = (await response.json().catch(() => ({}))) as AllOriginsResponse;

  if (!data.contents || data.contents.trim().length < 200) {
    throw new Error(
      "The page returned no readable content — it may require a login. Paste the description text directly.",
    );
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(data.contents, "text/html");

  for (const el of doc.querySelectorAll(
    "script, style, noscript, header, footer, nav, iframe, img, [role='banner'], [role='navigation']",
  )) {
    el.remove();
  }

  const rawText = doc.body?.innerText ?? doc.body?.textContent ?? "";
  const cleaned = rawText
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (cleaned.length < 150) {
    throw new Error(
      "Could not extract readable job description text. Paste it directly instead.",
    );
  }

  return cleaned;
}
