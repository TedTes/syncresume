import { UserButton } from "@clerk/clerk-react";
import { useAuth } from "../context/AuthContext";
import { usePricing } from "../context/PricingContext";

export function TopbarAccount() {
  const { user } = useAuth();
  const { openPricing } = usePricing();
  const initials = user?.email?.slice(0, 2).toUpperCase() || "SR";
  const rawPlanLabel = user?.plan?.trim() || "Free";
  const planLabel = rawPlanLabel.charAt(0).toUpperCase() + rawPlanLabel.slice(1);
  const isPro = planLabel.toLowerCase() === "pro";
  const usage = user?.usage;
  const creditLabel =
    usage && Number.isFinite(usage.aiActionsRemaining) && Number.isFinite(usage.aiActionsLimit)
      ? `${Math.max(0, usage.aiActionsRemaining)}/${usage.aiActionsLimit}`
      : null;

  return (
    <div className="topbar-account" aria-label="Account">
      {user && isPro && (
        <button
          className="topbar-plan-pill topbar-manage-pill"
          type="button"
          onClick={openPricing}
          title={creditLabel ? `${creditLabel} AI credits remaining this period. Manage plan.` : "Manage plan"}
        >
          <span>{planLabel}</span>
          {creditLabel && <span className="topbar-credit-count">{creditLabel}</span>}
        </button>
      )}
      {user && !isPro && (
        <button
          className="topbar-plan-pill topbar-upgrade-pill"
          type="button"
          onClick={openPricing}
          title={creditLabel ? `${creditLabel} AI credits remaining this period` : "Upgrade plan"}
        >
          <span>Upgrade</span>
          {creditLabel && <span className="topbar-credit-count">{creditLabel}</span>}
        </button>
      )}
      {user ? (
        <UserButton
          appearance={{
            elements: {
              avatarBox: "topbar-user-button",
            },
          }}
        />
      ) : (
        <div className="topbar-avatar" aria-hidden="true">
          {initials}
        </div>
      )}
    </div>
  );
}
