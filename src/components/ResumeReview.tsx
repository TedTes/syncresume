import { type FormEvent, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Columns2,
  Download,
  LayoutTemplate,
  ListTodo,
  Loader2,
  Plus,
  Save,
  Send,
  X,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import {
  copyPlainText,
  downloadResumeDocumentDocx,
  downloadResumeDocumentPdf,
} from "../lib/exportResume";
import { ResumeTemplatePreview } from "./ResumeTemplatePreview";
import { useSettings } from "../context/SettingsContext";
import { openAIErrorMessage } from "../lib/openai";
import { reviseResumeSectionWithProvider } from "../lib/providers/dispatch";
import type { LLMProvider } from "../lib/providers/types";
import {
  RESUME_SECTION_TYPE_OPTIONS,
  addResumeDocumentSection,
  inferResumeSectionTypeFromTitle,
  parseResumeDocument,
  removeResumeDocumentSection,
  serializeResumeDocument,
  structuredResumeToDocument,
  updateResumeDocumentSection,
} from "../lib/resumeDocument";
import type { ResumeDocument, ResumeSection, ResumeSectionType } from "../resume/schema";
import {
  type ResumeTemplateId,
} from "../templates/registry";
import {
  diffWords,
  type DiffToken,
  type StructuredResume,
} from "../lib/resume";
import type { ExportType } from "../lib/storage";

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

function EditableReviewSectionTextarea({
  section,
  isSelected,
  onChange,
  onSelect,
}: {
  section: ResumeSection;
  isSelected: boolean;
  onChange: (content: string) => void;
  onSelect: () => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useLayoutEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, [section.content]);

  return (
    <textarea
      ref={textareaRef}
      className={`document-section-textarea review-document-textarea review-document-textarea-${section.type} ${
        isSelected ? "is-selected" : ""
      }`}
      value={section.content}
      rows={1}
      aria-label={`Edit optimized ${section.title}`}
      spellCheck
      onFocus={onSelect}
      onClick={onSelect}
      onInput={(event) => {
        const textarea = event.currentTarget;
        textarea.style.height = "auto";
        textarea.style.height = `${textarea.scrollHeight}px`;
      }}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

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
  const [addSectionAfterId, setAddSectionAfterId] = useState<string | null>(null);
  const assistantInputRef = useRef<HTMLTextAreaElement | null>(null);
  const {
    selectedTemplateId,
    setSelectedTemplateId,
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
    const firstEditableSection = incomingResumeDocument.sections.find((section) => section.type !== "contact");
    setAssistantSectionId(firstEditableSection?.id ?? "");
  }, [incomingResumeDocument]);

  const sectionComparisons = useMemo(
    () => buildSectionComparisons(originalResumeText, resumeDocument),
    [originalResumeText, resumeDocument],
  );

  const sections: SectionConfig[] = resumeDocument.sections
    .filter((section) => section.type !== "contact")
    .map((section) => ({
      id: section.id,
      label: section.title,
    }));
  const selectedAssistantSection =
    sections.find((section) => section.id === assistantSectionId) ?? sections[0];
  const selectedDocumentSection = resumeDocument.sections.find(
    (section) => section.id === selectedAssistantSection?.id,
  );
  const downloadBaseName = useMemo(
    () => safeDownloadBaseName(title || resumeDocument.title || "optimized-resume"),
    [resumeDocument.title, title],
  );
  const availableAddSectionTitles = useMemo(
    () => getAvailableAddSectionTitles(resumeDocument.sections),
    [resumeDocument.sections],
  );

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
      setRevisionStatus(`${selectedAssistantSection.label} updated.`);
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

  function handleAddSection(afterSectionId: string, title: string, content: string) {
    const previousSectionIds = new Set(resumeDocument.sections.map((section) => section.id));
    const nextSectionType = inferResumeSectionTypeFromTitle(title);
    const nextDocument = addResumeDocumentSection(resumeDocument, nextSectionType, afterSectionId, {
      title,
      content,
    });
    const nextSection = nextDocument.sections.find((section) => !previousSectionIds.has(section.id));
    commitResumeDocumentChange(nextDocument, nextSection?.id);
    setAddSectionAfterId(null);
  }

  function handleRemoveSectionById(sectionId: string) {
    if (sections.length <= 1) return;

    const currentIndex = sections.findIndex((section) => section.id === sectionId);
    const nextDocument = removeResumeDocumentSection(resumeDocument, sectionId);
    const nextSections = nextDocument.sections.filter((section) => section.type !== "contact");
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

  async function exportOne(action: ExportType) {
    if (action === "docx") {
      await downloadResumeDocumentDocx(resumeDocument, selectedTemplateId, `${downloadBaseName}.docx`);
      await onExported?.(action);
    }
    if (action === "pdf") {
      await downloadResumeDocumentPdf(resumeDocument, selectedTemplateId, `${downloadBaseName}.pdf`);
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
    setIsExporting(true);

    try {
      for (const action of selectedExportTypes) {
        await exportOne(action);
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
      isTemplatePanelOpen={isTemplatePanelOpen}
      onOpenTemplates={onOpenTemplates}
      canSaveReview={Boolean(onSaveReview)}
      isSavingReview={isSavingReview}
      onSaveReview={handleSaveReview}
      onBack={onBack}
    />
  );

  return (
    <section
      className={`review-workspace${isTemplatePanelOpen ? " template-panel-open" : ""}`}
      aria-label="Review workspace"
    >
      {topbarPortalTarget ? createPortal(reviewTopbar, topbarPortalTarget) : reviewTopbar}

      <div className="tab-content">
        <ResultsTab
          sections={sectionComparisons}
          templateId={selectedTemplateId}
          selectedSectionId={selectedAssistantSection?.id ?? ""}
          isCompareMode={isCompareMode}
          onCloseCompare={() => setIsCompareMode(false)}
          onSelectAfterSection={handleSelectReviewSection}
          onAfterSectionChange={handleInlineSectionChange}
          canRemoveAfterSection={sections.length > 1}
          onRemoveAfterSection={handleRemoveSectionById}
          availableAddSectionTitles={availableAddSectionTitles}
          addSectionAfterId={addSectionAfterId}
          onAddSection={handleAddSection}
          onOpenAddSection={setAddSectionAfterId}
          onCloseAddSection={() => setAddSectionAfterId(null)}
        />

        <InlineRevisionBar
          selectedSectionId={selectedAssistantSection?.id ?? ""}
          selectedSectionLabel={selectedAssistantSection?.label ?? "section"}
          instruction={assistantInstruction}
          inputRef={assistantInputRef}
          isRevising={Boolean(revisingSectionId)}
          revisionStatus={revisionStatus}
          revisionError={revisionError}
          onInstructionChange={(value) => {
            setAssistantInstruction(value);
            setRevisionStatus("");
            setRevisionError("");
          }}
          onSubmit={handleAssistantRevise}
        />

        <StatusMessages
          exportError={exportError}
        />
        {saveReviewStatus && <p className="export-status-msg">{saveReviewStatus}</p>}
        {saveReviewError && <div className="inline-error">{saveReviewError}</div>}
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
  isTemplatePanelOpen,
  onOpenTemplates,
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
  isTemplatePanelOpen: boolean;
  onOpenTemplates?: () => void;
  canSaveReview: boolean;
  isSavingReview: boolean;
  onSaveReview: () => Promise<void>;
  onBack?: () => void;
}) {
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportGroupRef = useRef<HTMLDivElement | null>(null);

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
          className={`btn btn-secondary btn-sm review-compare-button ${
            isCompareMode ? "active" : ""
          }`}
          type="button"
          aria-pressed={isCompareMode}
          onClick={onToggleCompare}
        >
          <Columns2 aria-hidden="true" />
          Compare
        </button>
        {onOpenTemplates && (
          <button
            className={`btn btn-secondary btn-sm review-template-button ${
              isTemplatePanelOpen ? "active" : ""
            }`}
            type="button"
            aria-pressed={isTemplatePanelOpen}
            onClick={onOpenTemplates}
          >
            <LayoutTemplate aria-hidden="true" />
            Template
          </button>
        )}
        <div className="review-export-group" ref={exportGroupRef}>
          <button
            className="btn btn-secondary btn-sm review-export-button"
            type="button"
            disabled={isExporting || selectedExportTypes.length === 0}
            onClick={() => void onExportSelected()}
          >
            {isExporting ? (
              <Loader2 className="spin" aria-hidden="true" />
            ) : (
              <Download aria-hidden="true" />
            )}
            Export
          </button>
          <button
            className="btn btn-secondary btn-sm review-export-menu-button"
            type="button"
            aria-label="Choose export formats"
            aria-expanded={isExportMenuOpen}
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
  selectedSectionId,
  isCompareMode,
  onCloseCompare,
  onSelectAfterSection,
  onAfterSectionChange,
  canRemoveAfterSection,
  onRemoveAfterSection,
  availableAddSectionTitles,
  addSectionAfterId,
  onAddSection,
  onOpenAddSection,
  onCloseAddSection,
}: {
  sections: SectionComparison[];
  templateId: ResumeTemplateId;
  selectedSectionId: string;
  isCompareMode: boolean;
  onCloseCompare: () => void;
  onSelectAfterSection: (sectionId: string) => void;
  onAfterSectionChange: (sectionId: string, value: string) => void;
  canRemoveAfterSection: boolean;
  onRemoveAfterSection: (sectionId: string) => void;
  availableAddSectionTitles: string[];
  addSectionAfterId: string | null;
  onAddSection: (afterSectionId: string, title: string, content: string) => void;
  onOpenAddSection: (afterSectionId: string) => void;
  onCloseAddSection: () => void;
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
            <ResumeTemplatePreview
              key={`before-${templateId}`}
              document={originalDocument}
              templateId={templateId}
              renderSectionContent={(section) =>
                renderDiffSectionContent(section, comparisonById, "before")
              }
            />
          </div>
        )}
        <div className="template-comparison-pane template-comparison-after">
          <ResumeTemplatePreview
            key={`after-${templateId}`}
            document={optimizedDocument}
            templateId={templateId}
            renderSectionContent={(section) =>
              isCompareMode
                ? renderDiffSectionContent(section, comparisonById, "after")
                : renderEditableAfterSectionContent(
                    section,
                    comparisonById,
                    selectedSectionId,
                    onSelectAfterSection,
                    onAfterSectionChange,
                    canRemoveAfterSection,
                    onRemoveAfterSection,
                    {
                      availableSectionTitles: availableAddSectionTitles,
                      isAddSectionOpen: addSectionAfterId === section.id,
                      onAddSection: (title, content) => onAddSection(section.id, title, content),
                      onOpenAddSection: () => onOpenAddSection(section.id),
                      onCloseAddSection,
                    },
                  )
            }
          />
        </div>
      </div>
    </div>
  );
}

function InlineRevisionBar({
  selectedSectionId,
  selectedSectionLabel,
  instruction,
  inputRef,
  isRevising,
  revisionStatus,
  revisionError,
  onInstructionChange,
  onSubmit,
}: {
  selectedSectionId: string;
  selectedSectionLabel: string;
  instruction: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isRevising: boolean;
  revisionStatus: string;
  revisionError: string;
  onInstructionChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  return (
    <div className="review-inline-revision" aria-label="Inline AI revision">
      <div className="review-inline-revision-inner">
        <div className="review-inline-revision-hint">
          <span>Click any section above to edit directly, or ask AI below.</span>
        </div>
        <form className="review-inline-revision-form" onSubmit={onSubmit}>
          <textarea
            ref={inputRef}
            className="review-inline-revision-input"
            value={instruction}
            rows={1}
            disabled={isRevising}
            placeholder={`Ask AI to revise the selected ${selectedSectionLabel.toLowerCase()}...`}
            onChange={(event) => onInstructionChange(event.target.value)}
          />
          <button
            className="btn btn-primary review-inline-revision-submit"
            type="submit"
            disabled={isRevising || !instruction.trim() || !selectedSectionId}
          >
            {isRevising ? (
              <Loader2 className="spin" aria-hidden="true" />
            ) : (
              <Send aria-hidden="true" />
            )}
            {isRevising ? "Revising..." : "Revise"}
          </button>
        </form>
        {revisionStatus && <p className="export-status-msg">{revisionStatus}</p>}
        {revisionError && <div className="inline-error">{revisionError}</div>}
      </div>
    </div>
  );
}

function StatusMessages({ exportError }: { exportError: string }) {
  return (
    <>
      {exportError && <div className="inline-error">{exportError}</div>}
    </>
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
  canRemoveAfterSection: boolean,
  onRemoveAfterSection: (sectionId: string) => void,
  addSectionControl?: {
    availableSectionTitles: string[];
    isAddSectionOpen: boolean;
    onAddSection: (title: string, content: string) => void;
    onOpenAddSection: () => void;
    onCloseAddSection: () => void;
  },
) {
  if (section.type === "contact" || section.id === "contact") {
    return renderDiffSectionContent(section, comparisonById, "after");
  }

  return (
    <div className="review-editable-section-shell">
      {canRemoveAfterSection && (
        <button
          className="review-inline-delete-section"
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
      )}
      <EditableReviewSectionTextarea
        section={section}
        isSelected={section.id === selectedSectionId}
        onSelect={() => onSelectAfterSection(section.id)}
        onChange={(content) => onAfterSectionChange(section.id, content)}
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
  onAddSection: (title: string, content: string) => void;
  onOpenAddSection: () => void;
  onCloseAddSection: () => void;
}) {
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionContent, setSectionContent] = useState("");
  const [selectedTitleOption, setSelectedTitleOption] = useState("other");

  useEffect(() => {
    if (!isAddSectionOpen) return;
    const firstSuggestedTitle = availableSectionTitles[0] ?? "other";
    setSelectedTitleOption(firstSuggestedTitle);
    setSectionTitle(firstSuggestedTitle === "other" ? "" : firstSuggestedTitle);
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
              setSelectedTitleOption(nextTitle);
              setSectionTitle(nextTitle === "other" ? "" : nextTitle);
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
              setSectionTitle(event.target.value);
              setSelectedTitleOption("other");
            }}
          />
        </label>
        <label className="review-inline-add-field review-inline-add-field-wide">
          <span>Content</span>
          <textarea
            value={sectionContent}
            rows={3}
            placeholder="Add the content for this section..."
            onChange={(event) => setSectionContent(event.target.value)}
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
          onClick={() => onAddSection(sectionTitle, sectionContent)}
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

  return {
    ...fallback,
    summary: sectionContent("summary").trim(),
    experience: orderedSections
      .filter((section) => section.type === "experience")
      .map((section, index) => ({
        id: section.id || `experience-${index}`,
        title: section.title,
        company: "",
        location: "",
        dates: "",
        bullets: section.content
          .split("\n")
          .map((line) => line.replace(/^[-•]\s*/, "").trim())
          .filter(Boolean),
      })),
    skills: splitList(sectionContent("skills")),
    education: orderedSections
      .filter((section) => section.type === "education")
      .flatMap((section) => splitList(section.content)),
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
