import { UserButton } from "@clerk/clerk-react";
import { useAuth } from "../context/AuthContext";

export function TopbarAccount() {
  const { user } = useAuth();
  const initials = user?.email?.slice(0, 2).toUpperCase() || "SR";

  return (
    <div className="topbar-account" aria-label="Account">
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
