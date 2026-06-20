import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  useAuth as useClerkAuth,
  useClerk,
  useUser,
} from "@clerk/clerk-react";
import {
  cloudflareRequest,
  hasCloudflareConfig,
  setCloudflareAuthTokenProvider,
  type CloudflareUser,
} from "../lib/cloudflare/client";
import { hasClerkConfig } from "../lib/clerk/client";

type AuthProviderKind = "clerk";
type AuthUser = CloudflareUser;
type Profile = Pick<CloudflareUser, "id" | "email" | "plan">;
type AuthSession = { provider: "clerk"; userId: string } | null;

type AuthContextValue = {
  isConfigured: boolean;
  missingConfig: string[];
  isLoading: boolean;
  provider: AuthProviderKind;
  user: AuthUser | null;
  session: AuthSession;
  profile: Profile | null;
  authError: string | null;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Authentication request failed.";
}

function getPrimaryEmail(email: string | null | undefined, fallback: string): string {
  return email?.trim() || fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const cloudflareConfigured = hasCloudflareConfig();
  const clerkConfigured = hasClerkConfig();
  const isConfigured = cloudflareConfigured && clerkConfigured;
  const missingConfig = useMemo(
    () => [
      ...(cloudflareConfigured ? [] : ["VITE_CLOUDFLARE_API_URL"]),
      ...(clerkConfigured ? [] : ["VITE_CLERK_PUBLISHABLE_KEY"]),
    ],
    [cloudflareConfigured, clerkConfigured],
  );
  const clerkAuth = useClerkAuth();
  const clerk = useClerk();
  const { user: clerkUser } = useUser();
  const [backendUser, setBackendUser] = useState<AuthUser | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const profileLoadKeyRef = useRef<string | null>(null);
  const clerkUserId = clerkAuth.userId ?? "";
  const clerkPrimaryEmail = clerkUser?.primaryEmailAddress?.emailAddress ?? "";

  useEffect(() => {
    if (!isConfigured) {
      setCloudflareAuthTokenProvider(null);
      return;
    }

    setCloudflareAuthTokenProvider(() => clerkAuth.getToken());
    return () => setCloudflareAuthTokenProvider(null);
  }, [clerkAuth.getToken, isConfigured]);

  const refreshProfile = useCallback(async () => {
    if (!isConfigured || !clerkAuth.isLoaded) {
      return;
    }

    if (!clerkAuth.isSignedIn || !clerkUserId) {
      profileLoadKeyRef.current = null;
      setBackendUser(null);
      return;
    }

    setAuthError(null);
    const data = await cloudflareRequest<{ user: CloudflareUser }>("/api/me");
    const email = getPrimaryEmail(clerkPrimaryEmail, data.user.email);
    const nextUser = {
      ...data.user,
      email,
      plan: data.user.plan || "Free",
    };

    setBackendUser((current) =>
      current &&
      current.id === nextUser.id &&
      current.email === nextUser.email &&
      current.plan === nextUser.plan
        ? current
        : nextUser,
    );
  }, [clerkAuth.isLoaded, clerkAuth.isSignedIn, clerkPrimaryEmail, clerkUserId, isConfigured]);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      if (!isConfigured) {
        profileLoadKeyRef.current = null;
        setBackendUser(null);
        setIsProfileLoading(false);
        return;
      }

      if (!clerkAuth.isLoaded) {
        return;
      }

      if (!clerkAuth.isSignedIn || !clerkUserId) {
        profileLoadKeyRef.current = null;
        setBackendUser(null);
        setIsProfileLoading(false);
        return;
      }

      const profileLoadKey =
        `${clerkUserId}:${clerkPrimaryEmail}`;

      if (profileLoadKeyRef.current === profileLoadKey) {
        setIsProfileLoading(false);
        return;
      }

      profileLoadKeyRef.current = profileLoadKey;
      setIsProfileLoading(true);

      try {
        await refreshProfile();
      } catch (error) {
        profileLoadKeyRef.current = null;
        if (active) {
          setBackendUser(null);
          setAuthError(getErrorMessage(error));
        }
      } finally {
        if (active) {
          setIsProfileLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      active = false;
    };
  }, [
    clerkAuth.isLoaded,
    clerkAuth.isSignedIn,
    clerkPrimaryEmail,
    clerkUserId,
    isConfigured,
    refreshProfile,
  ]);

  async function signOut() {
    setAuthError(null);
    setBackendUser(null);
    await clerk.signOut();
  }

  const user = backendUser;
  const profile = user ? { id: user.id, email: user.email, plan: user.plan || "Free" } : null;
  const session =
    clerkAuth.isLoaded && clerkAuth.isSignedIn && clerkAuth.userId
      ? { provider: "clerk" as const, userId: clerkAuth.userId }
      : null;
  const isBackendProfilePending =
    isConfigured &&
    clerkAuth.isLoaded &&
    clerkAuth.isSignedIn &&
    !backendUser &&
    !authError;

  const value: AuthContextValue = {
    isConfigured,
    missingConfig,
    isLoading: isConfigured ? !clerkAuth.isLoaded || isProfileLoading || isBackendProfilePending : false,
    provider: "clerk",
    user,
    session,
    profile,
    authError,
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
