import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Loader2,
  UserRound,
  Zap,
} from "lucide-react";
import { TopbarAccount } from "../components/TopbarAccount";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { useToastMessage } from "../context/ToastContext";
import {
  createBillingCheckoutSession,
  createBillingPortalSession,
  type BillingCheckoutPlan,
  type BillingPlanKey,
} from "../lib/cloudflare/client";
import type { UserProfileDetails } from "../lib/userProfile";
import { RESUME_FONT_OPTIONS, type ResumeFontId } from "../templates/shared/fonts";

type ProfileSaveStatus = "saved" | "saving";
type BillingAction = BillingPlanKey | "portal";

const FALLBACK_BILLING_PLANS: BillingCheckoutPlan[] = [
  { key: "monthly", label: "Pro Monthly", price: "$14", cadence: "per month" },
];

const aiCreditFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

function formatAiCredits(value: number): string {
  return aiCreditFormatter.format(value);
}

export default function SettingsPage() {
  const {
    toggles,
    setToggle,
    userProfileDetails,
    setUserProfileField,
    selectedFontId,
    setSelectedFontId,
  } = useSettings();
  const { user, profile } = useAuth();
  const [billingAction, setBillingAction] = useState<BillingAction | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [profileSaveStatus, setProfileSaveStatus] = useState<ProfileSaveStatus>("saved");
  const profileSaveTimerRef = useRef<number | null>(null);
  const usage = profile?.usage;
  const isPro = profile?.plan === "Pro";
  const canCheckout = Boolean(profile?.billing?.checkoutEnabled);
  const canOpenPortal = Boolean(profile?.billing?.portalEnabled);
  const checkoutPlans =
    profile?.billing?.checkoutPlans?.length
      ? profile.billing.checkoutPlans
      : canCheckout
        ? FALLBACK_BILLING_PLANS
        : [];

  useToastMessage(billingError, { kind: "error", title: "Billing failed", durationMs: 6500 });

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

  async function openBilling(action: BillingAction) {
    setBillingAction(action);
    setBillingError(null);

    try {
      const session =
        action === "portal"
          ? await createBillingPortalSession()
          : await createBillingCheckoutSession(action);
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
        <TopbarAccount />
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
            <p className="settings-card-title">Resume appearance</p>
            <div className="settings-row">
              <div>
                <p className="settings-row-label">Default font</p>
                <p className="settings-row-desc">
                  Used in live previews, PDF exports, and DOCX exports unless the template default is selected.
                </p>
              </div>
              <select
                className="settings-select"
                value={selectedFontId}
                onChange={(event) => setSelectedFontId(event.target.value as ResumeFontId)}
              >
                {RESUME_FONT_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
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
                    ? `${formatAiCredits(usage.aiActionsUsed)}/${formatAiCredits(
                        usage.aiActionsLimit,
                      )} AI credits used in ${usage.period}.`
                    : "Monthly AI credits are tracked server-side."}
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
                  <div className="settings-plan-options" aria-label="Upgrade options">
                    {checkoutPlans.map((checkoutPlan) => (
                      <button
                        key={checkoutPlan.key}
                        className="settings-plan-option"
                        type="button"
                        disabled={!canCheckout || billingAction === checkoutPlan.key}
                        onClick={() => void openBilling(checkoutPlan.key)}
                      >
                        <span className="settings-plan-main">
                          <CreditCard aria-hidden="true" />
                          <span>{checkoutPlan.label}</span>
                        </span>
                        <span className="settings-plan-price">
                          {billingAction === checkoutPlan.key ? (
                            <Loader2 aria-hidden="true" className="spin-icon" />
                          ) : (
                            checkoutPlan.price
                          )}
                          <span>{checkoutPlan.cadence}</span>
                        </span>
                        {checkoutPlan.savings && (
                          <span className="settings-plan-savings">{checkoutPlan.savings}</span>
                        )}
                      </button>
                    ))}
                    {!checkoutPlans.length && (
                      <span className="settings-row-desc">Upgrade checkout is not configured.</span>
                    )}
                  </div>
                )}
              </div>
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
