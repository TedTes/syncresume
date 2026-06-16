import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  clearCloudflareSessionToken,
  cloudflareRequest,
  getCloudflareSessionToken,
  hasCloudflareConfig,
  setCloudflareSessionToken,
  type CloudflareUser,
} from "../lib/cloudflare/client";
import { getSupabaseClient, hasSupabaseConfig } from "../lib/supabase/client";
import type { Database } from "../lib/supabase/database.types";

type SupabaseProfile = Database["public"]["Tables"]["profiles"]["Row"];
type AuthProviderKind = "cloudflare" | "supabase" | "local";
type AuthUser = (Pick<User, "id" | "email"> & { plan?: string }) | CloudflareUser;
type Profile = Pick<SupabaseProfile, "id" | "email" | "plan">;
type AuthSession = Session | { provider: "cloudflare"; token: string } | null;

type AuthContextValue = {
  isConfigured: boolean;
  isLoading: boolean;
  provider: AuthProviderKind;
  user: AuthUser | null;
  session: AuthSession;
  profile: Profile | null;
  authError: string | null;
  signInWithEmail: (email: string) => Promise<string | void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Authentication request failed.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const provider: AuthProviderKind = hasCloudflareConfig()
    ? "cloudflare"
    : hasSupabaseConfig()
      ? "supabase"
      : "local";
  const isConfigured = provider !== "local";
  const [session, setSession] = useState<AuthSession>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(isConfigured);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    if (provider === "cloudflare") {
      let active = true;
      const params = new URLSearchParams(window.location.search);
      const magicToken = params.get("cf_token");
      const existingToken = getCloudflareSessionToken();

      async function loadCloudflareSession() {
        try {
          if (magicToken) {
            const data = await cloudflareRequest<{ sessionToken: string; user: CloudflareUser }>(
              "/api/auth/verify",
              {
                method: "POST",
                body: { token: magicToken },
                auth: false,
              },
            );
            setCloudflareSessionToken(data.sessionToken);
            if (active) {
              setSession({ provider: "cloudflare", token: data.sessionToken });
              setUser(data.user);
              setProfile({ id: data.user.id, email: data.user.email, plan: data.user.plan });
            }
            params.delete("cf_token");
            const nextQuery = params.toString();
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`,
            );
            return;
          }

          if (existingToken) {
            const data = await cloudflareRequest<{ user: CloudflareUser }>("/api/me");
            if (active) {
              setSession({ provider: "cloudflare", token: existingToken });
              setUser(data.user);
              setProfile({ id: data.user.id, email: data.user.email, plan: data.user.plan });
            }
          }
        } catch (error) {
          clearCloudflareSessionToken();
          if (active) setAuthError(getErrorMessage(error));
        } finally {
          if (active) setIsLoading(false);
        }
      }

      void loadCloudflareSession();

      return () => {
        active = false;
      };
    }

    let active = true;
    const supabase = getSupabaseClient();

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) setAuthError(error.message);
        setSession(data.session);
        setUser(data.session?.user ?? null);
      })
      .catch((error: unknown) => {
        if (active) setAuthError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setAuthError(null);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [isConfigured, provider]);

  const refreshProfile = useCallback(async () => {
    if (!isConfigured || !user) {
      setProfile(null);
      return;
    }

    if (provider === "cloudflare") {
      setProfile({
        id: user.id,
        email: user.email ?? null,
        plan: "plan" in user && user.plan ? user.plan : "Free",
      });
      return;
    }

    const { data, error } = await getSupabaseClient()
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (error) {
      setAuthError(error.message);
      return;
    }

    setProfile(data);
  }, [isConfigured, provider, user]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  async function signInWithEmail(email: string): Promise<string | void> {
    if (!isConfigured) {
      throw new Error("Backend is not configured.");
    }

    setAuthError(null);

    if (provider === "cloudflare") {
      const data = await cloudflareRequest<{ sent?: boolean; devLink?: string }>(
        "/api/auth/login",
        {
          method: "POST",
          body: { email },
          auth: false,
        },
      );
      return data.devLink
        ? `Development sign-in link: ${data.devLink}`
        : "Check your inbox for the sign-in link.";
    }

    const { error } = await getSupabaseClient().auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/settings`,
      },
    });

    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }

  async function signOut() {
    if (!isConfigured) return;
    setAuthError(null);

    if (provider === "cloudflare") {
      await cloudflareRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
      clearCloudflareSessionToken();
      setSession(null);
      setUser(null);
      setProfile(null);
      return;
    }

    const { error } = await getSupabaseClient().auth.signOut();
    if (error) {
      setAuthError(error.message);
      throw error;
    }
    setProfile(null);
  }

  const value: AuthContextValue = {
    isConfigured,
    isLoading,
    provider,
    user,
    session,
    profile,
    authError,
    signInWithEmail,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
