import { type CSSProperties, type FormEvent, type ReactNode, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileDown,
  Loader2,
  PenLine,
  RefreshCw,
  Save,
  WandSparkles,
} from "lucide-react";
import { ResumeTemplatePreview } from "./ResumeTemplatePreview";
import {
  copyPlainText,
  downloadResumeDocumentDocx,
  downloadResumeDocumentPdf,
} from "../lib/exportResume";
import { openAIErrorMessage } from "../lib/openai";
import { reviseResumeSectionWithProvider } from "../lib/providers/dispatch";
import type { LLMProvider } from "../lib/providers/types";
import { structuredResumeToDocument } from "../lib/resumeDocument";
import {
  DEFAULT_TEMPLATE_ID,
  RESUME_TEMPLATES,
  type ResumeTemplateId,
} from "../lib/resumeTemplates";
import {
  diffWords,
  replaceSection,
  resumeToPlainText,
  scoreKeywords,
  sectionText,
  type DiffToken,
  type StructuredResume,
} from "../lib/resume";
import type { ExportType, ResumeRecord } from "../lib/storage";

type ResumeReviewProps = {
  jobDescription: string;
  originalResumeText: string;
  resume: StructuredResume;
  provider: LLMProvider;
  onResumeChange: (resume: StructuredResume) => void;
  sourceResume?: ResumeRecord | null;
  runTitle?: string;
  runId?: string;
  onStartNewSession?: () => void;
  onSaveVersion?: (
    resume: StructuredResume,
    score: number,
    templateId: ResumeTemplateId,
  ) => Promise<void>;
  onExported?: (exportType: ExportType) => void | Promise<void>;
};

type SectionConfig = {
  id: string;
  label: string;
};

type ReviewTab = "results" | "editor" | "export";

export function ResumeReview({
  jobDescription,
  originalResumeText,
  resume,
  provider,
  onResumeChange,
  sourceResume,
  runTitle,
  runId,
  onStartNewSession,
  onSaveVersion,
  onExported,
}: ResumeReviewProps) {
  const [activeTab, setActiveTab] = useState<ReviewTab>("results");
  const [revisionInstructions, setRevisionInstructions] = useState<Record<string, string>>({});
  const [revisingSectionId, setRevisingSectionId] = useState("");
  const [revisionError, setRevisionError] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [exportError, setExportError] = useState("");
  const [versionStatus, setVersionStatus] = useState("");
  const [versionError, setVersionError] = useState("");
  const [isSavingVersion, setIsSavingVersion] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<ResumeTemplateId>(DEFAULT_TEMPLATE_ID);

  const optimizedText = useMemo(() => resumeToPlainText(resume), [resume]);
  const resumeDocument = useMemo(() => structuredResumeToDocument(resume), [resume]);
  const diff = useMemo(
    () => diffWords(originalResumeText, optimizedText),
    [optimizedText, originalResumeText],
  );
  const originalScore = useMemo(
    () => scoreKeywords(jobDescription, originalResumeText),
    [jobDescription, originalResumeText],
  );
  const optimizedScore = useMemo(
    () => scoreKeywords(jobDescription, optimizedText),
    [jobDescription, optimizedText],
  );
  const beforePct = Math.round(originalScore.ratio * 100);
  const afterPct = Math.round(optimizedScore.ratio * 100);
  const scoreDelta = afterPct - beforePct;
  const sectionsChanged = useMemo(
    () => countChangedSections(resume, originalResumeText),
    [originalResumeText, resume],
  );
  const partialKeywords = useMemo(
    () => getPartialKeywords(optimizedScore.missing, optimizedText),
    [optimizedScore.missing, optimizedText],
  );
  const missingKeywords = optimizedScore.missing.filter((keyword) => !partialKeywords.includes(keyword));
  const scoreRingStyle = { "--score": `${afterPct}%` } as CSSProperties;

  const sections: SectionConfig[] = [
    { id: "summary", label: "Summary" },
    ...resume.experience.map((role, index) => ({
      id: `experience:${role.id}`,
      label: role.title || `Experience ${index + 1}`,
    })),
    { id: "skills", label: "Skills" },
    { id: "education", label: "Education" },
  ];

  function handleSectionChange(sectionId: string, value: string) {
    onResumeChange(replaceSection(resume, sectionId, value));
  }

  async function handleReviseSection(event: FormEvent<HTMLFormElement>, section: SectionConfig) {
    event.preventDefault();
    const instruction = revisionInstructions[section.id]?.trim();

    if (!instruction) {
      setRevisionError("Add a revision instruction before submitting.");
      return;
    }

    setRevisingSectionId(section.id);
    setRevisionError("");

    try {
      const revisedText = await reviseResumeSectionWithProvider({
        provider,
        jobDescription,
        resume,
        sectionLabel: section.label,
        sectionText: sectionText(resume, section.id),
        instruction,
      });
      onResumeChange(replaceSection(resume, section.id, revisedText));
      setRevisionInstructions((current) => ({ ...current, [section.id]: "" }));
    } catch (error) {
      setRevisionError(openAIErrorMessage(error));
    } finally {
      setRevisingSectionId("");
    }
  }

  async function handleExport(action: "docx" | "pdf" | "copy") {
    setExportStatus("");
    setExportError("");

    try {
      if (action === "docx") {
        await downloadResumeDocumentDocx(resumeDocument, selectedTemplateId, "syncresume-optimized-resume.docx");
        await onExported?.(action);
        setExportStatus("DOCX downloaded.");
      }
      if (action === "pdf") {
        await downloadResumeDocumentPdf(resumeDocument, selectedTemplateId, "syncresume-optimized-resume.pdf");
        await onExported?.(action);
        setExportStatus("PDF downloaded.");
      }
      if (action === "copy") {
        await copyPlainText(resume);
        await onExported?.(action);
        setExportStatus("Copied to clipboard.");
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed.");
    }
  }

  async function handleSaveVersion() {
    if (!onSaveVersion) return;

    setVersionStatus("");
    setVersionError("");
    setIsSavingVersion(true);
    try {
      await onSaveVersion(resume, afterPct, selectedTemplateId);
      setVersionStatus("Saved as a tailored resume version.");
    } catch (error) {
      setVersionError(error instanceof Error ? error.message : "Could not save tailored version.");
    } finally {
      setIsSavingVersion(false);
    }
  }

  const tabs: { id: ReviewTab; label: string; icon: ReactNode }[] = [
    { id: "results", label: "Results", icon: <ArrowLeftRight /> },
    { id: "editor", label: "Refine", icon: <PenLine /> },
    { id: "export", label: "Export", icon: <Download /> },
  ];

  return (
    <section className="review-workspace" aria-label="Review workspace">
      <div className="tab-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content" role="tabpanel">
        {activeTab === "results" && (
          <div className="results-stage">
            <div className="results-hero">
              <div className="score-ring" style={scoreRingStyle}>
                <span>{afterPct}%</span>
              </div>
              <div className="results-summary">
                <p className="section-label">Tailored result</p>
                <h2>{runTitle || "Optimized resume"}</h2>
                <p>
                  Keyword match improved from <strong>{beforePct}%</strong> to <strong>{afterPct}%</strong>
                  {scoreDelta >= 0 ? ` (+${scoreDelta})` : ` (${scoreDelta})`}.
                </p>
                {sourceResume && <span>Based on {sourceResume.name}</span>}
                {runId && <span>Run saved to history.</span>}
              </div>
              <div className="results-actions">
                <button className="btn btn-primary btn-sm" type="button" onClick={() => setActiveTab("editor")}>
                  <PenLine aria-hidden="true" />
                  Refine in editor
                </button>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  disabled={!onSaveVersion || isSavingVersion}
                  onClick={() => void handleSaveVersion()}
                >
                  {isSavingVersion ? <Loader2 className="spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                  Save version
                </button>
              </div>
            </div>

            <div className="results-insights">
              <InsightMetric label="Matched keywords" value={optimizedScore.matched.length} />
              <InsightMetric label="Partial matches" value={partialKeywords.length} />
              <InsightMetric label="Still missing" value={missingKeywords.length} />
              <InsightMetric label="Sections changed" value={sectionsChanged} />
            </div>

            <div className="keyword-diff-grid">
              <KeywordBucket title="Matched" variant="matched" keywords={optimizedScore.matched} />
              <KeywordBucket title="Partial" variant="partial" keywords={partialKeywords} />
              <KeywordBucket title="Missing" variant="missing" keywords={missingKeywords} />
            </div>

            <div className="results-action-row">
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => void handleExport("docx")}>
                <FileDown aria-hidden="true" />
                DOCX
              </button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => void handleExport("pdf")}>
                <Download aria-hidden="true" />
                PDF
              </button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={onStartNewSession}>
                <RefreshCw aria-hidden="true" />
                Start new
              </button>
            </div>

            {versionStatus && <p className="export-status-msg">{versionStatus}</p>}
            {versionError && <div className="inline-error">{versionError}</div>}
            {exportStatus && <p className="export-status-msg">{exportStatus}</p>}
            {exportError && <div className="inline-error">{exportError}</div>}

            <div className="diff-grid">
              <DiffPane title="Original" tokens={diff} side="original" />
              <DiffPane title="Optimized" tokens={diff} side="optimized" />
            </div>
          </div>
        )}

        {activeTab === "editor" && (
          <>
            <TemplatePicker selectedTemplateId={selectedTemplateId} onSelect={setSelectedTemplateId} />
            <div className="structured-editor-layout refine-editor-layout">
              <div className="editor-grid">
                {sections.map((section) => (
                  <article className="section-editor" key={section.id}>
                    <div className="section-editor-header">
                      <h3>{section.label}</h3>
                      {section.id.startsWith("experience:") && (
                        <span className="section-tag">Role</span>
                      )}
                    </div>
                    <textarea
                      className="field-textarea section-textarea"
                      value={sectionText(resume, section.id)}
                      onChange={(event) => handleSectionChange(section.id, event.target.value)}
                    />
                    <form
                      className="revision-form"
                      onSubmit={(event) => handleReviseSection(event, section)}
                    >
                      <input
                        className="revision-input"
                        type="text"
                        value={revisionInstructions[section.id] ?? ""}
                        placeholder="Ask AI to improve this section..."
                        disabled={revisingSectionId.length > 0}
                        onChange={(event) =>
                          setRevisionInstructions((current) => ({
                            ...current,
                            [section.id]: event.target.value,
                          }))
                        }
                      />
                      <button
                        className="btn btn-ghost btn-sm"
                        type="submit"
                        disabled={
                          revisingSectionId.length > 0 ||
                          !(revisionInstructions[section.id] ?? "").trim()
                        }
                      >
                        {revisingSectionId === section.id ? (
                          <Loader2 className="spin" aria-hidden="true" />
                        ) : (
                          <WandSparkles aria-hidden="true" />
                        )}
                        Improve with AI
                      </button>
                    </form>
                  </article>
                ))}
              </div>

              <aside className="template-preview-panel" aria-label="Optimized template preview">
                <div className="template-preview-header">
                  <span>Live preview</span>
                  <small>{RESUME_TEMPLATES.find((template) => template.id === selectedTemplateId)?.name}</small>
                </div>
                <ResumeTemplatePreview document={resumeDocument} templateId={selectedTemplateId} />
              </aside>
            </div>
            <div className="results-action-row">
              <button
                className="btn btn-secondary btn-sm"
                type="button"
                disabled={!onSaveVersion || isSavingVersion}
                onClick={() => void handleSaveVersion()}
              >
                {isSavingVersion ? <Loader2 className="spin" aria-hidden="true" /> : <Save aria-hidden="true" />}
                Save version
              </button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => void handleExport("docx")}>
                <FileDown aria-hidden="true" />
                DOCX
              </button>
              <button className="btn btn-secondary btn-sm" type="button" onClick={() => void handleExport("pdf")}>
                <Download aria-hidden="true" />
                PDF
              </button>
            </div>
            {versionStatus && <p className="export-status-msg">{versionStatus}</p>}
            {versionError && <div className="inline-error">{versionError}</div>}
            {exportStatus && <p className="export-status-msg">{exportStatus}</p>}
            {exportError && <div className="inline-error">{exportError}</div>}
            {revisionError && <div className="inline-error" style={{ marginTop: 12 }}>{revisionError}</div>}
          </>
        )}

        {activeTab === "export" && (
          <div className="export-content">
            <p className="export-description">
              Choose a template for export. Content stays the same; only layout and spacing change.
            </p>
            <TemplatePicker selectedTemplateId={selectedTemplateId} onSelect={setSelectedTemplateId} />
            <div className="export-template-preview">
              <ResumeTemplatePreview document={resumeDocument} templateId={selectedTemplateId} />
            </div>
            <div className="export-buttons">
              <button className="btn btn-secondary" type="button" onClick={() => void handleExport("docx")}>
                <FileDown aria-hidden="true" />
                Download DOCX
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => void handleExport("pdf")}>
                <Download aria-hidden="true" />
                Download PDF
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => void handleExport("copy")}>
                <ClipboardCopy aria-hidden="true" />
                Copy plain text
              </button>
            </div>
            {exportStatus && <p className="export-status-msg">{exportStatus}</p>}
            {exportError && <div className="inline-error">{exportError}</div>}
          </div>
        )}
      </div>
    </section>
  );
}

function TemplatePicker({
  selectedTemplateId,
  onSelect,
}: {
  selectedTemplateId: ResumeTemplateId;
  onSelect: (templateId: ResumeTemplateId) => void;
}) {
  return (
    <div className="template-picker compact" aria-label="Resume template">
      {RESUME_TEMPLATES.map((template) => (
        <button
          key={template.id}
          type="button"
          className={`template-option ${selectedTemplateId === template.id ? "selected" : ""}`}
          onClick={() => onSelect(template.id)}
        >
          <span>
            {template.name}
            {template.isAtsSafe && <small>ATS-safe</small>}
          </span>
          <em>{template.description}</em>
        </button>
      ))}
    </div>
  );
}

function InsightMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="insight-metric">
      <span>{value}</span>
      <p>{label}</p>
    </div>
  );
}

function KeywordBucket({
  title,
  variant,
  keywords,
}: {
  title: string;
  variant: "matched" | "partial" | "missing";
  keywords: string[];
}) {
  return (
    <div className="keyword-bucket">
      <p className="section-label">{title}</p>
      <div className="keyword-chips">
        {keywords.length > 0 ? (
          keywords.map((keyword) => (
            <span key={keyword} className={`chip chip-${variant}`}>
              {keyword}
            </span>
          ))
        ) : (
          <span className="keyword-empty">None</span>
        )}
      </div>
    </div>
  );
}

function countChangedSections(resume: StructuredResume, originalText: string): number {
  const haystack = normalizeComparable(originalText);
  const sectionValues = [
    resume.summary,
    resume.skills.join(", "),
    resume.education.join("\n"),
    ...resume.experience.map((role) => sectionText(resume, `experience:${role.id}`)),
  ].filter((value) => value.trim().length > 0);

  return sectionValues.filter((value) => !haystack.includes(normalizeComparable(value).slice(0, 80))).length;
}

function getPartialKeywords(keywords: string[], optimizedText: string): string[] {
  const haystack = normalizeComparable(optimizedText);
  return keywords.filter((keyword) => {
    const parts = keyword.split(/\s+/).filter((part) => part.length > 3);
    return parts.length > 1 && parts.some((part) => haystack.includes(normalizeComparable(part)));
  });
}

function normalizeComparable(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function DiffPane({
  title,
  tokens,
  side,
}: {
  title: string;
  tokens: DiffToken[];
  side: "original" | "optimized";
}) {
  return (
    <article className="diff-pane">
      <div className="diff-pane-header">
        <h3>{title}</h3>
        {side === "optimized" ? (
          <CheckCircle2 aria-hidden="true" />
        ) : (
          <RefreshCw aria-hidden="true" />
        )}
      </div>
      <pre>
        {tokens
          .filter((token) =>
            side === "original" ? token.type !== "added" : token.type !== "removed",
          )
          .map((token, index) => (
            <mark className={`diff-${token.type}`} key={`${token.type}-${index}`}>
              {token.value}
            </mark>
          ))}
      </pre>
    </article>
  );
}
