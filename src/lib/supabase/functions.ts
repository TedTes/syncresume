import { getSupabaseClient } from "./client";

export async function invokeEdgeFunction<TResponse>(
  name: string,
  body: Record<string, unknown>,
): Promise<TResponse> {
  const { data, error } = await getSupabaseClient().functions.invoke<TResponse>(name, {
    body,
  });

  if (error) {
    throw new Error(await edgeFunctionErrorMessage(error));
  }

  if (!data) {
    throw new Error("The backend returned an empty response.");
  }

  return data;
}

async function edgeFunctionErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown }).context;

  if (context instanceof Response) {
    const payload = (await context
      .clone()
      .json()
      .catch(() => null)) as { error?: string; message?: string } | null;
    return payload?.error ?? payload?.message ?? `Backend request failed (${context.status}).`;
  }

  return error instanceof Error ? error.message : "Backend request failed.";
}
