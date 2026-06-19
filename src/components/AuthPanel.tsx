import { FormEvent, useState } from "react";
import { ExternalLink, Loader2, Mail, ShieldCheck } from "lucide-react";
import { useAuth } from "../context/AuthContext";

function getDevelopmentLink(notice: string | null): string {
  const prefix = "Development sign-in link: ";
  return notice?.startsWith(prefix) ? notice.slice(prefix.length).trim() : "";
}

export function AuthPanel() {
  const { authError, isConfigured, isLoading, signInWithEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const developmentLink = getDevelopmentLink(notice);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !isConfigured) return;

    setIsSubmitting(true);
    setNotice(null);
    try {
      const nextNotice = await signInWithEmail(trimmedEmail);
      setNotice(nextNotice || "Check your inbox for the sign-in link.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-panel" aria-label="Sign in">
      <div className="auth-panel-icon" aria-hidden="true">
        <ShieldCheck />
      </div>
      <div className="auth-panel-copy">
        <h1>Sign in to SyncResume</h1>
        <p>Secure resume storage and optimization history run through your Cloudflare backend.</p>
      </div>

      <form className="auth-panel-form" onSubmit={handleSubmit}>
        <div className="auth-email-input">
          <Mail aria-hidden="true" />
          <input
            className="field-input"
            type="email"
            value={email}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={!isConfigured || isLoading || isSubmitting}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <button
          className="btn btn-primary"
          type="submit"
          disabled={!email.trim() || !isConfigured || isLoading || isSubmitting}
        >
          {isSubmitting ? <Loader2 className="spin" aria-hidden="true" /> : <Mail aria-hidden="true" />}
          {isSubmitting ? "Sending..." : "Send sign-in link"}
        </button>
      </form>

      {developmentLink ? (
        <a className="auth-dev-link" href={developmentLink}>
          <ExternalLink aria-hidden="true" />
          Open development sign-in link
        </a>
      ) : (
        (notice || authError) && (
          <p className={authError ? "auth-panel-error" : "auth-panel-success"}>
            {authError ?? notice}
          </p>
        )
      )}
    </section>
  );
}
