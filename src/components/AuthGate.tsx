import type { ReactNode } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AuthPanel } from "./AuthPanel";

export function AuthGate({ children }: { children: ReactNode }) {
  const { authError, isConfigured, isLoading, missingConfig, session, user } = useAuth();

  if (isLoading) {
    return (
      <main className="auth-gate">
        <div className="auth-loading">
          <Loader2 className="spin" aria-hidden="true" />
          Checking session...
        </div>
      </main>
    );
  }

  if (!isConfigured) {
    return (
      <main className="auth-gate">
        <section className="auth-panel">
          <div className="auth-panel-icon warning" aria-hidden="true">
            <TriangleAlert />
          </div>
          <div className="auth-panel-copy">
            <h1>Authentication setup missing</h1>
            <p>Set the frontend environment variables, then reload the app.</p>
          </div>
          <code className="auth-config-code">{missingConfig.join("\n")}</code>
        </section>
      </main>
    );
  }

  if (!user && session && authError) {
    return (
      <main className="auth-gate">
        <section className="auth-panel">
          <div className="auth-panel-icon warning" aria-hidden="true">
            <TriangleAlert />
          </div>
          <div className="auth-panel-copy">
            <h1>Backend session failed</h1>
            <p>{authError}</p>
          </div>
        </section>
      </main>
    );
  }

  if (!user) {
    return <AuthPanel authError={authError} />;
  }

  return <>{children}</>;
}
