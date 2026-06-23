import { useState } from "react";
import { CreditCard, Loader2, LogOut, ShieldCheck, Zap } from "lucide-react";
import { UserButton } from "@clerk/clerk-react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import {
  createBillingCheckoutSession,
  createBillingPortalSession,
} from "../lib/cloudflare/client";
import { PROVIDERS } from "../lib/providers/types";

export default function SettingsPage() {
  const { provider, setProvider, model, toggles, setToggle } = useSettings();
  const { user, profile, signOut } = useAuth();
  const [billingAction, setBillingAction] = useState<"checkout" | "portal" | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const activeProvider = PROVIDERS.find((info) => info.id === provider) ?? PROVIDERS[0];
  const usage = profile?.usage;
  const isPro = profile?.plan === "Pro";
  const canCheckout = Boolean(profile?.billing?.checkoutEnabled);
  const canOpenPortal = Boolean(profile?.billing?.portalEnabled);

  async function openBilling(action: "checkout" | "portal") {
    setBillingAction(action);
    setBillingError(null);

    try {
      const session =
        action === "checkout"
          ? await createBillingCheckoutSession()
          : await createBillingPortalSession();
      window.location.assign(session.url);
    } catch (error) {
      setBillingError(error instanceof Error ? error.message : "Billing request failed.");
      setBillingAction(null);
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
                <p className="settings-row-desc">
                  {activeProvider.label} is active. Other providers unlock when their Worker secrets are configured.
                </p>
              </div>
              <div className="provider-pills">
                {PROVIDERS.map((info) => (
                  <button
                    key={info.id}
                    type="button"
                    className={`provider-pill ${provider === info.id ? "active" : ""}`}
                    disabled={!info.enabled}
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
                  Provider keys are stored as Cloudflare Worker secrets.
                </p>
              </div>
              <span className="settings-readonly-value">Server-side</span>
            </div>

            <div className="settings-row">
              <div>
                <p className="settings-row-label">Model</p>
              </div>
              <span className="settings-readonly-value">
                {activeProvider.enabled ? model : "Not enabled"}
              </span>
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
            <div className="settings-row">
              <div>
                <p className="settings-row-label">Email</p>
                <p className="settings-row-desc">Used for resume storage and run history.</p>
              </div>
              <span className="settings-readonly-value">{user?.email}</span>
            </div>
            <div className="settings-row">
              <div>
                <p className="settings-row-label">Plan</p>
                <p className="settings-row-desc">
                  {usage
                    ? `${usage.aiActionsUsed}/${usage.aiActionsLimit} AI actions used in ${usage.period}.`
                    : "Monthly AI usage is tracked server-side."}
                </p>
              </div>
              <div className="settings-row-control">
                <span className="settings-readonly-value settings-provider-badge">
                  <Zap aria-hidden="true" />
                  {profile?.plan ?? "Free"}
                </span>
                {isPro ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    type="button"
                    disabled={!canOpenPortal || billingAction === "portal"}
                    onClick={() => void openBilling("portal")}
                  >
                    {billingAction === "portal" ? (
                      <Loader2 aria-hidden="true" className="spin-icon" />
                    ) : (
                      <CreditCard aria-hidden="true" />
                    )}
                    Manage
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    type="button"
                    disabled={!canCheckout || billingAction === "checkout"}
                    onClick={() => void openBilling("checkout")}
                  >
                    {billingAction === "checkout" ? (
                      <Loader2 aria-hidden="true" className="spin-icon" />
                    ) : (
                      <CreditCard aria-hidden="true" />
                    )}
                    Upgrade
                  </button>
                )}
              </div>
            </div>
            {billingError ? <p className="settings-inline-error">{billingError}</p> : null}
            <div className="settings-row">
              <div>
                <p className="settings-row-label">Session</p>
                <p className="settings-row-desc">Clerk handles sign-in; Cloudflare verifies each request.</p>
              </div>
              <div className="settings-row-control">
                <UserButton afterSignOutUrl="/workspace/optimize" />
                <button className="btn btn-secondary btn-sm" type="button" onClick={() => void signOut()}>
                  <LogOut aria-hidden="true" />
                  Sign out
                </button>
              </div>
            </div>
            <div className="settings-row">
              <div>
                <p className="settings-row-label">Identity provider</p>
                <p className="settings-row-desc">Frontend session token is sent only as a request bearer token.</p>
              </div>
              <span className="settings-readonly-value settings-provider-badge">
                <ShieldCheck aria-hidden="true" />
                Clerk
              </span>
            </div>
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
