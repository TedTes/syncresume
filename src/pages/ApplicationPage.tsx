import { LayoutTemplate } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { ResumeTemplatePanel } from "../components/ResumeTemplateSelector";
import { useAppData } from "../context/AppDataContext";
import { useSettings } from "../context/SettingsContext";
import { parseResumeDocument, withFallbackContactSection } from "../resume/schema";
import type { RunRecord } from "../lib/storage";
import OptimizerPage from "./OptimizerPage";

type ApplicationArtifact = "resume" | "cover-letter" | "job-description";

function readPreferredArtifact(search: string): ApplicationArtifact {
  const artifact = new URLSearchParams(search).get("artifact");
  if (artifact === "cover-letter" || artifact === "job-description") return artifact;
  return "resume";
}

function applicationTitle(run?: RunRecord): string {
  if (!run) return "Application review";
  const title = run.title.trim();
  return title || "Application review";
}

export default function ApplicationPage() {
  const { runId } = useParams();
  const location = useLocation();
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false);

  const { activeResume, resumes, runs } = useAppData();
  const { selectedTemplateId, setSelectedTemplateId, templatePreviewDocument } = useSettings();
  const preferredArtifact = readPreferredArtifact(location.search);
  const run = runs.find((item) => item.id === runId);

  const activeResumeDocument = useMemo(() => {
    if (!activeResume) return null;
    const doc = parseResumeDocument(activeResume.text, activeResume.name);
    const sourceResume = activeResume.sourceResumeId
      ? resumes.find((resume) => resume.id === activeResume.sourceResumeId)
      : null;
    const sourceDocument = sourceResume
      ? parseResumeDocument(sourceResume.text, sourceResume.name)
      : null;
    return withFallbackContactSection(doc, sourceDocument);
  }, [activeResume, resumes]);

  const templatePanelDocument = templatePreviewDocument ?? activeResumeDocument;

  function closeTemplatePanel() {
    setIsTemplatePanelOpen(false);
  }

  useEffect(() => {
    if (!isTemplatePanelOpen) return;

    function eventInsidePanel(target: EventTarget | null) {
      return (
        target instanceof Element &&
        Boolean(target.closest(".template-drawer-push-right, .template-review-backdrop"))
      );
    }

    function collapseOnPageMovement(event: Event) {
      if (eventInsidePanel(event.target)) return;
      closeTemplatePanel();
    }

    function collapseOnViewportChange() {
      setIsTemplatePanelOpen(false);
    }

    const opts = { capture: true, passive: true } as const;
    document.addEventListener("scroll", collapseOnPageMovement, true);
    document.addEventListener("wheel", collapseOnPageMovement, opts);
    document.addEventListener("touchmove", collapseOnPageMovement, opts);
    window.addEventListener("resize", collapseOnViewportChange);
    window.addEventListener("orientationchange", collapseOnViewportChange);

    return () => {
      document.removeEventListener("scroll", collapseOnPageMovement, true);
      document.removeEventListener("wheel", collapseOnPageMovement, opts);
      document.removeEventListener("touchmove", collapseOnPageMovement, opts);
      window.removeEventListener("resize", collapseOnViewportChange);
      window.removeEventListener("orientationchange", collapseOnViewportChange);
    };
  }, [isTemplatePanelOpen]);

  return (
    <>
      <header className="page-topbar">
        <span className="page-topbar-title">{applicationTitle(run)}</span>
        <div className="page-topbar-end">
          <button
            type="button"
            className={`btn btn-secondary btn-sm template-drawer-trigger${isTemplatePanelOpen ? " active" : ""}`}
            onClick={() => setIsTemplatePanelOpen((open) => !open)}
          >
            <LayoutTemplate aria-hidden="true" />
            <span className="template-trigger-label">Template</span>
          </button>
        </div>
      </header>

      <div className="workspace-outer application-detail-outer">
        <div className="workspace-flow application-detail-flow">
          <OptimizerPage
            embedded
            preferredArtifact={preferredArtifact}
            reviewBackPath="/dashboard"
            reviewRunId={runId}
          />
        </div>

        <ResumeTemplatePanel
          selectedTemplateId={selectedTemplateId}
          onSelect={setSelectedTemplateId}
          previewDocument={templatePanelDocument}
          onClose={closeTemplatePanel}
          isOpen={isTemplatePanelOpen}
          className={`template-drawer-push-right${isTemplatePanelOpen ? " is-open" : ""}`}
        />
      </div>
    </>
  );
}
