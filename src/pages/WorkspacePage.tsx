import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { useSettings } from "../context/SettingsContext";
import { parseResumeDocument, withFallbackContactSection } from "../resume/schema";
import { ResumeTemplatePanel } from "../components/ResumeTemplateSelector";
import OptimizerPage from "./OptimizerPage";

export default function WorkspacePage() {
  const { runId } = useParams();
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false);
  const [reviewToolbarHost, setReviewToolbarHost] = useState<HTMLDivElement | null>(null);

  const { activeResume, resumes } = useAppData();
  const { selectedTemplateId, setSelectedTemplateId, templatePreviewDocument } = useSettings();

  const activeResumeDocument = useMemo(() => {
    if (!activeResume) return null;
    const doc = parseResumeDocument(activeResume.text, activeResume.name);
    const sourceResume = activeResume.sourceResumeId
      ? resumes.find((r) => r.id === activeResume.sourceResumeId)
      : null;
    const sourceDocument = sourceResume
      ? parseResumeDocument(sourceResume.text, sourceResume.name)
      : null;
    return withFallbackContactSection(doc, sourceDocument);
  }, [activeResume, resumes]);

  const templatePanelDocument = templatePreviewDocument ?? activeResumeDocument;

  const closeTemplatePanel = useCallback(() => {
    setIsTemplatePanelOpen(false);
  }, []);

  const toggleTemplatePanel = useCallback(() => {
    setIsTemplatePanelOpen((open) => !open);
  }, []);

  const handleReviewOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      closeTemplatePanel();
    }
  }, [closeTemplatePanel]);

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
  }, [closeTemplatePanel, isTemplatePanelOpen]);

  return (
    <>
      <header className={`page-topbar workspace-topbar${runId ? " review-mode" : ""}`}>
        {runId ? (
          <div className="review-toolbar-slot" ref={setReviewToolbarHost} />
        ) : (
          <span className="page-topbar-title">Workspace</span>
        )}
      </header>

      <div className={`workspace-outer${isTemplatePanelOpen ? " template-panel-open" : ""}`}>
        <div className="workspace-flow">
          <OptimizerPage
            embedded
            reviewRunId={runId}
            reviewToolbarHost={reviewToolbarHost}
            onReviewOpenChange={handleReviewOpenChange}
            isTemplatePanelOpen={isTemplatePanelOpen}
            onOpenTemplates={toggleTemplatePanel}
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
