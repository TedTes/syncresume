import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  LogOut,
  ShieldCheck,
  UserRound,
  Zap,
} from "lucide-react";
import { UserButton } from "@clerk/clerk-react";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import {
  createBillingCheckoutSession,
  createBillingPortalSession,
} from "../lib/cloudflare/client";
import type { UserProfileDetails } from "../lib/userProfile";

type ProfileSaveStatus = "saved" | "saving";

export default function SettingsPage() {
  const {
    toggles,
    setToggle,
    userProfileDetails,
    setUserProfileField,
  } = useSettings();
  const { user, profile, signOut } = useAuth();
  const [billingAction, setBillingAction] = useState<"checkout" | "portal" | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [profileSaveStatus, setProfileSaveStatus] = useState<ProfileSaveStatus>("saved");
  const profileSaveTimerRef = useRef<number | null>(null);
  const usage = profile?.usage;
  const isPro = profile?.plan === "Pro";
  const canCheckout = Boolean(profile?.billing?.checkoutEnabled);
  const canOpenPortal = Boolean(profile?.billing?.portalEnabled);

  useEffect(() => {
    return () => {
      if (profileSaveTimerRef.current) {
        window.clearTimeout(profileSaveTimerRef.current);
      }
    };
  }, []);

  function updateProfileField(key: keyof UserProfileDetails, value: string) {
    setProfileSaveStatus("saving");
    setUserProfileField(key, value);

    if (profileSaveTimerRef.current) {
      window.clearTimeout(profileSaveTimerRef.current);
    }

    profileSaveTimerRef.current = window.setTimeout(() => {
      setProfileSaveStatus("saved");
    }, 450);
  }

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
            <div className="settings-card-heading">
              <div>
                <p className="settings-card-title">Profile details</p>
                <p className="settings-card-subtitle">
                  Used as contact fallback when a resume is missing stable personal details.
                </p>
              </div>
              <div className="settings-card-actions">
                <span
                  className={`settings-save-status ${profileSaveStatus}`}
                  aria-live="polite"
                >
                  {profileSaveStatus === "saving" ? (
                    <Loader2 aria-hidden="true" className="spin-icon" />
                  ) : (
                    <CheckCircle2 aria-hidden="true" />
                  )}
                  {profileSaveStatus === "saving" ? "Saving..." : "Saved"}
                </span>
                <span className="settings-card-icon" aria-hidden="true">
                  <UserRound />
                </span>
              </div>
            </div>

            <div className="settings-profile-grid">
              <ProfileField
                label="Full name"
                value={userProfileDetails.fullName}
                placeholder="Jane Doe"
                onChange={(value) => updateProfileField("fullName", value)}
              />
              <ProfileField
                label="Default role"
                value={userProfileDetails.targetTitle}
                placeholder="Senior Software Engineer"
                onChange={(value) => updateProfileField("targetTitle", value)}
              />
              <ProfileField
                label="Email"
                value={userProfileDetails.email}
                placeholder="jane@example.com"
                inputMode="email"
                onChange={(value) => updateProfileField("email", value)}
              />
              <ProfileField
                label="Phone"
                value={userProfileDetails.phone}
                placeholder="+1 (555) 123-4567"
                inputMode="tel"
                onChange={(value) => updateProfileField("phone", value)}
              />
              <ProfileField
                label="Location"
                value={userProfileDetails.location}
                placeholder="Toronto, ON"
                onChange={(value) => updateProfileField("location", value)}
              />
              <ProfileField
                label="Website"
                value={userProfileDetails.website}
                placeholder="janedoe.dev"
                inputMode="url"
                onChange={(value) => updateProfileField("website", value)}
              />
              <ProfileField
                label="LinkedIn"
                value={userProfileDetails.linkedin}
                placeholder="linkedin.com/in/janedoe"
                inputMode="url"
                onChange={(value) => updateProfileField("linkedin", value)}
              />
              <ProfileField
                label="GitHub"
                value={userProfileDetails.github}
                placeholder="github.com/janedoe"
                inputMode="url"
                onChange={(value) => updateProfileField("github", value)}
              />
            </div>
            <p className="settings-row-desc settings-profile-note">
              Saved automatically in this browser. Resume-specific contact details stay unchanged.
            </p>
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
                <UserButton />
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

function ProfileField({
  label,
  value,
  placeholder,
  inputMode,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  inputMode?: "email" | "tel" | "url";
  onChange: (value: string) => void;
}) {
  return (
    <label className="settings-profile-field">
      <span>{label}</span>
      <input
        className="settings-profile-input"
        type="text"
        inputMode={inputMode}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}
