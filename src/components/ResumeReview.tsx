import {
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowLeft,
  Columns2,
  Download,
  Eye,
  LayoutTemplate,
  ListTodo,
  Loader2,
  Plus,
  Save,
  Send,
  Type,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  copyPlainText,
  downloadResumeDocumentDocx,
  downloadResumeDocumentPdf,
} from "../lib/exportResume";
import { parseResumeContact } from "../resume/contact";
import { ContactDetailList } from "../templates/shared/renderers";
import { ResumeTemplatePreview } from "./ResumeTemplatePreview";
import { useSettings } from "../context/SettingsContext";
import { useToastMessage } from "../context/ToastContext";
import { openAIErrorMessage } from "../lib/openai";
import { reviseResumeSectionWithProvider } from "../lib/providers/dispatch";
import type { LLMProvider } from "../lib/providers/types";
import {
  RESUME_SECTION_TYPE_OPTIONS,
  addResumeDocumentSection,
  inferResumeSectionContentKind,
  inferResumeSectionTypeFromTitle,
  parseResumeDocument,
  removeResumeDocumentSection,
  serializeResumeDocument,
  structuredResumeToDocument,
  updateResumeDocumentSection,
  updateResumeDocumentSectionContentKind,
} from "../lib/resumeDocument";
import type {
  ResumeDocument,
  ResumeSection,
  ResumeSectionContentKind,
  ResumeSectionType,
} from "../resume/schema";
import {
  type ResumeTemplateId,
  getResumeTemplateDefinition,
} from "../templates/registry";
import {
  RESUME_FONT_OPTIONS,
  type ResumeFontId,
} from "../templates/shared/fonts";
import {
  diffWords,
  type DiffToken,
  type StructuredResume,
} from "../lib/resume";
import type { ExportType } from "../lib/storage";
import { ResumeSectionTextEditor } from "./ResumeSectionTextEditor";

type ResumeReviewProps = {
  jobDescription: string;
  originalResumeText: string;
  resume: StructuredResume;
  provider: LLMProvider;
  onResumeChange: (resume: StructuredResume) => void;
  initialTemplateId?: ResumeTemplateId;
  onSaveReview?: (
    resume: StructuredResume,
    templateId: ResumeTemplateId,
  ) => Promise<void>;
  onTemplateChange?: (
    templateId: ResumeTemplateId,
    resume: StructuredResume,
  ) => Promise<void> | void;
  onExported?: (exportType: ExportType) => void | Promise<void>;
  onBack?: () => void;
  topbarPortalTarget?: HTMLElement | null;
  title?: string;
  matchScore?: number | null;
  isTemplatePanelOpen?: boolean;
  onOpenTemplates?: () => void;
};

type SectionConfig = {
  id: string;
  label: string;
};

type SectionComparison = {
  id: string;
  label: string;
  type: ResumeSectionType;
  contentKind?: ResumeSectionContentKind;
  before: string;
  after: string;
  tokens: DiffToken[];
};

const EXPORT_OPTIONS: Array<{ type: ExportType; label: string }> = [
  { type: "docx", label: "DOCX" },
  { type: "pdf", label: "PDF" },
  { type: "copy", label: "Text" },
];

const ADDABLE_RESUME_SECTION_TYPE_OPTIONS = RESUME_SECTION_TYPE_OPTIONS.filter(
  (option) => option.type !== "contact" && option.type !== "custom",
);

export function ResumeReview({
  jobDescription,
  originalResumeText,
  resume,
  provider,
  onResumeChange,
  initialTemplateId,
  onSaveReview,
  onTemplateChange,
  onExported,
  onBack,
  topbarPortalTarget,
  title,
  matchScore,
  isTemplatePanelOpen = false,
  onOpenTemplates,
}: ResumeReviewProps) {
  const [assistantSectionId, setAssistantSectionId] = useState("summary");
  const [assistantInstruction, setAssistantInstruction] = useState("");
  const [revisingSectionId, setRevisingSectionId] = useState("");
  const [revisionStatus, setRevisionStatus] = useState("");
  const [revisionError, setRevisionError] = useState("");
  const [exportError, setExportError] = useState("");
  const [selectedExportTypes, setSelectedExportTypes] = useState<ExportType[]>(["docx", "pdf"]);
  const [isExporting, setIsExporting] = useState(false);
  const [saveReviewStatus, setSaveReviewStatus] = useState("");
  const [saveReviewError, setSaveReviewError] = useState("");
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [isCompareMode, setIsCompareMode] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [addSectionAfterId, setAddSectionAfterId] = useState<string | null>(null);
  const assistantInputRef = useRef<HTMLTextAreaElement | null>(null);
  const {
    selectedTemplateId,
    setSelectedTemplateId,
    selectedFontId,
    setSelectedFontId,
    setTemplatePreviewDocument,
  } = useSettings();
  const persistedTemplateIdRef = useRef<ResumeTemplateId>(initialTemplateId ?? selectedTemplateId);
  const hasAppliedInitialTemplateRef = useRef(!initialTemplateId);

  useEffect(() => {
    if (!initialTemplateId) {
      hasAppliedInitialTemplateRef.current = true;
      return;
    }

    persistedTemplateIdRef.current = initialTemplateId;
    hasAppliedInitialTemplateRef.current = false;
    if (initialTemplateId) {
      setSelectedTemplateId(initialTemplateId);
    }
  }, [initialTemplateId, setSelectedTemplateId]);

  useEffect(() => {
    if (initialTemplateId && selectedTemplateId === initialTemplateId) {
      hasAppliedInitialTemplateRef.current = true;
    }
  }, [initialTemplateId, selectedTemplateId]);

  const originalContactSection = useMemo(
    () => parseResumeDocument(originalResumeText, "Original resume").sections.find((section) => section.type === "contact"),
    [originalResumeText],
  );
  const incomingResumeDocument = useMemo(
    () => withContactSection(structuredResumeToDocument(resume), originalContactSection),
    [originalContactSection, resume],
  );
  const [resumeDocument, setResumeDocument] = useState<ResumeDocument>(incomingResumeDocument);
  const localDocumentSignatureRef = useRef(serializeResumeDocument(incomingResumeDocument));

  useEffect(() => {
    const incomingSignature = serializeResumeDocument(incomingResumeDocument);
    if (incomingSignature === localDocumentSignatureRef.current) return;

    setResumeDocument(incomingResumeDocument);
    localDocumentSignatureRef.current = incomingSignature;
    const firstEditableSection = incomingResumeDocument.sections[0];
    setAssistantSectionId(firstEditableSection?.id ?? "");
  }, [incomingResumeDocument]);

  const sectionComparisons = useMemo(
    () => buildSectionComparisons(originalResumeText, resumeDocument),
    [resumeDocument, originalResumeText],
  );

  const sections: SectionConfig[] = resumeDocument.sections.map((section) => ({
    id: section.id,
    label: section.type === "contact" ? "Header" : section.title,
  }));
  const selectedAssistantSection =
    sections.find((section) => section.id === assistantSectionId) ?? sections[0];
  const selectedDocumentSection = resumeDocument.sections.find(
    (section) => section.id === selectedAssistantSection?.id,
  );
  const removableBodySectionCount = resumeDocument.sections.filter(
    (section) => section.type !== "contact",
  ).length;
  const downloadBaseName = useMemo(
    () => safeDownloadBaseName(title || resumeDocument.title || "optimized-resume"),
    [resumeDocument.title, title],
  );
  const availableAddSectionTitles = useMemo(
    () => getAvailableAddSectionTitles(resumeDocument.sections),
    [resumeDocument.sections],
  );

  useToastMessage(revisionStatus, { kind: "success", title: "Revision complete" });
  useToastMessage(revisionError, { kind: "error", title: "Revision failed", durationMs: 6500 });
  useToastMessage(exportError, { kind: "error", title: "Export failed", durationMs: 6500 });
  useToastMessage(saveReviewStatus, { kind: "success", title: "Saved" });
  useToastMessage(saveReviewError, { kind: "error", title: "Save failed", durationMs: 6500 });

  useEffect(() => {
    setTemplatePreviewDocument(resumeDocument);
    return () => setTemplatePreviewDocument(null);
  }, [resumeDocument, setTemplatePreviewDocument]);

  useEffect(() => {
    if (!onTemplateChange) return;
    if (!hasAppliedInitialTemplateRef.current) return;
    if (selectedTemplateId === persistedTemplateIdRef.current) return;

    persistedTemplateIdRef.current = selectedTemplateId;
    Promise.resolve(onTemplateChange(selectedTemplateId, documentToStructuredResume(resumeDocument, resume))).catch((error) => {
      setSaveReviewError(error instanceof Error ? error.message : "Could not save template choice.");
    });
  }, [onTemplateChange, resume, resumeDocument, selectedTemplateId]);

  function commitResumeDocumentChange(nextDocument: ResumeDocument, sectionId?: string) {
    setResumeDocument(nextDocument);
    localDocumentSignatureRef.current = serializeResumeDocument(nextDocument);
    onResumeChange(documentToStructuredResume(nextDocument, resume));
    if (sectionId) {
      setAssistantSectionId(sectionId);
    }
    setSaveReviewStatus("");
    setSaveReviewError("");
    setRevisionError("");
    setRevisionStatus("");
  }

  async function handleAssistantRevise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAssistantSection || !selectedDocumentSection) return;

    const instruction = assistantInstruction.trim();

    if (!instruction) {
      setRevisionError("Add a revision instruction before submitting.");
      return;
    }

    setRevisingSectionId(selectedAssistantSection.id);
    setRevisionStatus("");
    setRevisionError("");

    try {
      const revisedText = await reviseResumeSectionWithProvider({
        provider,
        jobDescription,
        resume: documentToStructuredResume(resumeDocument, resume),
        sectionLabel: selectedAssistantSection.label,
        sectionText: selectedDocumentSection.content,
        instruction,
      });
      commitResumeDocumentChange(
        updateResumeDocumentSection(resumeDocument, selectedAssistantSection.id, revisedText),
        selectedAssistantSection.id,
      );
      setSaveReviewStatus("");
      setRevisionStatus("Done.");
      setAssistantInstruction("");
    } catch (error) {
      setRevisionError(openAIErrorMessage(error));
    } finally {
      setRevisingSectionId("");
    }
  }

  function handleInlineSectionChange(sectionId: string, value: string) {
    commitResumeDocumentChange(updateResumeDocumentSection(resumeDocument, sectionId, value), sectionId);
  }

  function handleInlineSectionContentKindChange(
    sectionId: string,
    contentKind: ResumeSectionContentKind,
  ) {
    commitResumeDocumentChange(
      updateResumeDocumentSectionContentKind(resumeDocument, sectionId, contentKind),
      sectionId,
    );
  }

  function handleInlineSectionFormatChange(
    sectionId: string,
    content: string,
    contentKind: ResumeSectionContentKind,
  ) {
    commitResumeDocumentChange(
      updateResumeDocumentSectionContentKind(
        updateResumeDocumentSection(resumeDocument, sectionId, content),
        sectionId,
        contentKind,
      ),
      sectionId,
    );
  }

  function handleAddSection(
    afterSectionId: string,
    title: string,
    content: string,
    contentKind: ResumeSectionContentKind,
  ) {
    const previousSectionIds = new Set(resumeDocument.sections.map((section) => section.id));
    const nextSectionType = inferResumeSectionTypeFromTitle(title);
    const nextDocument = addResumeDocumentSection(resumeDocument, nextSectionType, afterSectionId, {
      title,
      content,
      contentKind,
    });
    const nextSection = nextDocument.sections.find((section) => !previousSectionIds.has(section.id));
    commitResumeDocumentChange(nextDocument, nextSection?.id);
    setAddSectionAfterId(null);
  }

  function handleRemoveSectionById(sectionId: string) {
    if (removableBodySectionCount <= 1) return;

    const currentIndex = sections.findIndex((section) => section.id === sectionId);
    const nextDocument = removeResumeDocumentSection(resumeDocument, sectionId);
    const nextSections = nextDocument.sections;
    const nextSelectedSection = nextSections[Math.min(currentIndex, nextSections.length - 1)];
    commitResumeDocumentChange(nextDocument, nextSelectedSection?.id ?? "");
  }

  function handleSelectReviewSection(sectionId: string) {
    setAssistantSectionId(sectionId);
    setRevisionStatus("");
    setRevisionError("");
  }

  function toggleExportType(type: ExportType) {
    setSelectedExportTypes((current) => {
      const next = current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type];
      return EXPORT_OPTIONS.map((option) => option.type).filter((item) => next.includes(item));
    });
  }

  async function exportOne(action: ExportType, baseName: string) {
    if (action === "docx") {
      await downloadResumeDocumentDocx(resumeDocument, selectedTemplateId, `${baseName}.docx`, selectedFontId);
      await onExported?.(action);
    }
    if (action === "pdf") {
      await downloadResumeDocumentPdf(resumeDocument, selectedTemplateId, `${baseName}.pdf`, selectedFontId);
      await onExported?.(action);
    }
    if (action === "copy") {
      await copyPlainText(documentToStructuredResume(resumeDocument, resume));
      await onExported?.(action);
    }
  }

  async function handleExportSelected() {
    if (selectedExportTypes.length === 0) {
      setExportError("Select at least one export format.");
      return;
    }

    setExportError("");

    const hasFileExport = selectedExportTypes.some((type) => type === "docx" || type === "pdf");
    let exportBaseName = downloadBaseName;
    if (hasFileExport) {
      const requestedName = window.prompt("Export file name", downloadBaseName);
      if (requestedName === null) return;
      exportBaseName = safeDownloadBaseName(requestedName || downloadBaseName);
    }
    setIsExporting(true);

    try {
      for (const action of selectedExportTypes) {
        await exportOne(action, exportBaseName);
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleSaveReview() {
    if (!onSaveReview) return;

    setSaveReviewStatus("");
    setSaveReviewError("");
    setIsSavingReview(true);
    try {
      await onSaveReview(documentToStructuredResume(resumeDocument, resume), selectedTemplateId);
      setSaveReviewStatus("Review changes saved.");
    } catch (error) {
      setSaveReviewError(error instanceof Error ? error.message : "Could not save review changes.");
    } finally {
      setIsSavingReview(false);
    }
  }

  const reviewTopbar = (
    <ReviewTopbar
      selectedExportTypes={selectedExportTypes}
      isExporting={isExporting}
      onToggleExportType={toggleExportType}
      onExportSelected={handleExportSelected}
      title={title}
      matchScore={matchScore}
      saveReviewStatus={saveReviewStatus}
      isCompareMode={isCompareMode}
      onToggleCompare={() => setIsCompareMode((isOpen) => !isOpen)}
      isPreviewOpen={isPreviewOpen}
      onTogglePreview={() => setIsPreviewOpen((o) => !o)}
      isTemplatePanelOpen={isTemplatePanelOpen}
      onOpenTemplates={onOpenTemplates}
      selectedFontId={selectedFontId}
      onSelectFont={setSelectedFontId}
      canSaveReview={Boolean(onSaveReview)}
      isSavingReview={isSavingReview}
      onSaveReview={handleSaveReview}
      onBack={onBack}
    />
  );

  const previewOverlay = isPreviewOpen
    ? createPortal(
        <div
          className="template-review-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setIsPreviewOpen(false);
          }}
        >
          <section
            className="template-review-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Resume preview"
          >
            <header className="template-review-header">
              <div>
                <p>Resume preview</p>
                <h3>{getResumeTemplateDefinition(selectedTemplateId).name}</h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon-only"
                aria-label="Close preview"
                onClick={() => setIsPreviewOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="template-review-canvas">
              <ResumeTemplatePreview
                document={resumeDocument}
                templateId={selectedTemplateId}
                fontId={selectedFontId}
              />
            </div>
          </section>
        </div>,
        document.body,
      )
    : null;

  return (
    <section
      className={`review-workspace${isTemplatePanelOpen ? " template-panel-open" : ""}`}
      aria-label="Review workspace"
    >
      {topbarPortalTarget ? createPortal(reviewTopbar, topbarPortalTarget) : reviewTopbar}
      {previewOverlay}

      <div className="tab-content">
        <ResultsTab
          sections={sectionComparisons}
          templateId={selectedTemplateId}
          fontId={selectedFontId}
          selectedSectionId={selectedAssistantSection?.id ?? ""}
          isCompareMode={isCompareMode}
          onCloseCompare={() => setIsCompareMode(false)}
          onSelectAfterSection={handleSelectReviewSection}
          onAfterSectionChange={handleInlineSectionChange}
          onAfterSectionContentKindChange={handleInlineSectionContentKindChange}
          onAfterSectionFormatChange={handleInlineSectionFormatChange}
          canRemoveAfterSection={removableBodySectionCount > 1}
          onRemoveAfterSection={handleRemoveSectionById}
          availableAddSectionTitles={availableAddSectionTitles}
          addSectionAfterId={addSectionAfterId}
          onAddSection={handleAddSection}
          onOpenAddSection={setAddSectionAfterId}
          onCloseAddSection={() => setAddSectionAfterId(null)}
          revisionBar={
            <InlineRevisionBar
              selectedSectionId={selectedAssistantSection?.id ?? ""}
              instruction={assistantInstruction}
              inputRef={assistantInputRef}
              isRevising={Boolean(revisingSectionId)}
              onInstructionChange={(value) => {
                setAssistantInstruction(value);
                setRevisionStatus("");
                setRevisionError("");
              }}
              onSubmit={handleAssistantRevise}
            />
          }
        />
      </div>
    </section>
  );
}

function ReviewTopbar({
  selectedExportTypes,
  isExporting,
  onToggleExportType,
  onExportSelected,
  title,
  matchScore,
  saveReviewStatus,
  isCompareMode,
  onToggleCompare,
  isPreviewOpen,
  onTogglePreview,
  isTemplatePanelOpen,
  onOpenTemplates,
  selectedFontId,
  onSelectFont,
  canSaveReview,
  isSavingReview,
  onSaveReview,
  onBack,
}: {
  selectedExportTypes: ExportType[];
  isExporting: boolean;
  onToggleExportType: (type: ExportType) => void;
  onExportSelected: () => Promise<void>;
  title?: string;
  matchScore?: number | null;
  saveReviewStatus: string;
  isCompareMode: boolean;
  onToggleCompare: () => void;
  isPreviewOpen: boolean;
  onTogglePreview: () => void;
  isTemplatePanelOpen: boolean;
  onOpenTemplates?: () => void;
  selectedFontId: ResumeFontId;
  onSelectFont: (fontId: ResumeFontId) => void;
  canSaveReview: boolean;
  isSavingReview: boolean;
  onSaveReview: () => Promise<void>;
  onBack?: () => void;
}) {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [isFontMenuOpen, setIsFontMenuOpen] = useState(false);
  const exportGroupRef = useRef<HTMLDivElement | null>(null);
  const fontGroupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isExportMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!exportGroupRef.current?.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isExportMenuOpen]);

  useEffect(() => {
    if (!isFontMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!fontGroupRef.current?.contains(event.target as Node)) {
        setIsFontMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isFontMenuOpen]);

  return (
    <div className="review-topbar">
      {onBack ? (
        <button
          className="btn btn-secondary btn-sm review-back-button"
          type="button"
          onClick={onBack}
        >
          <ArrowLeft aria-hidden="true" />
          Back
        </button>
      ) : (
        <Link className="btn btn-secondary btn-sm review-back-button" to="/workspace/optimize">
          <ArrowLeft aria-hidden="true" />
          Back
        </Link>
      )}
      <div className="review-topbar-context">
        <strong>{title?.trim() || "Optimized resume"}</strong>
        <span>
          {matchScore != null ? `${matchScore}% match · ` : ""}
          {saveReviewStatus ? "saved" : "save version when ready"}
        </span>
      </div>
      <div className="review-topbar-actions">
        <button
          className={`btn btn-secondary btn-sm review-icon-action review-preview-button ${
            isPreviewOpen ? "active" : ""
          }`}
          type="button"
          aria-label={isPreviewOpen ? "Close preview" : "Preview resume"}
          aria-pressed={isPreviewOpen}
          data-tooltip={isPreviewOpen ? "Close preview" : "Preview"}
          onClick={onTogglePreview}
        >
          <Eye aria-hidden="true" />
          <span className="review-action-label">Preview</span>
        </button>
        <button
          className={`btn btn-secondary btn-sm review-icon-action review-compare-button ${
            isCompareMode ? "active" : ""
          }`}
          type="button"
          aria-label={isCompareMode ? "Hide comparison" : "Compare before and after"}
          aria-pressed={isCompareMode}
          data-tooltip={isCompareMode ? "Hide comparison" : "Compare"}
          onClick={onToggleCompare}
        >
          <Columns2 aria-hidden="true" />
          <span className="review-action-label">Compare</span>
        </button>
        {onOpenTemplates && (
          <button
            className={`btn btn-secondary btn-sm review-icon-action review-template-button ${
              isTemplatePanelOpen ? "active" : ""
            }`}
            type="button"
            aria-label={isTemplatePanelOpen ? "Close templates" : "Open templates"}
            aria-pressed={isTemplatePanelOpen}
            data-tooltip={isTemplatePanelOpen ? "Close templates" : "Template"}
            onClick={onOpenTemplates}
          >
            <LayoutTemplate aria-hidden="true" />
            <span className="review-action-label">Template</span>
          </button>
        )}
        <div className="review-font-group" ref={fontGroupRef}>
          <button
            className={`btn btn-secondary btn-sm review-icon-action review-font-button ${
              isFontMenuOpen ? "active" : ""
            }`}
            type="button"
            aria-label="Choose resume font"
            aria-expanded={isFontMenuOpen}
            data-tooltip="Font"
            onClick={() => setIsFontMenuOpen((isOpen) => !isOpen)}
          >
            <Type aria-hidden="true" />
            <span className="review-action-label">Font</span>
          </button>
          {isFontMenuOpen && (
            <div className="review-font-menu" aria-label="Resume fonts">
              {RESUME_FONT_OPTIONS.map((option) => (
                <button
                  type="button"
                  className={`review-font-option ${
                    selectedFontId === option.id ? "active" : ""
                  }`}
                  key={option.id}
                  onClick={() => {
                    onSelectFont(option.id);
                    setIsFontMenuOpen(false);
                  }}
                >
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="review-export-group" ref={exportGroupRef}>
          <button
            className="btn btn-secondary btn-sm review-icon-action review-export-button"
            type="button"
            aria-label="Export selected formats"
            data-tooltip="Export"
            disabled={isExporting || selectedExportTypes.length === 0}
            onClick={() => void onExportSelected()}
          >
            {isExporting ? (
              <Loader2 className="spin" aria-hidden="true" />
            ) : (
              <Download aria-hidden="true" />
            )}
            <span className="review-action-label">Export</span>
          </button>
          <button
            className="btn btn-secondary btn-sm review-export-menu-button"
            type="button"
            aria-label="Choose export formats"
            aria-expanded={isExportMenuOpen}
            data-tooltip="Formats"
            disabled={isExporting}
            onClick={() => setIsExportMenuOpen((isOpen) => !isOpen)}
          >
            <ListTodo aria-hidden="true" />
          </button>
          {isExportMenuOpen && (
            <div className="export-format-menu" aria-label="Export formats">
              {EXPORT_OPTIONS.map((option) => (
                <label
                  className={`export-format-toggle ${
                    selectedExportTypes.includes(option.type) ? "active" : ""
                  }`}
                  key={option.type}
                >
                  <input
                    type="checkbox"
                    checked={selectedExportTypes.includes(option.type)}
                    disabled={isExporting}
                    onChange={() => onToggleExportType(option.type)}
                  />
                  <span>{option.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        {canSaveReview && (
          <button
            className="btn btn-primary btn-sm review-topbar-save"
            type="button"
            disabled={isSavingReview}
            onClick={() => void onSaveReview()}
          >
            {isSavingReview ? (
              <Loader2 className="spin" aria-hidden="true" />
            ) : (
              <Save aria-hidden="true" />
            )}
            Save
          </button>
        )}
      </div>
    </div>
  );
}

function ResultsTab({
  sections,
  templateId,
  fontId,
  selectedSectionId,
  isCompareMode,
  onCloseCompare,
  onSelectAfterSection,
  onAfterSectionChange,
  onAfterSectionContentKindChange,
  onAfterSectionFormatChange,
  canRemoveAfterSection,
  onRemoveAfterSection,
  availableAddSectionTitles,
  addSectionAfterId,
  onAddSection,
  onOpenAddSection,
  onCloseAddSection,
  revisionBar,
}: {
  sections: SectionComparison[];
  templateId: ResumeTemplateId;
  fontId: ResumeFontId;
  selectedSectionId: string;
  isCompareMode: boolean;
  onCloseCompare: () => void;
  onSelectAfterSection: (sectionId: string) => void;
  onAfterSectionChange: (sectionId: string, value: string) => void;
  onAfterSectionContentKindChange: (
    sectionId: string,
    contentKind: ResumeSectionContentKind,
  ) => void;
  onAfterSectionFormatChange: (
    sectionId: string,
    content: string,
    contentKind: ResumeSectionContentKind,
  ) => void;
  canRemoveAfterSection: boolean;
  onRemoveAfterSection: (sectionId: string) => void;
  availableAddSectionTitles: string[];
  addSectionAfterId: string | null;
  onAddSection: (
    afterSectionId: string,
    title: string,
    content: string,
    contentKind: ResumeSectionContentKind,
  ) => void;
  onOpenAddSection: (afterSectionId: string) => void;
  onCloseAddSection: () => void;
  revisionBar?: ReactNode;
}) {
  const comparisonRef = useRef<HTMLDivElement | null>(null);
  const [isSinglePane, setIsSinglePane] = useState(false);

  const originalDocument = useMemo(
    () => comparisonDocument(sections, "before"),
    [sections],
  );
  const optimizedDocument = useMemo(
    () => comparisonDocument(sections, "after"),
    [sections],
  );
  const comparisonById = useMemo(
    () => new Map(sections.map((section) => [section.id, section])),
    [sections],
  );
  useEffect(() => {
    const comparison = comparisonRef.current;
    if (!comparison) return;

    function updateLayout(width: number) {
      setIsSinglePane(width < 900);
    }

    updateLayout(comparison.getBoundingClientRect().width);

    const resizeObserver = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width != null) updateLayout(width);
    });
    resizeObserver.observe(comparison);

    return () => resizeObserver.disconnect();
  }, []);

  useEffect(() => {
    if (!isCompareMode) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (comparisonRef.current?.contains(target)) return;
      if (target.closest(".review-compare-button")) return;
      onCloseCompare();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseCompare();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isCompareMode, onCloseCompare]);

  return (
    <div className="results-stage results-template-stage">
      <div
        className={`template-comparison-grid${isSinglePane ? " is-single-pane" : ""} ${
          isCompareMode ? "is-compare-mode" : "is-optimized-only"
        }`}
        ref={comparisonRef}
      >
        {isCompareMode && (
          <div className="template-comparison-pane template-comparison-before">
            <div className="template-comparison-document">
              <ResumeTemplatePreview
                key={`before-${templateId}`}
                document={originalDocument}
                templateId={templateId}
                fontId={fontId}
                renderSectionContent={(section) =>
                  renderDiffSectionContent(section, comparisonById, "before")
                }
              />
            </div>
          </div>
        )}
        <div className="template-comparison-pane template-comparison-after">
          <div className="template-comparison-document">
            <ResumeTemplatePreview
              key={`after-${templateId}`}
              document={optimizedDocument}
              templateId={templateId}
              fontId={fontId}
              afterPreviewContent={!isCompareMode ? revisionBar : undefined}
              renderContactSectionContent={
                isCompareMode
                  ? undefined
                  : (section) =>
                      renderEditableAfterSectionContent(
                        section,
                        comparisonById,
                        selectedSectionId,
                        onSelectAfterSection,
                        onAfterSectionChange,
                        onAfterSectionContentKindChange,
                        onAfterSectionFormatChange,
                        canRemoveAfterSection,
                        onRemoveAfterSection,
                      )
              }
              renderSectionContent={(section) =>
                isCompareMode
                  ? renderDiffSectionContent(section, comparisonById, "after")
                  : renderEditableAfterSectionContent(
                      section,
                      comparisonById,
                      selectedSectionId,
                      onSelectAfterSection,
                      onAfterSectionChange,
                      onAfterSectionContentKindChange,
                      onAfterSectionFormatChange,
                      canRemoveAfterSection,
                      onRemoveAfterSection,
                      {
                        availableSectionTitles: availableAddSectionTitles,
                        isAddSectionOpen: addSectionAfterId === section.id,
                        onAddSection: (title, content, contentKind) =>
                          onAddSection(section.id, title, content, contentKind),
                        onOpenAddSection: () => onOpenAddSection(section.id),
                        onCloseAddSection,
                      },
                    )
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function InlineRevisionBar({
  selectedSectionId,
  instruction,
  inputRef,
  isRevising,
  onInstructionChange,
  onSubmit,
}: {
  selectedSectionId: string;
  instruction: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isRevising: boolean;
  onInstructionChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  function handleInstructionKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  return (
    <div className="review-inline-revision-card">
      <form className="review-inline-revision-form" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          className="review-inline-revision-input"
          value={isRevising ? "Submitting..." : instruction}
          rows={1}
          disabled={isRevising}
          placeholder="Click any section above to edit directly, or ask AI"
          onChange={(event) => onInstructionChange(event.target.value)}
          onKeyDown={handleInstructionKeyDown}
        />
        <button
          className="btn btn-primary review-inline-revision-submit"
          type="submit"
          disabled={isRevising || !instruction.trim() || !selectedSectionId}
          aria-label={isRevising ? "Revising selected section" : "Revise selected section"}
          title={isRevising ? "Revising" : "Revise"}
        >
          {isRevising ? (
            <Loader2 className="spin" aria-hidden="true" />
          ) : (
            <Send aria-hidden="true" />
          )}
        </button>
      </form>
    </div>
  );
}

function buildSectionComparisons(originalResumeText: string, resumeDocument: ResumeDocument): SectionComparison[] {
  const originalDocument = parseResumeDocument(originalResumeText, "Original resume");
  const originalSectionsByType = new Map<ResumeSectionType, string>();
  const originalSectionsByTitle = new Map<string, string>();

  for (const section of originalDocument.sections) {
    const content = section.content.trim();
    if (!content) continue;
    originalSectionsByType.set(
      section.type,
      [originalSectionsByType.get(section.type), content].filter(Boolean).join("\n\n"),
    );
    originalSectionsByTitle.set(normalizeSectionTitle(section.title), content);
  }

  const optimizedSections: Array<Omit<SectionComparison, "tokens">> = resumeDocument.sections.map((section) => ({
    id: section.id,
    label: section.title,
    type: section.type,
    contentKind: section.contentKind,
    before:
      section.type === "contact"
        ? section.content
        : originalSectionsByTitle.get(normalizeSectionTitle(section.title)) ??
          originalSectionsByType.get(section.type) ??
          "",
    after: section.content,
  }));

  const comparisons = optimizedSections
    .map((section) => ({
      ...section,
      before: section.before.trim(),
      after: section.after,
    }))
    .filter((section) => section.before || section.after || section.label.trim())
    .map((section) => ({
      ...section,
      tokens: diffWords(section.before, section.after),
    }));

  if (comparisons.length > 0 && comparisons.some((section) => section.before)) {
    return comparisons;
  }

  const fallbackAfter = serializeResumeDocument(resumeDocument);
  const fallbackTokens = diffWords(originalResumeText.trim(), fallbackAfter);
  return [
    {
      id: "resume",
      label: "Resume",
      type: "custom",
      contentKind: "paragraph",
      before: originalResumeText.trim(),
      after: fallbackAfter,
      tokens: fallbackTokens,
    },
  ];
}

function comparisonDocument(
  sections: SectionComparison[],
  side: "before" | "after",
): ResumeDocument {
  return {
    id: `${side}-comparison`,
    title: "",
    sections: sections.map((section, index) => ({
      id: section.id,
      type: section.type,
      title: section.label,
      content: side === "before" ? section.before : section.after,
      contentKind: section.contentKind,
      order: index,
    })),
  };
}

function renderDiffSectionContent(
  section: ResumeSection,
  comparisonById: Map<string, SectionComparison>,
  side: "before" | "after",
) {
  const comparison = comparisonById.get(section.id);
  const sourceText = side === "before" ? comparison?.before : comparison?.after;

  if (!comparison || !sourceText?.trim()) {
    return (
      <p className="template-diff-empty">
        {side === "before" ? "No matching original text found." : "No optimized text."}
      </p>
    );
  }

  return (
    <div className={`template-diff-content template-diff-${side}`}>
      {comparison.tokens
        .filter((token) =>
          side === "before" ? token.type !== "added" : token.type !== "removed",
        )
        .map((token, index) => (
          <span
            className={`template-diff-token template-diff-token-${token.type}`}
            key={`${token.type}-${index}-${token.value.slice(0, 8)}`}
          >
            {token.value}
          </span>
        ))}
    </div>
  );
}

function renderEditableAfterSectionContent(
  section: ResumeSection,
  comparisonById: Map<string, SectionComparison>,
  selectedSectionId: string,
  onSelectAfterSection: (sectionId: string) => void,
  onAfterSectionChange: (sectionId: string, value: string) => void,
  onAfterSectionContentKindChange: (
    sectionId: string,
    contentKind: ResumeSectionContentKind,
  ) => void,
  onAfterSectionFormatChange: (
    sectionId: string,
    content: string,
    contentKind: ResumeSectionContentKind,
  ) => void,
  canRemoveAfterSection: boolean,
  onRemoveAfterSection: (sectionId: string) => void,
  addSectionControl?: {
    availableSectionTitles: string[];
    isAddSectionOpen: boolean;
    onAddSection: (title: string, content: string, contentKind: ResumeSectionContentKind) => void;
    onOpenAddSection: () => void;
    onCloseAddSection: () => void;
  },
) {
  if (section.type === "contact" || section.id === "contact") {
    if (section.id !== selectedSectionId) {
      const { name, details } = parseResumeContact(section.content);
      return (
        <div
          className="review-contact-view"
          role="button"
          tabIndex={0}
          onClick={() => onSelectAfterSection(section.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectAfterSection(section.id);
            }
          }}
        >
          {name && <h1>{name}</h1>}
          <ContactDetailList details={details} />
        </div>
      );
    }
    return (
      <div className="review-editable-section-shell review-editable-contact-shell">
        <ResumeSectionTextEditor
          section={section}
          isSelected={true}
          className="review-contact-editor"
          onSelect={() => onSelectAfterSection(section.id)}
          onContentChange={(content) => onAfterSectionChange(section.id, content)}
          textareaClassName="review-document-textarea review-document-contact-textarea"
          toolbarAction={
            <button
              className="resume-section-format-delete"
              type="button"
              aria-label="Clear header"
              title="Clear header"
              onClick={(event) => {
                event.stopPropagation();
                onSelectAfterSection(section.id);
                onAfterSectionChange(section.id, "");
              }}
            >
              <X aria-hidden="true" />
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="review-editable-section-shell">
      <ResumeSectionTextEditor
        section={section}
        isSelected={section.id === selectedSectionId}
        onSelect={() => onSelectAfterSection(section.id)}
        onContentChange={(content) => onAfterSectionChange(section.id, content)}
        onContentKindChange={(contentKind) =>
          onAfterSectionContentKindChange(section.id, contentKind)
        }
        onContentAndKindChange={(content, contentKind) =>
          onAfterSectionFormatChange(section.id, content, contentKind)
        }
        toolbarAction={
          canRemoveAfterSection ? (
            <button
              className="resume-section-format-delete"
              type="button"
              aria-label={`Delete ${section.title}`}
              title={`Delete ${section.title}`}
              onClick={(event) => {
                event.stopPropagation();
                onRemoveAfterSection(section.id);
              }}
            >
              <X aria-hidden="true" />
            </button>
          ) : null
        }
        textareaClassName="review-document-textarea"
      />
      {addSectionControl && <InlineAddSectionControl {...addSectionControl} />}
    </div>
  );
}

function InlineAddSectionControl({
  availableSectionTitles,
  isAddSectionOpen,
  onAddSection,
  onOpenAddSection,
  onCloseAddSection,
}: {
  availableSectionTitles: string[];
  isAddSectionOpen: boolean;
  onAddSection: (title: string, content: string, contentKind: ResumeSectionContentKind) => void;
  onOpenAddSection: () => void;
  onCloseAddSection: () => void;
}) {
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionContent, setSectionContent] = useState("");
  const [sectionContentKind, setSectionContentKind] = useState<ResumeSectionContentKind>("paragraph");
  const [selectedTitleOption, setSelectedTitleOption] = useState("other");
  const draftSectionType = inferResumeSectionTypeFromTitle(sectionTitle);
  const draftSection: ResumeSection = {
    id: "draft-section",
    type: draftSectionType,
    title: sectionTitle.trim() || "New section",
    content: sectionContent,
    contentKind: sectionContentKind,
    order: 0,
  };

  useEffect(() => {
    if (!isAddSectionOpen) return;
    const firstSuggestedTitle = availableSectionTitles[0] ?? "other";
    const nextTitle = firstSuggestedTitle === "other" ? "" : firstSuggestedTitle;
    setSelectedTitleOption(firstSuggestedTitle);
    setSectionTitle(nextTitle);
    setSectionContentKind(defaultContentKindForTitle(nextTitle));
    setSectionContent("");
  }, [availableSectionTitles, isAddSectionOpen]);

  if (!isAddSectionOpen) {
    return (
      <button
        className="review-inline-add-section review-inline-add-trigger"
        type="button"
        onClick={onOpenAddSection}
      >
        <Plus aria-hidden="true" />
        Add section here
      </button>
    );
  }

  return (
    <div className="review-inline-add-section review-inline-add-panel">
      <div className="review-inline-add-header">
        <span>Add a resume section</span>
      </div>
      <div className="review-inline-add-fields">
        <label className="review-inline-add-field">
          <span>Suggested title</span>
          <select
            value={selectedTitleOption}
            onChange={(event) => {
              const nextTitle = event.target.value;
              const titleValue = nextTitle === "other" ? "" : nextTitle;
              setSelectedTitleOption(nextTitle);
              setSectionTitle(titleValue);
              setSectionContentKind(defaultContentKindForTitle(titleValue));
            }}
            aria-label="Suggested section title"
          >
            {availableSectionTitles.map((title) => (
              <option key={title} value={title}>
                {title}
              </option>
            ))}
            <option value="other">Other</option>
          </select>
        </label>
        <label className="review-inline-add-field">
          <span>Title</span>
          <input
            type="text"
            value={sectionTitle}
            placeholder="Projects, Leadership, Open Source..."
            onChange={(event) => {
              const nextTitle = event.target.value;
              setSectionTitle(nextTitle);
              setSelectedTitleOption("other");
              setSectionContentKind(defaultContentKindForTitle(nextTitle));
            }}
          />
        </label>
        <label className="review-inline-add-field review-inline-add-field-wide">
          <span>Content</span>
          <ResumeSectionTextEditor
            section={draftSection}
            className="review-inline-add-editor"
            textareaClassName="review-inline-add-textarea"
            onContentChange={setSectionContent}
            onContentKindChange={setSectionContentKind}
          />
        </label>
      </div>
      <div className="review-inline-add-controls">
        <button className="btn btn-secondary btn-sm" type="button" onClick={onCloseAddSection}>
          Cancel
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          disabled={!sectionTitle.trim() || !sectionContent.trim()}
          onClick={() => onAddSection(sectionTitle, sectionContent, sectionContentKind)}
        >
          <Plus aria-hidden="true" />
          Add
        </button>
      </div>
    </div>
  );
}

function documentToStructuredResume(
  document: ResumeDocument,
  fallback: StructuredResume,
): StructuredResume {
  const orderedSections = document.sections
    .slice()
    .sort((left, right) => left.order - right.order)
    .map((section, index) => ({ ...section, order: index }));
  const sectionContent = (type: ResumeSectionType) =>
    orderedSections.find((section) => section.type === type)?.content ?? "";
  const splitList = (value: string) =>
    value
      .split(/\n|,/)
      .map((item) => item.replace(/^[-•]\s*/, "").trim())
      .filter(Boolean);
  const hasSection = (type: ResumeSectionType) =>
    orderedSections.some((section) => section.type === type && section.content.trim());

  return {
    ...fallback,
    summary: sectionContent("summary").trim(),
    experience: hasSection("experience") ? [] : fallback.experience,
    skills: hasSection("skills") ? splitList(sectionContent("skills")) : fallback.skills,
    education: orderedSections
      .some((section) => section.type === "education" && section.content.trim())
      ? orderedSections
          .filter((section) => section.type === "education")
          .flatMap((section) => splitList(section.content))
      : fallback.education,
    sections: orderedSections,
  };
}

function withContactSection(
  document: ResumeDocument,
  contactSection?: ResumeSection,
): ResumeDocument {
  if (!contactSection || document.sections.some((section) => section.type === "contact")) {
    return document;
  }

  return {
    ...document,
    sections: [
      {
        ...contactSection,
        id: "contact-0",
        order: -1,
      },
      ...document.sections.map((section) => ({
        ...section,
        order: section.order + 1,
      })),
    ],
  };
}

function normalizeSectionTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function getAvailableAddSectionTitles(sections: ResumeSection[]): string[] {
  const existingKeys = new Set(
    sections
      .filter((section) => section.type !== "contact")
      .flatMap((section) => [
        normalizeSectionTitle(section.title),
        section.type === "custom" ? "" : section.type,
      ])
      .filter(Boolean),
  );

  return ADDABLE_RESUME_SECTION_TYPE_OPTIONS
    .filter((option) => {
      const optionTitleKey = normalizeSectionTitle(option.title);
      return !existingKeys.has(option.type) && !existingKeys.has(optionTitleKey);
    })
    .map((option) => option.title);
}

function defaultContentKindForTitle(title: string): ResumeSectionContentKind {
  const sectionType = inferResumeSectionTypeFromTitle(title);
  return inferResumeSectionContentKind(sectionType, title);
}

function safeDownloadBaseName(value: string): string {
  return (
    value
      .trim()
      .replace(/\.[a-z0-9]{2,5}$/i, "")
      .replace(/[^a-z0-9._ -]+/gi, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[.-]+|[.-]+$/g, "")
      .slice(0, 80) || "optimized-resume"
  );
}
