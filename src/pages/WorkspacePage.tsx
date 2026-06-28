import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { useSettings } from "../context/SettingsContext";
import { applyUserProfileContactFallback } from "../lib/userProfile";
import { parseResumeDocument, withFallbackContactSection } from "../resume/schema";
import { ResumeTemplatePanel } from "../components/ResumeTemplateSelector";
import OptimizerPage from "./OptimizerPage";

export default function WorkspacePage() {
  const { runId } = useParams();
  const [isTemplatePanelOpen, setIsTemplatePanelOpen] = useState(false);
  const [reviewToolbarHost, setReviewToolbarHost] = useState<HTMLDivElement | null>(null);

  const { activeResume, resumes } = useAppData();
  const {
    selectedTemplateId,
    setSelectedTemplateId,
    templatePreviewDocument,
    userProfileDetails,
  } = useSettings();

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

  const profileActiveResumeDocument = useMemo(
    () =>
      activeResumeDocument
        ? applyUserProfileContactFallback(activeResumeDocument, userProfileDetails)
        : null,
    [activeResumeDocument, userProfileDetails],
  );
  const profileTemplatePreviewDocument = useMemo(
    () =>
      templatePreviewDocument
        ? applyUserProfileContactFallback(templatePreviewDocument, userProfileDetails)
        : null,
    [templatePreviewDocument, userProfileDetails],
  );
  const templatePanelDocument = profileTemplatePreviewDocument ?? profileActiveResumeDocument;

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

    function collapseOnViewportChange() {
      setIsTemplatePanelOpen(false);
    }

    window.addEventListener("resize", collapseOnViewportChange);
    window.addEventListener("orientationchange", collapseOnViewportChange);

    return () => {
      window.removeEventListener("resize", collapseOnViewportChange);
      window.removeEventListener("orientationchange", collapseOnViewportChange);
    };
  }, [isTemplatePanelOpen]);

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
