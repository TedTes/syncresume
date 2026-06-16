import { FormEvent, useState } from "react";
import { LogOut, Mail } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { PROVIDERS } from "../lib/providers/types";

export default function SettingsPage() {
  const { provider, setProvider, model, toggles, setToggle } = useSettings();
  const { isConfigured, isLoading, provider: authProvider, user, profile, authError, signInWithEmail, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isSubmittingAuth, setIsSubmittingAuth] = useState(false);

  async function handleSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setIsSubmittingAuth(true);
    setAuthNotice(null);
    try {
      const notice = await signInWithEmail(trimmedEmail);
      setAuthNotice(notice || "Check your inbox for the sign-in link.");
    } catch (error) {
      setAuthNotice(error instanceof Error ? error.message : "Sign-in failed.");
    } finally {
      setIsSubmittingAuth(false);
    }
  }

  return (
    <>
      <header className="page-topbar">
        <span className="page-topbar-title">Settings</span>
      </header>

      <main className="page-content page-content-narrow">
        <div className="settings-page">
          <section className="settings-card">
            <p className="settings-card-title">LLM provider</p>

            <div className="settings-row">
              <div>
                <p className="settings-row-label">Provider</p>
                <p className="settings-row-desc">Anthropic and Gemini are coming soon.</p>
              </div>
              <div className="provider-pills">
                {PROVIDERS.map((info) => (
                  <button
                    key={info.id}
                    type="button"
                    className={`provider-pill ${provider === info.id ? "active" : ""}`}
                    onClick={() => setProvider(info.id)}
                  >
                    {info.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div>
                <p className="settings-row-label">Credentials</p>
                <p className="settings-row-desc">
                  Provider keys are stored as Supabase Edge Function secrets.
                </p>
              </div>
              <span className="settings-readonly-value">Server-side</span>
            </div>

            <div className="settings-row">
              <div>
                <p className="settings-row-label">Model</p>
              </div>
              <span className="settings-readonly-value">{model}</span>
            </div>
          </section>

          <section className="settings-card">
            <p className="settings-card-title">Optimization behaviour</p>

            <ToggleRow
              label="Auto-detect requirements"
              desc="Pull keywords from the job description automatically."
              checked={toggles.autoDetectRequirements}
              onChange={(value) => setToggle("autoDetectRequirements", value)}
            />
            <ToggleRow
              label="Show keyword diff"
              desc="Highlight matched and missing keywords after optimizing."
              checked={toggles.showKeywordDiff}
              onChange={(value) => setToggle("showKeywordDiff", value)}
            />
            <ToggleRow
              label="Save run history"
              desc="Keep a record of past optimization runs on the Dashboard."
              checked={toggles.saveRunHistory}
              onChange={(value) => setToggle("saveRunHistory", value)}
            />
          </section>

          <section className="settings-card">
            <p className="settings-card-title">Account</p>
            {!isConfigured ? (
              <div className="settings-row">
                <div>
                  <p className="settings-row-label">Backend</p>
                  <p className="settings-row-desc">
                    Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to enable account sync.
                  </p>
                </div>
                <span className="settings-readonly-value">Local mode</span>
              </div>
            ) : user ? (
              <>
                <div className="settings-row">
                  <div>
                    <p className="settings-row-label">Email</p>
                    <p className="settings-row-desc">Used for resume storage and run history.</p>
                  </div>
                  <span className="settings-readonly-value">{user.email}</span>
                </div>
                <div className="settings-row">
                  <p className="settings-row-label">Plan</p>
                  <span className="settings-readonly-value">{profile?.plan ?? "Free"}</span>
                </div>
                <div className="settings-row">
                  <div>
                    <p className="settings-row-label">Session</p>
                    <p className="settings-row-desc">
                      {authProvider === "cloudflare"
                        ? "Cloudflare keeps the account session active."
                        : "Supabase keeps the account session active."}
                    </p>
                  </div>
                  <button className="btn btn-secondary btn-sm" type="button" onClick={() => void signOut()}>
                    <LogOut aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              </>
            ) : (
              <div className="settings-row settings-row-stacked">
                <div>
                  <p className="settings-row-label">Sign in</p>
                  <p className="settings-row-desc">
                    Use a magic link to sync resumes and optimization history.
                  </p>
                </div>
                <form className="auth-email-form" onSubmit={handleSignIn}>
                  <div className="auth-email-input">
                    <Mail aria-hidden="true" />
                    <input
                      className="field-input"
                      type="email"
                      value={email}
                      placeholder="you@example.com"
                      autoComplete="email"
                      disabled={isLoading || isSubmittingAuth}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    type="submit"
                    disabled={!email.trim() || isLoading || isSubmittingAuth}
                  >
                    {isSubmittingAuth ? "Sending..." : "Send link"}
                  </button>
                </form>
                {(authNotice || authError) && (
                  <p className={authError ? "settings-inline-error" : "settings-inline-success"}>
                    {authError ?? authNotice}
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div>
        <p className="settings-row-label">{label}</p>
        <p className="settings-row-desc">{desc}</p>
      </div>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-switch-track" />
      </label>
    </div>
  );
}
