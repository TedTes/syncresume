import { FileText, LayoutGrid, Settings } from "lucide-react";
import { UserButton } from "@clerk/clerk-react";
import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import { parseResumeDocument, withFallbackContactSection } from "../resume/schema";
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
  const { activeResume, resumes } = useAppData();
  const {
    selectedTemplateId,
    setSelectedTemplateId,
    templatePreviewDocument,
  } = useSettings();
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false);
  const location = useLocation();
  const initials = user?.email?.slice(0, 2).toUpperCase() || "SR";
  const activeResumeDocument = useMemo(
    () => {
      if (!activeResume) return null;

      const document = parseResumeDocument(activeResume.text, activeResume.name);
      const sourceResume = activeResume.sourceResumeId
        ? resumes.find((resume) => resume.id === activeResume.sourceResumeId)
        : null;
      const sourceDocument = sourceResume
        ? parseResumeDocument(sourceResume.text, sourceResume.name)
        : null;

      return withFallbackContactSection(document, sourceDocument);
    },
    [activeResume, resumes],
  );
  const templatePanelDocument = templatePreviewDocument ?? activeResumeDocument;

  function closePanel() {
    setIsTemplatePanelOpen(false);
  }

  useEffect(() => {
    setIsTemplatePanelOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!isTemplatePanelOpen) return;

    function eventStartedInsideTemplateUi(target: EventTarget | null) {
      return (
        target instanceof Element &&
        Boolean(target.closest(".template-drawer-push, .template-review-backdrop, .sidebar"))
      );
    }

    function collapseOnPageMovement(event: Event) {
      if (eventStartedInsideTemplateUi(event.target)) return;
      closePanel();
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
          <svg viewBox="0 0 18 22" fill="none">
            <rect x="2.5" y="1" width="14" height="18.5" rx="2.2" stroke="rgba(255,255,255,0.18)" strokeWidth="1.1" transform="rotate(7 9.5 10.25)" />
            <path d="M1.5 3C1.5 2.17 2.17 1.5 3 1.5H11.5L16.5 6.5V19C16.5 19.83 15.83 20.5 15 20.5H3C2.17 20.5 1.5 19.83 1.5 19V3Z" fill="rgba(34,197,94,0.07)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
            <path d="M11.5 1.5L16.5 6.5H13C12.17 6.5 11.5 5.83 11.5 5V1.5Z" fill="#22c55e" />
            <rect x="4" y="9.5" width="9" height="1.5" rx="0.75" fill="rgba(255,255,255,0.55)" />
            <rect x="4" y="12.5" width="5.5" height="1.4" rx="0.7" fill="#22c55e" opacity="0.85" />
            <rect x="4" y="15.5" width="7" height="1.2" rx="0.6" fill="rgba(255,255,255,0.22)" />
          </svg>
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

      <ResumeTemplatePanel
        selectedTemplateId={selectedTemplateId}
        onSelect={setSelectedTemplateId}
        previewDocument={templatePanelDocument}
        onClose={closePanel}
        isOpen={isTemplatePanelOpen}
        className={`template-drawer-push${isTemplatePanelOpen ? " is-open" : ""}`}
      />

      <div className="main-area">
        <AuthGate>
          <Outlet />
        </AuthGate>
      </div>
    </div>
  );
}
