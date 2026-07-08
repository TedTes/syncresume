import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, Loader2, Shield, X } from "lucide-react";
import { useAuth } from "./AuthContext";
import { useToastMessage } from "./ToastContext";
import {
  createBillingCheckoutSession,
  createBillingPortalSession,
  type BillingCheckoutPlan,
  type BillingPlanKey,
} from "../lib/cloudflare/client";

type BillingAction = BillingPlanKey | "portal";

type PricingContextValue = {
  billingAction: BillingAction | null;
  canCheckout: boolean;
  canOpenPortal: boolean;
  openBillingPortal: () => Promise<void>;
  openPricing: () => void;
};

const FALLBACK_BILLING_PLANS: BillingCheckoutPlan[] = [
  { key: "monthly", label: "Pro Monthly", price: "$14", cadence: "per month" },
];

const PLAN_FEATURES = [
  "Resume tailoring",
  "Cover letters",
  "Template exports",
  "Version history",
  "Monthly AI credits",
];

const CTA_LABELS: Partial<Record<BillingPlanKey, string>> = {
  monthly: "Start monthly",
  six_month: "Choose 6-month",
  yearly: "Choose yearly",
};

const PricingContext = createContext<PricingContextValue | null>(null);

export function PricingProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [billingAction, setBillingAction] = useState<BillingAction | null>(null);
  const [billingError, setBillingError] = useState<string | null>(null);
  const [isPricingOpen, setIsPricingOpen] = useState(false);
  const isPro = profile?.plan === "Pro";
  const canCheckout = Boolean(profile?.billing?.checkoutEnabled);
  const canOpenPortal = Boolean(profile?.billing?.portalEnabled);
  const checkoutPlans = useMemo(
    () =>
      profile?.billing?.checkoutPlans?.length
        ? profile.billing.checkoutPlans
        : canCheckout
          ? FALLBACK_BILLING_PLANS
          : [],
    [canCheckout, profile?.billing?.checkoutPlans],
  );

  useToastMessage(billingError, { kind: "error", title: "Billing failed", durationMs: 6500 });

  useEffect(() => {
    if (!isPricingOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !billingAction) setIsPricingOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isPricingOpen, billingAction]);

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

  function openPricing() {
    setIsPricingOpen(true);
  }

  function closePricing() {
    setIsPricingOpen(false);
  }

  const value = useMemo<PricingContextValue>(
    () => ({
      billingAction,
      canCheckout,
      canOpenPortal,
      openBillingPortal: () => openBilling("portal"),
      openPricing,
    }),
    [billingAction, canCheckout, canOpenPortal],
  );

  const showManagePanel = isPro && canOpenPortal;
  const showPlanCards = !showManagePanel && checkoutPlans.length > 0;

  return (
    <PricingContext.Provider value={value}>
      {children}
      {isPricingOpen && (
        <div
          className="settings-pricing-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePricing();
          }}
        >
          <section
            className="settings-pricing-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-pricing-title"
          >
            <div className="settings-pricing-header">
              <div>
                <p className="settings-card-title" id="settings-pricing-title">
                  {showManagePanel ? "Your Pro Plan" : isPro ? "Change plan" : "Upgrade to Pro"}
                </p>
                {!showManagePanel && (
                  <p className="settings-card-subtitle">
                    Pick the cadence that fits your search. Every plan includes the same full
                    feature set.
                  </p>
                )}
              </div>
              <button
                className="settings-pricing-close"
                type="button"
                onClick={closePricing}
                aria-label="Close pricing"
              >
                <X aria-hidden="true" />
              </button>
            </div>

            {showManagePanel && (
              <ProManagePanel
                loading={billingAction === "portal"}
                onManage={() => void openBilling("portal")}
              />
            )}

            {showPlanCards && (
              <div className="pricing-cards" aria-label="Pricing plans">
                {checkoutPlans.map((plan) => (
                  <PricingCard
                    key={plan.key}
                    plan={plan}
                    recommended={plan.key === "yearly"}
                    disabled={!canCheckout || billingAction !== null}
                    loading={billingAction === plan.key}
                    onSelect={() => void openBilling(plan.key)}
                  />
                ))}
              </div>
            )}

            {!showManagePanel && !showPlanCards && (
              <p className="settings-row-desc">Upgrade checkout is not configured.</p>
            )}
          </section>
        </div>
      )}
    </PricingContext.Provider>
  );
}

function PricingCard({
  plan,
  recommended,
  disabled,
  loading,
  onSelect,
}: {
  plan: BillingCheckoutPlan;
  recommended: boolean;
  disabled: boolean;
  loading: boolean;
  onSelect: () => void;
}) {
  const label = plan.label.replace(/^Pro\s+/i, "");
  const ctaLabel = CTA_LABELS[plan.key] ?? `Choose ${label}`;

  return (
    <div className={`pricing-card${recommended ? " pricing-card--recommended" : ""}`}>
      {recommended ? (
        <span className="pricing-card-badge">Best Value</span>
      ) : (
        <span className="pricing-card-badge pricing-card-badge--placeholder" aria-hidden="true" />
      )}

      <div className="pricing-card-head">
        <span className="pricing-card-name">{label}</span>
        <div className="pricing-card-price">
          <span className="pricing-card-amount">{plan.price}</span>
          <span className="pricing-card-cadence">{plan.cadence}</span>
        </div>
        {plan.savings ? (
          <span className="pricing-card-savings">{plan.savings}</span>
        ) : (
          <span className="pricing-card-savings pricing-card-savings--placeholder" aria-hidden="true" />
        )}
      </div>

      <ul className="pricing-card-features" aria-label="Included features">
        {PLAN_FEATURES.map((feature) => (
          <li key={feature} className="pricing-card-feature">
            <Check aria-hidden="true" />
            {feature}
          </li>
        ))}
      </ul>

      <button
        className="pricing-card-cta"
        type="button"
        disabled={disabled}
        onClick={onSelect}
        aria-label={loading ? "Loading…" : ctaLabel}
      >
        {loading ? (
          <Loader2 aria-hidden="true" className="spin-icon" />
        ) : (
          <>
            {ctaLabel}
            <ArrowRight aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}

function ProManagePanel({
  loading,
  onManage,
}: {
  loading: boolean;
  onManage: () => void;
}) {
  return (
    <div className="pricing-manage">
      <span className="pricing-manage-badge">
        <Shield aria-hidden="true" />
        Pro
      </span>
      <p className="pricing-manage-heading">You have full Pro access</p>
      <p className="pricing-manage-desc">
        Change plans, update your payment method, or cancel anytime through Stripe&rsquo;s secure
        billing portal.
      </p>
      <button
        className="pricing-manage-cta"
        type="button"
        disabled={loading}
        onClick={onManage}
        aria-label={loading ? "Opening billing portal…" : "Manage plan"}
      >
        {loading ? (
          <Loader2 aria-hidden="true" className="spin-icon" />
        ) : (
          <>
            Manage plan
            <ArrowRight aria-hidden="true" />
          </>
        )}
      </button>
    </div>
  );
}

export function usePricing() {
  const ctx = useContext(PricingContext);
  if (!ctx) throw new Error("usePricing must be used within PricingProvider");
  return ctx;
}
