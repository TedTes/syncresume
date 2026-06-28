import { type FormEvent, type RefObject, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Columns2,
  Download,
  LayoutTemplate,
  ListTodo,
  Loader2,
  Save,
  Send,
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
import { parseResumeDocument, structuredResumeToDocument } from "../lib/resumeDocument";
import type { ResumeDocument, ResumeSection, ResumeSectionType } from "../resume/schema";
import {
  type ResumeTemplateId,
} from "../templates/registry";
import {
  diffWords,
  experienceRoleToText,
  replaceSection,
  resumeToPlainText,
  sectionText,
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
  const assistantInputRef = useRef<HTMLTextAreaElement | null>(null);
  const {
    selectedTemplateId,
    setSelectedTemplateId,
    setTemplatePreviewDocument,
  } = useSettings();

  useEffect(() => {
    if (initialTemplateId) {
      setSelectedTemplateId(initialTemplateId);
    }
  }, [initialTemplateId, setSelectedTemplateId]);

  const originalContactSection = useMemo(
    () => parseResumeDocument(originalResumeText, "Original resume").sections.find((section) => section.type === "contact"),
    [originalResumeText],
  );
  const resumeDocument = useMemo(
    () => withContactSection(structuredResumeToDocument(resume), originalContactSection),
    [originalContactSection, resume],
  );
  const sectionComparisons = useMemo(
    () => buildSectionComparisons(originalResumeText, resume),
    [originalResumeText, resume],
  );

  const sections: SectionConfig[] = [
    { id: "summary", label: "Summary" },
    ...resume.experience.map((role, index) => ({
      id: `experience:${role.id}`,
      label: role.title || `Experience ${index + 1}`,
    })),
    { id: "skills", label: "Skills" },
    { id: "education", label: "Education" },
  ];
  const selectedAssistantSection =
    sections.find((section) => section.id === assistantSectionId) ?? sections[0];

  useEffect(() => {
    setTemplatePreviewDocument(resumeDocument);
    return () => setTemplatePreviewDocument(null);
  }, [resumeDocument, setTemplatePreviewDocument]);

  async function handleAssistantRevise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAssistantSection) return;

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
        resume,
        sectionLabel: selectedAssistantSection.label,
        sectionText: sectionText(resume, selectedAssistantSection.id),
        instruction,
      });
      onResumeChange(replaceSection(resume, selectedAssistantSection.id, revisedText));
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
    onResumeChange(replaceSection(resume, sectionId, value));
    setAssistantSectionId(sectionId);
    setSaveReviewStatus("");
    setRevisionError("");
    setRevisionStatus("");
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
      await downloadResumeDocumentDocx(resumeDocument, selectedTemplateId, "syncresume-optimized-resume.docx");
      await onExported?.(action);
    }
    if (action === "pdf") {
      await downloadResumeDocumentPdf(resumeDocument, selectedTemplateId, "syncresume-optimized-resume.pdf");
      await onExported?.(action);
    }
    if (action === "copy") {
      await copyPlainText(resume);
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
      await onSaveReview(resume, selectedTemplateId);
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
}: {
  sections: SectionComparison[];
  templateId: ResumeTemplateId;
  selectedSectionId: string;
  isCompareMode: boolean;
  onCloseCompare: () => void;
  onSelectAfterSection: (sectionId: string) => void;
  onAfterSectionChange: (sectionId: string, value: string) => void;
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
          {selectedSectionId && <span>Selected: {selectedSectionLabel}</span>}
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

function buildSectionComparisons(originalResumeText: string, resume: StructuredResume): SectionComparison[] {
  const originalSections = extractOriginalResumeSections(originalResumeText);
  const optimizedSections: Array<Omit<SectionComparison, "tokens">> = [
    ...(originalSections.contact
      ? [
          {
            id: "contact",
            label: "Contact",
            type: "contact" as const,
            before: originalSections.contact,
            after: originalSections.contact,
          },
        ]
      : []),
    {
      id: "summary",
      label: "Summary",
      type: "summary" as const,
      before: originalSections.summary,
      after: resume.summary,
    },
    {
      id: "experience",
      label: "Experience",
      type: "experience" as const,
      before: originalSections.experience,
      after: resume.experience.map(experienceRoleToText).filter(Boolean).join("\n\n"),
    },
    {
      id: "skills",
      label: "Skills",
      type: "skills" as const,
      before: originalSections.skills,
      after: resume.skills.join(", "),
    },
    {
      id: "education",
      label: "Education",
      type: "education" as const,
      before: originalSections.education,
      after: resume.education.join("\n"),
    },
  ];

  const comparisons = optimizedSections
    .map((section) => ({
      ...section,
      before: section.before.trim(),
      after: section.after.trim(),
    }))
    .filter((section) => section.before || section.after)
    .map((section) => ({
      ...section,
      tokens: diffWords(section.before, section.after),
    }));

  if (comparisons.length > 0 && comparisons.some((section) => section.before)) {
    return comparisons;
  }

  const fallbackAfter = resumeToPlainText(resume);
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
) {
  if (section.type === "contact" || section.id === "contact") {
    return renderDiffSectionContent(section, comparisonById, "after");
  }

  return (
    <EditableReviewSectionTextarea
      section={section}
      isSelected={section.id === selectedSectionId}
      onSelect={() => onSelectAfterSection(section.id)}
      onChange={(content) => onAfterSectionChange(section.id, content)}
    />
  );
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

function extractOriginalResumeSections(text: string): Record<"contact" | "summary" | "experience" | "skills" | "education", string> {
  const originalDocument = parseResumeDocument(text, "Original resume");
  const contact = originalDocument.sections.find((section) => section.type === "contact")?.content.trim() ?? "";
  const normalizedText = text.replace(/\r\n?/g, "\n");
  const headings = findResumeHeadings(normalizedText);
  const sections = {
    contact,
    summary: "",
    experience: "",
    skills: "",
    education: "",
  };

  if (headings.length === 0) {
    return sections;
  }

  for (let index = 0; index < headings.length; index += 1) {
    const heading = headings[index];
    const nextHeading = headings[index + 1];
    const start = heading.index + heading.text.length;
    const end = nextHeading?.index ?? normalizedText.length;
    const value = normalizedText.slice(start, end).trim();
    sections[heading.section] = [sections[heading.section], value].filter(Boolean).join("\n\n");
  }

  return sections;
}

function findResumeHeadings(text: string): Array<{
  section: "summary" | "experience" | "skills" | "education";
  text: string;
  index: number;
}> {
  const headingMap: Array<{
    section: "summary" | "experience" | "skills" | "education";
    labels: string[];
  }> = [
    {
      section: "summary",
      labels: ["professional summary", "career summary", "summary", "profile"],
    },
    {
      section: "experience",
      labels: ["professional experience", "work experience", "employment history", "experience"],
    },
    {
      section: "skills",
      labels: ["technical skills", "core skills", "skills"],
    },
    {
      section: "education",
      labels: ["education", "academic background"],
    },
  ];

  const matches: Array<{
    section: "summary" | "experience" | "skills" | "education";
    text: string;
    index: number;
  }> = [];

  for (const item of headingMap) {
    for (const label of item.labels) {
      const pattern = new RegExp(`(^|\\n|\\s{2,})(${escapeRegExp(label)})(?=\\s|:|$)`, "gi");
      for (const match of text.matchAll(pattern)) {
        const prefix = match[1] ?? "";
        const headingText = match[2] ?? "";
        matches.push({
          section: item.section,
          text: headingText,
          index: (match.index ?? 0) + prefix.length,
        });
      }

      const uppercaseLabel = label.toUpperCase();
      const uppercasePattern = new RegExp(`(^|\\s)(${escapeRegExp(uppercaseLabel)})(?=\\s|:|$)`, "g");
      for (const match of text.matchAll(uppercasePattern)) {
        const prefix = match[1] ?? "";
        const headingText = match[2] ?? "";
        matches.push({
          section: item.section,
          text: headingText,
          index: (match.index ?? 0) + prefix.length,
        });
      }
    }
  }

  return matches
    .sort((a, b) => a.index - b.index || b.text.length - a.text.length)
    .filter((match, index, sorted) => {
      const previous = sorted[index - 1];
      return !previous || match.index >= previous.index + previous.text.length;
    });
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
