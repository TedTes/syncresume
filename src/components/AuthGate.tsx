import type { ReactNode } from "react";
import { Loader2, TriangleAlert } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AuthPanel } from "./AuthPanel";

export function AuthGate({ children }: { children: ReactNode }) {
  const { isConfigured, isLoading, user } = useAuth();

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
            <h1>Cloudflare API missing</h1>
            <p>Set VITE_CLOUDFLARE_API_URL for the Pages frontend, then reload the app.</p>
          </div>
          <code className="auth-config-code">VITE_CLOUDFLARE_API_URL=http://localhost:8787</code>
        </section>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-gate">
        <AuthPanel />
      </main>
    );
  }

  return <>{children}</>;
}
