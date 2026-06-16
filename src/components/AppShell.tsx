import { FileText, LayoutGrid, RefreshCw, Settings, Files } from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const NAV_ITEMS = [
  { to: "/optimizer", label: "Optimizer", icon: FileText },
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/resumes", label: "Resumes", icon: Files },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  return (
    <div className="app-shell">
      <nav className="sidebar" aria-label="Primary">
        <div className="sidebar-brand-mark" aria-hidden="true">
          <RefreshCw />
        </div>

        <div className="sidebar-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `sidebar-nav-item ${isActive ? "active" : ""}`}
              title={label}
              aria-label={label}
            >
              <Icon aria-hidden="true" />
            </NavLink>
          ))}
        </div>

        <div className="sidebar-avatar" aria-hidden="true">
          TD
        </div>
      </nav>

      <div className="main-area">
        <Outlet />
      </div>
    </div>
  );
}
