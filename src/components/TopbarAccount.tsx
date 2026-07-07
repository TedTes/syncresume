import { UserButton } from "@clerk/clerk-react";
import { useAuth } from "../context/AuthContext";

export function TopbarAccount() {
  const { user } = useAuth();
  const initials = user?.email?.slice(0, 2).toUpperCase() || "SR";
  const rawPlanLabel = user?.plan?.trim() || "Free";
  const planLabel = rawPlanLabel.charAt(0).toUpperCase() + rawPlanLabel.slice(1);
  const usage = user?.usage;
  const creditLabel =
    usage && Number.isFinite(usage.aiActionsRemaining) && Number.isFinite(usage.aiActionsLimit)
      ? `${Math.max(0, usage.aiActionsRemaining)}/${usage.aiActionsLimit}`
      : null;

  return (
    <div className="topbar-account" aria-label="Account">
      {user && (
        <span
          className="topbar-plan-pill"
          title={creditLabel ? `${creditLabel} AI credits remaining this period` : `${planLabel} plan`}
        >
          <span>{planLabel}</span>
          {creditLabel && <span className="topbar-credit-count">{creditLabel}</span>}
        </span>
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
