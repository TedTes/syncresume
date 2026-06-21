import { SignIn } from "@clerk/clerk-react";
import { ShieldCheck } from "lucide-react";

export function AuthPanel() {
  return (
    <section className="auth-panel auth-panel-clerk" aria-label="Sign in">
      <div className="auth-panel-copy">
        <div className="auth-panel-kicker">
          <ShieldCheck aria-hidden="true" />
          Secure workspace
        </div>
        <h1>Sign in to SyncResume</h1>
        <p>Keep resumes, job matches, and exports tied to your private workspace.</p>
      </div>

      <div className="clerk-card-shell">
        <SignIn
          routing="hash"
          fallbackRedirectUrl="/workspace/optimize"
          signUpFallbackRedirectUrl="/workspace/optimize"
          appearance={{
            elements: {
              rootBox: "clerk-root-box",
              cardBox: "clerk-card-box",
              card: "clerk-card",
              headerTitle: "clerk-header-title",
              headerSubtitle: "clerk-header-subtitle",
              socialButtonsBlockButton: "clerk-social-button",
              formButtonPrimary: "clerk-primary-button",
              formFieldInput: "clerk-field-input",
              footerActionLink: "clerk-footer-link",
              dividerLine: "clerk-divider-line",
              dividerText: "clerk-divider-text",
            },
          }}
        />
      </div>
    </section>
  );
}
