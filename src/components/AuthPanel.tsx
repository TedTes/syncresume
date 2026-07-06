import { SignIn } from "@clerk/clerk-react";
import { CheckCircle2 } from "lucide-react";

const PERKS = [
  "90+ professional resume templates",
  "ATS-safe PDF and DOCX exports",
  "AI-powered job-specific tailoring",
  "Cover letters included with every run",
];

type AuthPanelProps = {
  authError?: string | null;
};

export function AuthPanel({ authError }: AuthPanelProps) {
  return (
    <div className="auth-page">
      {/* auth-page-inner shares the same max-width container for brand + body,
          preventing the sub-pixel alignment gap between them */}
      <div className="auth-page-inner">
        <a href="/" className="auth-page-brand" aria-label="Go to SyncResume homepage">
          <span className="auth-page-brand-mark" aria-hidden="true">
            <svg viewBox="0 0 18 22" fill="none">
              <rect x="2.5" y="1" width="14" height="18.5" rx="2.2" stroke="rgba(255,255,255,0.18)" strokeWidth="1.1" transform="rotate(7 9.5 10.25)" />
              <path d="M1.5 3C1.5 2.17 2.17 1.5 3 1.5H11.5L16.5 6.5V19C16.5 19.83 15.83 20.5 15 20.5H3C2.17 20.5 1.5 19.83 1.5 19V3Z" fill="rgba(34,197,94,0.07)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
              <path d="M11.5 1.5L16.5 6.5H13C12.17 6.5 11.5 5.83 11.5 5V1.5Z" fill="#22c55e" />
              <rect x="4" y="9.5" width="9" height="1.5" rx="0.75" fill="rgba(255,255,255,0.55)" />
              <rect x="4" y="12.5" width="5.5" height="1.4" rx="0.7" fill="#22c55e" opacity="0.85" />
              <rect x="4" y="15.5" width="7" height="1.2" rx="0.6" fill="rgba(255,255,255,0.22)" />
            </svg>
          </span>
          <span className="auth-page-brand-name">SyncResume</span>
        </a>

        <div className="auth-page-body">
          <div className="auth-page-copy">
            <h1>Tailor every resume to the job.</h1>
            <p>
              Paste a job description and get a tailored resume that speaks the
              job's language — keywords matched, bullets rewritten, score lifted.
            </p>
            <ul className="auth-page-perks" aria-label="Included features">
              {PERKS.map((perk) => (
                <li key={perk}>
                  <CheckCircle2 aria-hidden="true" />
                  {perk}
                </li>
              ))}
            </ul>
          </div>

          <div className="auth-page-clerk">
            {authError && (
              <p className="auth-page-error" role="alert">{authError}</p>
            )}
            <SignIn
              routing="hash"
              fallbackRedirectUrl="/workspace/optimize"
              signUpFallbackRedirectUrl="/workspace/optimize"
              appearance={{
                variables: {
                  colorBackground: "#1c1c1f",
                  colorInputBackground: "#141416",
                  colorText: "#f2f2f3",
                  colorTextSecondary: "#8b8b92",
                  colorPrimary: "#22c55e",
                  colorInputText: "#f2f2f3",
                  colorNeutral: "#8b8b92",
                  borderRadius: "8px",
                  colorDanger: "#f87171",
                  fontFamily:
                    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
                },
                elements: {
                  rootBox: "clerk-root-box",
                  cardBox: "clerk-card-box",
                  card: "clerk-card",
                  socialButtonsBlockButton: "clerk-social-button",
                  formButtonPrimary: "clerk-primary-button",
                  formFieldInput: "clerk-field-input",
                  footerActionLink: "clerk-footer-link",
                  dividerLine: "clerk-divider-line",
                  dividerText: "clerk-divider-text",
                },
              }}
            />
            {/* The "Development mode" banner appears only on Clerk development
                instances (pk_test_... key). It disappears automatically when you
                switch to a production publishable key (pk_live_...). */}
          </div>
        </div>
      </div>
    </div>
  );
}
