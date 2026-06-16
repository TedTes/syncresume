import { createClient } from "https://esm.sh/@supabase/supabase-js@2.108.2";

export function createUserSupabaseClient(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const authorization = req.headers.get("Authorization") ?? "";

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase function environment is not configured.");
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: authorization,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireUserId(req: Request): Promise<{ supabase: ReturnType<typeof createUserSupabaseClient>; userId: string }> {
  const supabase = createUserSupabaseClient(req);
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("Sign in before using this function.");
  }

  return { supabase, userId: data.user.id };
}
