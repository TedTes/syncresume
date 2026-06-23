import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  ListTodo,
  Loader2,
  MessageCircle,
  Save,
  Send,
  WandSparkles,
  X,
} from "lucide-react";
import {
  copyPlainText,
  downloadResumeDocumentDocx,
  downloadResumeDocumentPdf,
} from "../lib/exportResume";
import { useSettings } from "../context/SettingsContext";
import { openAIErrorMessage } from "../lib/openai";
import { reviseResumeSectionWithProvider } from "../lib/providers/dispatch";
import type { LLMProvider } from "../lib/providers/types";
import { structuredResumeToDocument } from "../lib/resumeDocument";
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
};

type SectionConfig = {
  id: string;
  label: string;
};

type SectionComparison = {
  id: string;
  label: string;
  before: string;
  after: string;
  tokens: DiffToken[];
  added: string[];
  removed: string[];
};

const EXPORT_OPTIONS: Array<{ type: ExportType; label: string }> = [
  { type: "docx", label: "DOCX" },
  { type: "pdf", label: "PDF" },
  { type: "copy", label: "Text" },
];

export function ResumeReview({
  jobDescription,
  originalResumeText,
  resume,
  provider,
  onResumeChange,
  initialTemplateId,
  onSaveReview,
  onExported,
}: ResumeReviewProps) {
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
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

  const resumeDocument = useMemo(() => structuredResumeToDocument(resume), [resume]);
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

  return (
    <section className="review-workspace" aria-label="Review workspace">
      <ReviewTopbar
        selectedExportTypes={selectedExportTypes}
        isExporting={isExporting}
        onToggleExportType={toggleExportType}
        onExportSelected={handleExportSelected}
        canSaveReview={Boolean(onSaveReview)}
        isSavingReview={isSavingReview}
        onSaveReview={handleSaveReview}
      />

      <div className="tab-content">
        <ResultsTab sections={sectionComparisons} />

        <StatusMessages
          exportError={exportError}
        />
        {saveReviewStatus && <p className="export-status-msg">{saveReviewStatus}</p>}
        {saveReviewError && <div className="inline-error">{saveReviewError}</div>}
      </div>

      <RevisionAssistant
        isOpen={isAssistantOpen}
        sections={sections}
        selectedSectionId={selectedAssistantSection?.id ?? ""}
        instruction={assistantInstruction}
        revisingSectionId={revisingSectionId}
        revisionStatus={revisionStatus}
        revisionError={revisionError}
        onOpen={() => setIsAssistantOpen(true)}
        onClose={() => setIsAssistantOpen(false)}
        onSectionChange={(sectionId) => {
          setAssistantSectionId(sectionId);
          setRevisionStatus("");
          setRevisionError("");
        }}
        onInstructionChange={(value) => {
          setAssistantInstruction(value);
          setRevisionStatus("");
          setRevisionError("");
        }}
        onSubmit={handleAssistantRevise}
      />
    </section>
  );
}

function ReviewTopbar({
  selectedExportTypes,
  isExporting,
  onToggleExportType,
  onExportSelected,
  canSaveReview,
  isSavingReview,
  onSaveReview,
}: {
  selectedExportTypes: ExportType[];
  isExporting: boolean;
  onToggleExportType: (type: ExportType) => void;
  onExportSelected: () => Promise<void>;
  canSaveReview: boolean;
  isSavingReview: boolean;
  onSaveReview: () => Promise<void>;
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
      <div className="review-topbar-actions">
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
}: {
  sections: SectionComparison[];
}) {
  return (
    <div className="results-stage">
      <div className="diff-column-labels" aria-hidden="true">
        <span>Before</span>
        <span>After</span>
      </div>
      <div className="section-diff-list">
        {sections.map((section) => (
          <section className={`section-diff-block section-diff-${section.id}`} key={section.id}>
            <div className="section-diff-header">
              <h3>{section.label}</h3>
            </div>
            <div className="diff-grid">
              <DiffPane text={section.before} changes={section.removed} side="original" />
              <DiffPane text={section.after} changes={section.added} side="optimized" />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function RevisionAssistant({
  isOpen,
  sections,
  selectedSectionId,
  instruction,
  revisingSectionId,
  revisionStatus,
  revisionError,
  onOpen,
  onClose,
  onSectionChange,
  onInstructionChange,
  onSubmit,
}: {
  isOpen: boolean;
  sections: SectionConfig[];
  selectedSectionId: string;
  instruction: string;
  revisingSectionId: string;
  revisionStatus: string;
  revisionError: string;
  onOpen: () => void;
  onClose: () => void;
  onSectionChange: (sectionId: string) => void;
  onInstructionChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const assistantRef = useRef<HTMLDivElement | null>(null);
  const selectedSection = sections.find((section) => section.id === selectedSectionId);
  const isRevising = Boolean(revisingSectionId);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (assistantRef.current?.contains(target)) return;
      onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen, onClose]);

  return (
    <div className="review-assistant" ref={assistantRef}>
      {isOpen && (
        <aside className="review-assistant-panel" aria-label="AI section assistant">
          <div className="review-assistant-header">
            <div>
              <p className="section-label">AI assistant</p>
              <h3>Revise a section</h3>
            </div>
            <button type="button" className="icon-button" aria-label="Close assistant" onClick={onClose}>
              <X aria-hidden="true" />
            </button>
          </div>

          <div className="assistant-section-options" aria-label="Choose section">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`assistant-section-chip ${section.id === selectedSectionId ? "active" : ""}`}
                disabled={isRevising}
                onClick={() => onSectionChange(section.id)}
              >
                {section.label}
              </button>
            ))}
          </div>

          <form className="assistant-chat-form" onSubmit={onSubmit}>
            <textarea
              className="assistant-chat-input"
              value={instruction}
              rows={4}
              disabled={isRevising}
              placeholder={
                selectedSection?.id === "summary"
                  ? "Ask AI to sharpen this summary for the target job..."
                  : "e.g. add impact metrics, make it more concise, or mirror the job language"
              }
              onChange={(event) => onInstructionChange(event.target.value)}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={isRevising || !instruction.trim() || !selectedSection}
            >
              {isRevising ? (
                <Loader2 className="spin" aria-hidden="true" />
              ) : (
                <Send aria-hidden="true" />
              )}
              {isRevising ? "Revising..." : "Ask AI"}
            </button>
          </form>

          {revisionStatus && <p className="export-status-msg">{revisionStatus}</p>}
          {revisionError && <div className="inline-error">{revisionError}</div>}
        </aside>
      )}

      <button
        type="button"
        className="review-assistant-fab"
        aria-label="Open AI section assistant"
        aria-expanded={isOpen}
        onClick={isOpen ? onClose : onOpen}
      >
        {isOpen ? <X aria-hidden="true" /> : <MessageCircle aria-hidden="true" />}
        <WandSparkles aria-hidden="true" />
      </button>
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

function normalizeComparable(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function buildSectionComparisons(originalResumeText: string, resume: StructuredResume): SectionComparison[] {
  const originalSections = extractOriginalResumeSections(originalResumeText);
  const optimizedSections = [
    {
      id: "summary",
      label: "Summary",
      before: originalSections.summary,
      after: resume.summary,
    },
    {
      id: "experience",
      label: "Experience",
      before: originalSections.experience,
      after: resume.experience.map(experienceRoleToText).filter(Boolean).join("\n\n"),
    },
    {
      id: "skills",
      label: "Skills",
      before: originalSections.skills,
      after: resume.skills.join(", "),
    },
    {
      id: "education",
      label: "Education",
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
    }))
    .map((section) => ({
      ...section,
      added: extractChangePhrases(section.tokens, "added"),
      removed: extractChangePhrases(section.tokens, "removed"),
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
      before: originalResumeText.trim(),
      after: fallbackAfter,
      tokens: fallbackTokens,
      added: extractChangePhrases(fallbackTokens, "added"),
      removed: extractChangePhrases(fallbackTokens, "removed"),
    },
  ];
}

function extractOriginalResumeSections(text: string): Record<"summary" | "experience" | "skills" | "education", string> {
  const normalizedText = text.replace(/\r\n?/g, "\n");
  const headings = findResumeHeadings(normalizedText);
  const sections = {
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

function DiffPane({
  text,
  changes,
  side,
}: {
  text: string;
  changes: string[];
  side: "original" | "optimized";
}) {
  const label = side === "original" ? "Removed" : "Added";
  const variant = side === "original" ? "removed" : "added";

  return (
    <article
      className={`diff-pane diff-pane-${side}`}
      aria-label={side === "optimized" ? "Optimized resume" : "Original resume"}
    >
      <pre>
        {text ? (
          text
        ) : (
          <span className="diff-empty">
            {side === "original" ? "No matching original text found." : "No optimized text."}
          </span>
        )}
      </pre>
      <div className="diff-pane-tools">
        <ChangeChip label={label} items={changes} variant={variant} />
      </div>
    </article>
  );
}

function ChangeChip({
  label,
  items,
  variant,
}: {
  label: string;
  items: string[];
  variant: "added" | "removed";
}) {
  const [isOpen, setIsOpen] = useState(false);
  const count = items.length;

  useEffect(() => {
    if (!isOpen) return;

    function collapseOnScroll() {
      setIsOpen(false);
    }

    window.addEventListener("scroll", collapseOnScroll, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", collapseOnScroll, { capture: true });
  }, [isOpen]);

  return (
    <div className={`change-chip change-chip-${variant} ${isOpen ? "open" : ""}`}>
      <button
        type="button"
        aria-expanded={isOpen}
        disabled={count === 0}
        onClick={() => setIsOpen((current) => !current)}
      >
        {label} <span>{count}</span>
      </button>
      {isOpen && (
        <div className="change-chip-popover">
          <p>{items.join(", ")}</p>
        </div>
      )}
    </div>
  );
}

function extractChangePhrases(tokens: DiffToken[], type: "added" | "removed"): string[] {
  const items: string[] = [];
  const seen = new Set<string>();

  for (const token of tokens) {
    if (token.type !== type) continue;

    for (const phrase of splitChangePhrase(token.value)) {
      const normalized = normalizeComparable(phrase);
      if (!normalized || seen.has(normalized) || !isMeaningfulChange(phrase)) continue;

      seen.add(normalized);
      items.push(phrase);

      if (items.length >= 8) {
        return items;
      }
    }
  }

  return items;
}

function splitChangePhrase(value: string): string[] {
  return value
    .split(/\n+|[•]+|(?:^|\s)[-*]\s+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .map((item) => item.replace(/^[,;:.\s]+|[,;:.\s]+$/g, ""))
    .filter(Boolean)
    .map((item) => (item.length > 140 ? `${item.slice(0, 137).trim()}...` : item));
}

function isMeaningfulChange(value: string): boolean {
  const words = value.match(/[A-Za-z0-9+#.]+/g) ?? [];
  return value.length >= 4 && words.some((word) => word.length > 3);
}
