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
  revisionOutputHasUnexpectedBodyHeading,
  serializeResumeDocument,
  stripDuplicateSectionHeading,
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
import { HScrollPane } from "./HScrollPane";

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
  onExportNameConfirmed?: (name: string) => void | Promise<void>;
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

type RevisionSuggestion = {
  label: string;
  instruction: string;
  keywords: string[];
  sectionTypes?: ResumeSectionType[];
  common?: boolean;
};

const EXPORT_OPTIONS: Array<{ type: ExportType; label: string }> = [
  { type: "docx", label: "DOCX" },
  { type: "pdf", label: "PDF" },
  { type: "copy", label: "Text" },
];

const REVISION_SUGGESTIONS: RevisionSuggestion[] = [
  {
    label: "Make concise",
    instruction: "Make this section more concise while preserving the strongest details.",
    keywords: ["make", "short", "shorten", "concise", "tight", "trim", "reduce"],
    common: true,
  },
  {
    label: "More senior",
    instruction: "Make this section sound more senior and impact-oriented without adding new facts.",
    keywords: ["senior", "leadership", "stronger", "executive", "impact", "authority"],
    common: true,
  },
  {
    label: "ATS keywords",
    instruction: "Improve ATS keyword alignment for this job while keeping the content truthful.",
    keywords: ["ats", "keyword", "keywords", "match", "job", "tailor", "optimize"],
    common: true,
  },
  {
    label: "Fix grammar",
    instruction: "Fix grammar, punctuation, and wording without changing the meaning.",
    keywords: ["fix", "grammar", "punctuation", "typo", "wording", "clean"],
    common: true,
  },
  {
    label: "Action verbs",
    instruction: "Rewrite with stronger action verbs and clearer outcomes without inventing metrics.",
    keywords: ["verb", "verbs", "action", "stronger", "outcome", "impact"],
    sectionTypes: ["experience", "projects", "custom"],
  },
  {
    label: "Convert to bullets",
    instruction: "Convert this section into clear resume bullets.",
    keywords: ["bullet", "bullets", "list", "convert", "format"],
    sectionTypes: ["experience", "projects", "education", "custom"],
  },
  {
    label: "Tighten bullets",
    instruction: "Tighten each bullet so it is clearer, more direct, and less repetitive.",
    keywords: ["bullet", "bullets", "tighten", "repetitive", "direct"],
    sectionTypes: ["experience", "projects", "custom"],
  },
  {
    label: "Group skills",
    instruction: "Group these skills into meaningful categories.",
    keywords: ["skill", "skills", "group", "category", "categorize", "organize"],
    sectionTypes: ["skills"],
  },
  {
    label: "Prioritize skills",
    instruction: "Prioritize the most relevant skills for this job and move weaker matches lower.",
    keywords: ["skill", "skills", "prioritize", "relevant", "job", "match"],
    sectionTypes: ["skills"],
  },
  {
    label: "Remove weak skills",
    instruction: "Remove or de-emphasize less relevant skills for this job.",
    keywords: ["skill", "skills", "remove", "weak", "irrelevant", "less relevant"],
    sectionTypes: ["skills"],
  },
  {
    label: "Sharper summary",
    instruction: "Rewrite this summary to be sharper, job-specific, and concise.",
    keywords: ["summary", "profile", "headline", "sharper", "job", "specific"],
    sectionTypes: ["summary"],
  },
  {
    label: "Less generic",
    instruction: "Make this section less generic and more specific to the target role.",
    keywords: ["generic", "specific", "target", "role", "job"],
  },
  {
    label: "One-page fit",
    instruction: "Shorten this section to help the resume fit on the page without losing key value.",
    keywords: ["one", "page", "fit", "shorten", "space", "length"],
  },
  {
    label: "Clarify impact",
    instruction: "Clarify the business or technical impact using only information already present.",
    keywords: ["impact", "clarify", "business", "technical", "result", "outcome"],
    sectionTypes: ["experience", "projects", "summary", "custom"],
  },
  {
    label: "Clean contact",
    instruction: "Clean up the contact section and keep only clear professional contact details.",
    keywords: ["contact", "header", "email", "phone", "linkedin", "github", "clean"],
    sectionTypes: ["contact"],
  },
  {
    label: "Active voice",
    instruction: "Rewrite this section in active voice with direct, confident wording.",
    keywords: ["active", "voice", "direct", "confident", "rewrite"],
  },
  {
    label: "Remove repetition",
    instruction: "Remove repetitive wording while preserving the meaning and important details.",
    keywords: ["remove", "repetition", "repetitive", "duplicate", "clean"],
  },
  {
    label: "Technical depth",
    instruction: "Make the technical depth clearer without adding tools or claims that are not already present.",
    keywords: ["technical", "depth", "engineering", "architecture", "systems"],
    sectionTypes: ["summary", "experience", "projects", "skills", "custom"],
  },
  {
    label: "Customer impact",
    instruction: "Emphasize customer or business impact using only the existing facts.",
    keywords: ["customer", "business", "impact", "user", "users", "stakeholder"],
    sectionTypes: ["summary", "experience", "projects", "custom"],
  },
  {
    label: "Leadership focus",
    instruction: "Emphasize leadership, ownership, and collaboration without overstating the role.",
    keywords: ["leadership", "lead", "ownership", "collaboration", "mentor"],
    sectionTypes: ["summary", "experience", "projects", "custom"],
  },
  {
    label: "Role alignment",
    instruction: "Align this section more closely to the target role while staying truthful.",
    keywords: ["align", "alignment", "role", "target", "job", "tailor"],
    common: true,
  },
  {
    label: "Simplify language",
    instruction: "Simplify the language so it is clear, professional, and easy to scan.",
    keywords: ["simple", "simplify", "clear", "readable", "scan"],
  },
  {
    label: "Add missing context",
    instruction: "Add helpful context only where it can be inferred from the existing section text.",
    keywords: ["context", "missing", "clarify", "explain"],
  },
  {
    label: "Reorder by relevance",
    instruction: "Reorder the content by relevance to the target job without changing the facts.",
    keywords: ["reorder", "order", "relevance", "relevant", "prioritize"],
    sectionTypes: ["skills", "experience", "projects", "custom"],
  },
  {
    label: "Stronger opener",
    instruction: "Rewrite the opening line to be stronger and more specific to the target role.",
    keywords: ["opening", "opener", "first", "line", "start", "stronger"],
    sectionTypes: ["summary", "contact", "custom"],
  },
  {
    label: "Metric-safe impact",
    instruction: "Improve the impact language without inventing numbers, metrics, or outcomes.",
    keywords: ["metric", "metrics", "numbers", "impact", "safe"],
    sectionTypes: ["experience", "projects", "summary", "custom"],
  },
  {
    label: "Tight paragraph",
    instruction: "Rewrite this as one tight paragraph with no bullets.",
    keywords: ["paragraph", "tight", "no bullets", "prose"],
    sectionTypes: ["summary", "custom"],
  },
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
  onExportNameConfirmed,
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
  const [isExportNameDialogOpen, setIsExportNameDialogOpen] = useState(false);
  const [exportNameDraft, setExportNameDraft] = useState("");
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

    const instructionValidationError = getRevisionInstructionValidationError(instruction);
    if (instructionValidationError) {
      setRevisionError(instructionValidationError);
      return;
    }

    // Guard: if the header/contact section is selected, check whether the
    // instruction is actually about a different section in this document.
    if (selectedDocumentSection.type === "contact") {
      const mentionedSection = mentionedSectionFromInstruction(instruction, resumeDocument.sections);
      if (mentionedSection) {
        setRevisionError(
          `Select the "${mentionedSection.title}" section to revise it, then try again.`,
        );
        return;
      }
    }

    setRevisingSectionId(selectedAssistantSection.id);
    setRevisionStatus("");
    setRevisionError("");

    try {
      const revision = await reviseResumeSectionWithProvider({
        provider,
        jobDescription,
        resume: documentToStructuredResume(resumeDocument, resume),
        sectionLabel: selectedAssistantSection.label,
        sectionText: selectedDocumentSection.content,
        instruction,
      });

      if (revision.type === "out_of_scope") {
        setRevisionError(revision.message);
        return;
      }

      let revisedText = revision.text;

      // Guard: reject AI output that includes another section heading. This
      // keeps responses like "Header...\n\nSkills\n..." from merging sections.
      if (revisionOutputHasUnexpectedBodyHeading(revisedText, selectedDocumentSection.title)) {
        setRevisionError(
          "The AI returned content for a different resume section. Select that section and try again.",
        );
        return;
      }

      // Strip a duplicate section heading if the AI echoes it back at the top
      // (e.g. returning "Skills\nProgramming Languages: ..." for the Skills section).
      revisedText = stripDuplicateSectionHeading(selectedDocumentSection.title, revisedText);

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

  async function runSelectedExports(baseName: string) {
    setIsExporting(true);

    try {
      for (const action of selectedExportTypes) {
        await exportOne(action, baseName);
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setIsExporting(false);
    }
  }

  async function handleExportSelected() {
    if (selectedExportTypes.length === 0) {
      setExportError("Select at least one export format.");
      return;
    }

    setExportError("");

    const hasFileExport = selectedExportTypes.some((type) => type === "docx" || type === "pdf");
    if (hasFileExport) {
      setExportNameDraft(downloadBaseName);
      setIsExportNameDialogOpen(true);
      return;
    }

    await runSelectedExports(downloadBaseName);
  }

  async function handleConfirmExportName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestedName = exportNameDraft || downloadBaseName;
    const exportBaseName = safeDownloadBaseName(requestedName);
    const displayName = displayTitleFromDownloadName(requestedName);
    setIsExportNameDialogOpen(false);
    if (displayName) {
      try {
        await onExportNameConfirmed?.(displayName);
      } catch (error) {
        setExportError(error instanceof Error ? error.message : "Could not update the saved name.");
      }
    }
    await runSelectedExports(exportBaseName);
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

  const exportNameDialog = isExportNameDialogOpen
    ? createPortal(
        <ExportNameDialog
          fileName={exportNameDraft}
          selectedExportTypes={selectedExportTypes}
          onFileNameChange={setExportNameDraft}
          onCancel={() => setIsExportNameDialogOpen(false)}
          onSubmit={handleConfirmExportName}
        />,
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
      {exportNameDialog}

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
              selectedSectionType={selectedDocumentSection?.type}
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

function ExportNameDialog({
  fileName,
  selectedExportTypes,
  onFileNameChange,
  onCancel,
  onSubmit,
}: {
  fileName: string;
  selectedExportTypes: ExportType[];
  onFileNameChange: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCancel();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  const fileFormats = selectedExportTypes
    .filter((type) => type === "docx" || type === "pdf")
    .map((type) => type.toUpperCase())
    .join(" and ");
  const includesCopy = selectedExportTypes.includes("copy");

  return (
    <div
      className="confirm-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <form
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Export file name"
        onSubmit={onSubmit}
      >
        <header className="confirm-modal-header">
          <div>
            <p>Export</p>
            <h2>Name your file</h2>
          </div>
          <button
            className="btn btn-ghost btn-sm btn-icon-only"
            type="button"
            aria-label="Cancel export"
            onClick={onCancel}
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <label className="export-name-field">
          <span className="export-name-label">File name</span>
          <input
            autoFocus
            className="field-input"
            value={fileName}
            onChange={(event) => onFileNameChange(event.target.value)}
            placeholder="optimized-resume"
          />
        </label>
        <p className="export-name-hint">
          {includesCopy
            ? `${fileFormats} will be downloaded with this name. Text will be copied to the clipboard.`
            : `${fileFormats} will be downloaded with this name.`}
        </p>
        <div className="confirm-modal-actions">
          <button className="btn btn-secondary btn-sm" type="button" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary btn-sm" type="submit">
            <Download aria-hidden="true" />
            Export
          </button>
        </div>
      </form>
    </div>
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
  const lastBodySectionId = [...sections].reverse().find((s) => s.type !== "contact")?.id;

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
          <HScrollPane className="template-comparison-before">
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
          </HScrollPane>
        )}
        <HScrollPane className="template-comparison-after">
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
                      section.id === lastBodySectionId
                        ? {
                            availableSectionTitles: availableAddSectionTitles,
                            isAddSectionOpen: addSectionAfterId === section.id,
                            onAddSection: (title, content, contentKind) =>
                              onAddSection(section.id, title, content, contentKind),
                            onOpenAddSection: () => onOpenAddSection(section.id),
                            onCloseAddSection,
                          }
                        : undefined,
                    )
              }
            />
          </div>
        </HScrollPane>
      </div>
    </div>
  );
}

function InlineRevisionBar({
  selectedSectionId,
  selectedSectionType,
  instruction,
  inputRef,
  isRevising,
  onInstructionChange,
  onSubmit,
}: {
  selectedSectionId: string;
  selectedSectionType?: ResumeSectionType;
  instruction: string;
  inputRef: RefObject<HTMLTextAreaElement | null>;
  isRevising: boolean;
  onInstructionChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const [isSuggestionListOpen, setIsSuggestionListOpen] = useState(false);
  const compactSuggestions = useMemo(
    () => getRevisionSuggestions(instruction, selectedSectionType, {
      includeAllWhenEmpty: false,
      limit: 4,
    }),
    [instruction, selectedSectionType],
  );
  const allSuggestions = useMemo(
    () => getRevisionSuggestions(instruction, selectedSectionType, {
      includeAllWhenEmpty: true,
      limit: 18,
    }),
    [instruction, selectedSectionType],
  );
  const hiddenSuggestionCount = Math.max(0, allSuggestions.length - compactSuggestions.length);

  useEffect(() => {
    setIsSuggestionListOpen(false);
  }, [selectedSectionType]);

  function handleInstructionKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function handleSuggestionClick(suggestion: RevisionSuggestion) {
    onInstructionChange(suggestion.instruction);
    setIsSuggestionListOpen(false);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  return (
    <div className="review-inline-revision-card">
      {selectedSectionId && !isRevising && compactSuggestions.length > 0 && (
        <div className="review-inline-suggestion-shell">
          <div className="review-inline-suggestions" aria-label="Suggested resume edit actions">
            {compactSuggestions.map((suggestion) => (
              <button
                key={suggestion.instruction}
                className="review-inline-suggestion"
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
              >
                {suggestion.label}
              </button>
            ))}
            {hiddenSuggestionCount > 0 && (
              <button
                className="review-inline-suggestion review-inline-suggestion-more"
                type="button"
                aria-expanded={isSuggestionListOpen}
                onClick={() => setIsSuggestionListOpen((current) => !current)}
              >
                <ListTodo aria-hidden="true" />
                {isSuggestionListOpen ? "Hide" : `More ${hiddenSuggestionCount}`}
              </button>
            )}
          </div>
          {isSuggestionListOpen && (
            <div className="review-inline-suggestion-list" aria-label="All resume edit templates">
              {allSuggestions.map((suggestion) => (
                <button
                  key={suggestion.instruction}
                  className="review-inline-suggestion-option"
                  type="button"
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  <span>{suggestion.label}</span>
                  <small>{suggestion.instruction}</small>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <form className="review-inline-revision-form" onSubmit={onSubmit}>
        <textarea
          ref={inputRef}
          className="review-inline-revision-input"
          value={isRevising ? "Submitting..." : instruction}
          rows={1}
          disabled={isRevising}
          placeholder="Tell AI how to revise the selected section..."
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

function getRevisionSuggestions(
  query: string,
  sectionType: ResumeSectionType | undefined,
  {
    includeAllWhenEmpty,
    limit,
  }: {
    includeAllWhenEmpty: boolean;
    limit: number;
  },
): RevisionSuggestion[] {
  const value = query.trim().toLowerCase();
  const candidates = REVISION_SUGGESTIONS.filter(
    (suggestion) => !suggestion.sectionTypes || (sectionType && suggestion.sectionTypes.includes(sectionType)),
  );

  if (!value) {
    return (includeAllWhenEmpty ? candidates : candidates.filter((suggestion) => suggestion.common)).slice(0, limit);
  }

  const terms = value.split(/\s+/).filter(Boolean);

  return candidates
    .map((suggestion) => {
      const searchable = [
        suggestion.label,
        suggestion.instruction,
        ...suggestion.keywords,
      ].join(" ").toLowerCase();
      const score = terms.reduce((total, term) => {
        if (searchable.includes(term)) return total + 3;
        if (suggestion.keywords.some((keyword) => keyword.startsWith(term) || term.startsWith(keyword))) {
          return total + 2;
        }
        return total;
      }, suggestion.common ? 1 : 0);

      return { suggestion, score };
    })
    .filter(({ score }) => score > 1)
    .sort((a, b) => b.score - a.score || a.suggestion.label.localeCompare(b.suggestion.label))
    .slice(0, limit)
    .map(({ suggestion }) => suggestion);
}

function getRevisionInstructionValidationError(instruction: string): string {
  if (isLikelyInvalidRevisionInstruction(instruction)) {
    return "Ask for a specific resume edit, e.g. “Make this section more concise.”";
  }

  return "";
}

function isLikelyInvalidRevisionInstruction(instruction: string): boolean {
  const value = instruction.trim().toLowerCase();
  if (!value) return false;

  const words = value
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return true;

  const editSignals = [
    "rewrite",
    "revise",
    "improve",
    "shorten",
    "expand",
    "condense",
    "make",
    "more",
    "less",
    "stronger",
    "clearer",
    "concise",
    "specific",
    "generic",
    "turn",
    "convert",
    "format",
    "categorize",
    "category",
    "group",
    "organize",
    "tailor",
    "tone",
    "grammar",
    "professional",
    "senior",
    "add",
    "remove",
    "replace",
    "emphasize",
    "quantify",
    "summarize",
    "fix",
    "polish",
    "trim",
    "tighten",
    "reorder",
    "prioritize",
    "align",
    "active",
    "voice",
    "bullet",
    "bullets",
    "paragraph",
    "ats",
    "keyword",
    "keywords",
  ];
  const resumeSignals = [
    "resume",
    "section",
    "summary",
    "skill",
    "skills",
    "experience",
    "education",
    "project",
    "projects",
    "award",
    "awards",
    "certification",
    "certifications",
    "contact",
    "header",
  ];
  const matchesSuggestion = REVISION_SUGGESTIONS.some((suggestion) => {
    const suggestionText = `${suggestion.label} ${suggestion.instruction}`.toLowerCase();
    return suggestionText.includes(value) || value.includes(suggestion.label.toLowerCase());
  });

  if (matchesSuggestion) return false;

  const hasEditSignal = editSignals.some((signal) => words.includes(signal));
  const hasResumeSignal = resumeSignals.some((signal) => words.includes(signal));

  if (!hasEditSignal && !hasResumeSignal) return true;

  return words.some(isLikelyGarbageWord);
}

function isLikelyGarbageWord(word: string): boolean {
  const letters = word.replace(/[^a-z]/g, "");
  if (letters.length < 8) return false;

  const vowelCount = (letters.match(/[aeiou]/g) ?? []).length;
  const vowelRatio = vowelCount / letters.length;
  const uniqueLetters = new Set(letters).size;

  return vowelRatio < 0.12 || uniqueLetters <= 4;
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

const SECTION_INSTRUCTION_ALIASES: Partial<Record<ResumeSectionType, string[]>> = {
  summary: ["summary", "profile", "objective", "about"],
  skills: [
    "skill",
    "skills",
    "technical skills",
    "technology",
    "technologies",
    "tech stack",
    "tools",
    "programming languages",
    "frameworks",
    "frontend",
    "backend",
    "cloud",
    "devops",
    "databases",
    "api",
  ],
  experience: ["experience", "professional experience", "work experience", "work history", "employment", "roles", "jobs"],
  projects: ["project", "projects", "selected projects", "portfolio"],
  education: ["education", "degree", "academic"],
  certifications: ["certification", "certifications", "certificate", "training"],
  awards: ["award", "awards", "honors"],
  publications: ["publication", "publications"],
  volunteering: ["volunteer", "volunteering", "community"],
  languages: ["language", "languages"],
};

function mentionedSectionFromInstruction(
  instruction: string,
  sections: ResumeSection[],
): ResumeSection | undefined {
  const normalizedInstruction = normalizeSectionTitle(instruction);
  if (!normalizedInstruction) return undefined;

  return sections
    .filter((section) => section.type !== "contact")
    .find((section) => {
      const candidates = [
        section.title,
        section.type,
        ...(SECTION_INSTRUCTION_ALIASES[section.type] ?? []),
      ];
      return candidates.some((candidate) =>
        normalizedInstructionHasPhrase(normalizedInstruction, normalizeSectionTitle(candidate)),
      );
    });
}

function normalizedInstructionHasPhrase(instruction: string, phrase: string): boolean {
  if (!phrase) return false;
  return ` ${instruction} `.includes(` ${phrase} `);
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

function displayTitleFromDownloadName(value: string): string {
  return value
    .trim()
    .replace(/\.[a-z0-9]{2,5}$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\W+|\W+$/g, "")
    .slice(0, 90);
}
