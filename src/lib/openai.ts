export function openAIErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const message = error.message;
    const normalized = message.toLowerCase();

    if (normalized.includes("rate limit") || normalized.includes("429")) {
      return "Rate limit reached. Wait a moment, then retry.";
    }
    if (normalized.includes("timeout") || normalized.includes("timed out")) {
      return "The request timed out. Retry when the network is stable.";
    }
    if (normalized.includes("api key") || normalized.includes("401")) {
      return "Provider credentials are missing or invalid. Check the Cloudflare Worker secrets.";
    }

    return message;
  }

  return "Something went wrong. Retry the request.";
}
