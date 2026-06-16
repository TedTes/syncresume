import { cloudflareRequest, hasCloudflareConfig } from "./cloudflare/client";
import { hasSupabaseConfig } from "./supabase/client";
import { invokeEdgeFunction } from "./supabase/functions";

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

  if (hasCloudflareConfig()) {
    const data = await cloudflareRequest<{ text?: string }>(
      "/api/fetch-job-page",
      {
        method: "POST",
        body: { url: rawUrl },
        auth: false,
      },
    );

    if (!data.text || data.text.trim().length < 150) {
      throw new Error(
        "The page returned no readable content — it may require a login. Paste the description text directly.",
      );
    }

    return data.text.trim();
  }

  if (!hasSupabaseConfig()) {
    throw new Error("Job link fetching requires a backend. Paste the description text directly.");
  }

  const data = await invokeEdgeFunction<{ text?: string }>("fetch-job-page", {
    url: rawUrl,
  });

  if (!data.text || data.text.trim().length < 150) {
    throw new Error(
      "The page returned no readable content — it may require a login. Paste the description text directly.",
    );
  }

  return data.text.trim();
}
