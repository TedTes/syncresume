import { FileText, LayoutGrid, RefreshCw, Settings } from "lucide-react";
import { UserButton } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { parseResumeDocument } from "../resume/schema";
import { AuthGate } from "./AuthGate";
import { ResumeTemplatePanel, ResumeTemplateSelector } from "./ResumeTemplateSelector";

const PRIMARY_NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { to: "/workspace", label: "Workspace", icon: FileText },
];

const SECONDARY_NAV_ITEMS = [
  { to: "/settings", label: "Settings", icon: Settings },
];

export function AppShell() {
  const { user } = useAuth();
  const { activeResume } = useAppData();
  const {
    selectedTemplateId,
    setSelectedTemplateId,
    templatePreviewDocument,
  } = useSettings();
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false);
  const location = useLocation();
  const initials = user?.email?.slice(0, 2).toUpperCase() || "SR";
  const activeResumeDocument = useMemo(
    () => (activeResume ? parseResumeDocument(activeResume.text, activeResume.name) : null),
    [activeResume],
  );
  const templatePanelDocument = templatePreviewDocument ?? activeResumeDocument;

  useEffect(() => {
    setIsTemplatePanelOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isTemplatePanelOpen) return;

    function eventStartedInsideTemplateUi(target: EventTarget | null) {
      return target instanceof Element && Boolean(target.closest(".template-drawer-push, .sidebar"));
    }

    function collapseOnPageMovement(event: Event) {
      if (eventStartedInsideTemplateUi(event.target)) return;
      setIsTemplatePanelOpen(false);
    }

    function collapseOnViewportChange() {
      setIsTemplatePanelOpen(false);
    }

    const movementOptions = { capture: true, passive: true };
    document.addEventListener("scroll", collapseOnPageMovement, true);
    document.addEventListener("wheel", collapseOnPageMovement, movementOptions);
    document.addEventListener("touchmove", collapseOnPageMovement, movementOptions);
    window.addEventListener("resize", collapseOnViewportChange);
    window.addEventListener("orientationchange", collapseOnViewportChange);

    return () => {
      document.removeEventListener("scroll", collapseOnPageMovement, true);
      document.removeEventListener("wheel", collapseOnPageMovement, movementOptions);
      document.removeEventListener("touchmove", collapseOnPageMovement, movementOptions);
      window.removeEventListener("resize", collapseOnViewportChange);
      window.removeEventListener("orientationchange", collapseOnViewportChange);
    };
  }, [isTemplatePanelOpen]);

  return (
    <div className={`app-shell ${isTemplatePanelOpen ? "template-panel-open" : ""}`}>
      <nav className="sidebar" aria-label="Primary">
        <div className="sidebar-brand-mark" aria-hidden="true">
          <RefreshCw />
        </div>

        <div className="sidebar-nav">
          {PRIMARY_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive && !isTemplatePanelOpen ? "active" : ""}`
              }
              title={label}
              aria-label={label}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
          <ResumeTemplateSelector
            selectedTemplateId={selectedTemplateId}
            onSelect={setSelectedTemplateId}
            previewDocument={templatePanelDocument}
            triggerClassName={`sidebar-nav-item sidebar-template-trigger ${
              isTemplatePanelOpen ? "active" : ""
            }`}
            triggerLabel="Templates"
            showSelectedName={false}
            isOpen={isTemplatePanelOpen}
            onOpenChange={setIsTemplatePanelOpen}
            renderPanel={false}
          />
          {SECONDARY_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive && !isTemplatePanelOpen ? "active" : ""}`
              }
              title={label}
              aria-label={label}
            >
              <Icon aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>

        <div className="sidebar-account">
          {user ? (
            <UserButton
              afterSignOutUrl="/workspace/optimize"
              appearance={{
                elements: {
                  avatarBox: "sidebar-user-button",
                },
              }}
            />
          ) : (
            <div className="sidebar-avatar" aria-hidden="true">
              {initials}
            </div>
          )}
        </div>
      </nav>

      {isTemplatePanelOpen && (
        <ResumeTemplatePanel
          selectedTemplateId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
          previewDocument={templatePanelDocument}
          onClose={() => setIsTemplatePanelOpen(false)}
          className="template-drawer-push"
        />
      )}

      <div className="main-area">
        <AuthGate>
          <Outlet />
        </AuthGate>
      </div>
    </div>
  );
}
