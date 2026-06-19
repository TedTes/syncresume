import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import {
  clearCloudflareSessionToken,
  cloudflareRequest,
  getCloudflareSessionToken,
  hasCloudflareConfig,
  setCloudflareSessionToken,
  type CloudflareUser,
} from "../lib/cloudflare/client";

type AuthProviderKind = "cloudflare";
type AuthUser = CloudflareUser;
type Profile = Pick<CloudflareUser, "id" | "email" | "plan">;
type AuthSession = { provider: "cloudflare"; token: string } | null;

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
  const isConfigured = hasCloudflareConfig();
  const [session, setSession] = useState<AuthSession>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(isConfigured);
  const [authError, setAuthError] = useState<string | null>(
    isConfigured ? null : "Set VITE_CLOUDFLARE_API_URL to enable Cloudflare sync.",
  );

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

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
  }, [isConfigured]);

  const refreshProfile = useCallback(async () => {
    if (!isConfigured || !user) {
      setProfile(null);
      return;
    }

    setProfile({
      id: user.id,
      email: user.email,
      plan: user.plan || "Free",
    });
  }, [isConfigured, user]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

  async function signInWithEmail(email: string): Promise<string | void> {
    if (!isConfigured) {
      throw new Error("Cloudflare API is not configured. Set VITE_CLOUDFLARE_API_URL.");
    }

    setAuthError(null);
    const data = await cloudflareRequest<{ sent?: boolean; devLink?: string }>("/api/auth/login", {
      method: "POST",
      body: { email },
      auth: false,
    });

    return data.devLink
      ? `Development sign-in link: ${data.devLink}`
      : "Check your inbox for the sign-in link.";
  }

  async function signOut() {
    if (!isConfigured) return;
    setAuthError(null);
    await cloudflareRequest("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    clearCloudflareSessionToken();
    setSession(null);
    setUser(null);
    setProfile(null);
  }

  const value: AuthContextValue = {
    isConfigured,
    isLoading,
    provider: "cloudflare",
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
