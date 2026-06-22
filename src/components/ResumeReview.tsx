import { type CSSProperties, type FormEvent, type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ClipboardCopy,
  Download,
  FileDown,
  KeyRound,
  Loader2,
  PenLine,
  RefreshCw,
  Save,
  WandSparkles,
} from "lucide-react";
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
  initialTemplateId?: ResumeTemplateId;
  onStartNewSession?: () => void;
  onShowJob?: () => void;
  onSaveVersion?: (
    resume: StructuredResume,
    score: number,
    templateId: ResumeTemplateId,
  ) => Promise<void>;
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

type ReviewTab = "results" | "keywords" | "editor" | "export";
type ReviewTabConfig = { id: ReviewTab; label: string; icon: ReactNode; badge?: number };

export function ResumeReview({
  jobDescription,
  originalResumeText,
  resume,
  provider,
  onResumeChange,
  runTitle,
  initialTemplateId,
  onStartNewSession,
  onShowJob,
  onSaveVersion,
  onSaveReview,
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
  const [saveReviewStatus, setSaveReviewStatus] = useState("");
  const [saveReviewError, setSaveReviewError] = useState("");
  const [isSavingReview, setIsSavingReview] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<ResumeTemplateId>(DEFAULT_TEMPLATE_ID);

  useEffect(() => {
    if (initialTemplateId) {
      setSelectedTemplateId(initialTemplateId);
    }
  }, [initialTemplateId]);

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
  const partialKeywords = useMemo(
    () => getPartialKeywords(optimizedScore.missing, optimizedText),
    [optimizedScore.missing, optimizedText],
  );
  const missingKeywords = optimizedScore.missing.filter((keyword) => !partialKeywords.includes(keyword));
  const relevantKeywordCount =
    optimizedScore.matched.length + partialKeywords.length + missingKeywords.length;
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
      setSaveReviewStatus("");
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

  const tabs: ReviewTabConfig[] = [
    { id: "results", label: "Results", icon: <ArrowLeftRight /> },
    { id: "keywords", label: "Keywords", icon: <KeyRound />, badge: relevantKeywordCount },
    { id: "editor", label: "Refine", icon: <PenLine /> },
    { id: "export", label: "Export", icon: <Download /> },
  ];

  return (
    <section className="review-workspace" aria-label="Review workspace">
      <ReviewTopbar
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        canSaveReview={Boolean(onSaveReview)}
        isSavingReview={isSavingReview}
        onSaveReview={handleSaveReview}
        scoreRingStyle={scoreRingStyle}
        beforePct={beforePct}
        afterPct={afterPct}
        scoreDelta={scoreDelta}
        matchedCount={optimizedScore.matched.length}
        partialCount={partialKeywords.length}
      />

      <div className="tab-content" role="tabpanel">
        {activeTab === "results" && (
          <ResultsTab
            diff={diff}
            versionStatus={versionStatus}
            versionError={versionError}
            exportStatus={exportStatus}
            exportError={exportError}
          />
        )}

        {activeTab === "keywords" && (
          <KeywordsTab
            relevantKeywordCount={relevantKeywordCount}
            matchedKeywords={optimizedScore.matched}
            partialKeywords={partialKeywords}
            missingKeywords={missingKeywords}
          />
        )}

        {activeTab === "editor" && (
          <RefineTab
            sections={sections}
            revisionInstructions={revisionInstructions}
            revisingSectionId={revisingSectionId}
            onInstructionChange={(sectionId, value) =>
              setRevisionInstructions((current) => ({
                ...current,
                [sectionId]: value,
              }))
            }
            onReviseSection={handleReviseSection}
            versionStatus={versionStatus}
            versionError={versionError}
            exportStatus={exportStatus}
            exportError={exportError}
            revisionError={revisionError}
          />
        )}

        {activeTab === "export" && (
          <ExportTab
            canSaveVersion={Boolean(onSaveVersion)}
            isSavingVersion={isSavingVersion}
            onExport={handleExport}
            onSaveVersion={handleSaveVersion}
            versionStatus={versionStatus}
            versionError={versionError}
            exportStatus={exportStatus}
            exportError={exportError}
          />
        )}
        {saveReviewStatus && <p className="export-status-msg">{saveReviewStatus}</p>}
        {saveReviewError && <div className="inline-error">{saveReviewError}</div>}
      </div>

      <ReviewFooter
        runTitle={runTitle}
        jobDescription={jobDescription}
        onShowJob={onShowJob}
        onStartNewSession={onStartNewSession}
      />
    </section>
  );
}

function ReviewTopbar({
  tabs,
  activeTab,
  onTabChange,
  canSaveReview,
  isSavingReview,
  onSaveReview,
  scoreRingStyle,
  beforePct,
  afterPct,
  scoreDelta,
  matchedCount,
  partialCount,
}: {
  tabs: ReviewTabConfig[];
  activeTab: ReviewTab;
  onTabChange: (tab: ReviewTab) => void;
  canSaveReview: boolean;
  isSavingReview: boolean;
  onSaveReview: () => Promise<void>;
  scoreRingStyle: CSSProperties;
  beforePct: number;
  afterPct: number;
  scoreDelta: number;
  matchedCount: number;
  partialCount: number;
}) {
  return (
    <div className="review-topbar">
      <div className="tab-bar" role="tablist">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.icon}
            {tab.label}
            {typeof tab.badge === "number" && <span className="tab-badge">{tab.badge}</span>}
          </button>
        ))}
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

      <div className="review-score-strip" aria-label="Optimization score summary">
        <div className="score-ring score-ring-compact" style={scoreRingStyle} aria-hidden="true" />
        <span className="score-before">{beforePct}%</span>
        <strong className="score-after">{afterPct}%</strong>
        <span className="score-delta">{scoreDelta >= 0 ? `+${scoreDelta}` : scoreDelta}</span>
        <span className="score-stat score-stat-matched">
          <span aria-hidden="true" />
          <strong>{matchedCount}</strong> matched
        </span>
        <span className="score-stat score-stat-partial">
          <span aria-hidden="true" />
          <strong>{partialCount}</strong> partial
        </span>
      </div>
    </div>
  );
}

function ResultsTab({
  diff,
  versionStatus,
  versionError,
  exportStatus,
  exportError,
}: {
  diff: DiffToken[];
  versionStatus: string;
  versionError: string;
  exportStatus: string;
  exportError: string;
}) {
  return (
    <div className="results-stage">
      <div className="diff-grid">
        <DiffPane title="Original" tokens={diff} side="original" />
        <DiffPane title="Optimized" tokens={diff} side="optimized" />
      </div>
      <StatusMessages
        versionStatus={versionStatus}
        versionError={versionError}
        exportStatus={exportStatus}
        exportError={exportError}
      />
    </div>
  );
}

function KeywordsTab({
  relevantKeywordCount,
  matchedKeywords,
  partialKeywords,
  missingKeywords,
}: {
  relevantKeywordCount: number;
  matchedKeywords: string[];
  partialKeywords: string[];
  missingKeywords: string[];
}) {
  return (
    <div className="keywords-stage">
      <aside className="keywords-summary">
        <strong>{relevantKeywordCount}</strong>
        <span>relevant terms extracted from job description</span>
      </aside>
      <div className="keywords-groups">
        <KeywordBucket title={`Matched (${matchedKeywords.length})`} variant="matched" keywords={matchedKeywords} />
        <KeywordBucket title={`Partial (${partialKeywords.length})`} variant="partial" keywords={partialKeywords} />
        <KeywordBucket title={`Missing (${missingKeywords.length})`} variant="missing" keywords={missingKeywords} />
      </div>
    </div>
  );
}

function RefineTab({
  sections,
  revisionInstructions,
  revisingSectionId,
  onInstructionChange,
  onReviseSection,
  versionStatus,
  versionError,
  exportStatus,
  exportError,
  revisionError,
}: {
  sections: SectionConfig[];
  revisionInstructions: Record<string, string>;
  revisingSectionId: string;
  onInstructionChange: (sectionId: string, value: string) => void;
  onReviseSection: (event: FormEvent<HTMLFormElement>, section: SectionConfig) => void | Promise<void>;
  versionStatus: string;
  versionError: string;
  exportStatus: string;
  exportError: string;
  revisionError: string;
}) {
  return (
    <div className="refine-stage">
      {sections.map((section) => (
        <article className="refine-card" key={section.id}>
          <h3>{section.label}</h3>
          <form
            className="refine-form"
            onSubmit={(event) => onReviseSection(event, section)}
          >
            <input
              className="revision-input"
              type="text"
              value={revisionInstructions[section.id] ?? ""}
              placeholder={section.id === "summary" ? "Ask AI to revise this section..." : "e.g. add more impact metrics"}
              disabled={revisingSectionId.length > 0}
              onChange={(event) => onInstructionChange(section.id, event.target.value)}
            />
            <button
              className="btn btn-secondary"
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
              Revise
            </button>
          </form>
        </article>
      ))}
      <StatusMessages
        versionStatus={versionStatus}
        versionError={versionError}
        exportStatus={exportStatus}
        exportError={exportError}
      />
      {revisionError && <div className="inline-error" style={{ marginTop: 12 }}>{revisionError}</div>}
    </div>
  );
}

function ExportTab({
  canSaveVersion,
  isSavingVersion,
  onExport,
  onSaveVersion,
  versionStatus,
  versionError,
  exportStatus,
  exportError,
}: {
  canSaveVersion: boolean;
  isSavingVersion: boolean;
  onExport: (action: "docx" | "pdf" | "copy") => Promise<void>;
  onSaveVersion: () => Promise<void>;
  versionStatus: string;
  versionError: string;
  exportStatus: string;
  exportError: string;
}) {
  return (
    <div className="export-stage">
      <ExportCard
        icon={<FileDown />}
        title="DOCX"
        actionLabel="Download"
        onAction={() => void onExport("docx")}
      />
      <ExportCard
        icon={<Download />}
        title="PDF"
        actionLabel="Download"
        tone="danger"
        onAction={() => void onExport("pdf")}
      />
      <ExportCard
        icon={<ClipboardCopy />}
        title="Plain text"
        actionLabel="Copy"
        onAction={() => void onExport("copy")}
      />
      {canSaveVersion && (
        <ExportCard
          icon={isSavingVersion ? <Loader2 className="spin" /> : <Save />}
          title="Version"
          actionLabel={isSavingVersion ? "Saving..." : "Save version"}
          disabled={isSavingVersion}
          onAction={() => void onSaveVersion()}
        />
      )}
      <StatusMessages
        versionStatus={versionStatus}
        versionError={versionError}
        exportStatus={exportStatus}
        exportError={exportError}
      />
    </div>
  );
}

function ReviewFooter({
  runTitle,
  jobDescription,
  onShowJob,
  onStartNewSession,
}: {
  runTitle?: string;
  jobDescription: string;
  onShowJob?: () => void;
  onStartNewSession?: () => void;
}) {
  return (
    <div className="review-footer-bar">
      <div className="review-footer-job">
        <p className="section-label">Target job</p>
        <span>
          {runTitle || "Target job"} · {jobDescription.trim().length.toLocaleString()} characters
        </span>
      </div>
      <div className="review-footer-actions">
        <button className="btn btn-secondary" type="button" disabled={!onShowJob} onClick={onShowJob}>
          <ArrowLeftRight aria-hidden="true" />
          Show job
        </button>
        <button className="btn btn-secondary" type="button" onClick={onStartNewSession}>
          <RefreshCw aria-hidden="true" />
          Start new
        </button>
      </div>
    </div>
  );
}

function StatusMessages({
  versionStatus,
  versionError,
  exportStatus,
  exportError,
}: {
  versionStatus: string;
  versionError: string;
  exportStatus: string;
  exportError: string;
}) {
  return (
    <>
      {versionStatus && <p className="export-status-msg">{versionStatus}</p>}
      {versionError && <div className="inline-error">{versionError}</div>}
      {exportStatus && <p className="export-status-msg">{exportStatus}</p>}
      {exportError && <div className="inline-error">{exportError}</div>}
    </>
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

function ExportCard({
  icon,
  title,
  actionLabel,
  disabled = false,
  tone = "accent",
  onAction,
}: {
  icon: ReactNode;
  title: string;
  actionLabel: string;
  disabled?: boolean;
  tone?: "accent" | "danger";
  onAction: () => void;
}) {
  return (
    <article className={`export-card export-card-${tone}`}>
      <span className="export-card-icon" aria-hidden="true">
        {icon}
      </span>
      <h3>{title}</h3>
      <button className="btn btn-secondary" type="button" disabled={disabled} onClick={onAction}>
        {actionLabel}
      </button>
    </article>
  );
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
    <article className={`diff-pane diff-pane-${side}`}>
      <div className="diff-pane-header">
        <h3>{title}</h3>
        <span className="diff-pane-badge">{side === "optimized" ? "after" : "before"}</span>
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
