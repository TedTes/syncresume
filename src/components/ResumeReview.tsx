import { FormEvent, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileDown,
  Hash,
  Loader2,
  PenLine,
  RefreshCw,
  WandSparkles,
} from "lucide-react";
import { copyPlainText, downloadDocx, downloadPdf } from "../lib/exportResume";
import { openAIErrorMessage } from "../lib/openai";
import { reviseResumeSectionWithProvider } from "../lib/providers/dispatch";
import type { LLMProvider } from "../lib/providers/types";
import {
  diffWords,
  replaceSection,
  resumeToPlainText,
  scoreKeywords,
  sectionText,
  type DiffToken,
  type KeywordScore,
  type StructuredResume,
} from "../lib/resume";
import type { ExportType } from "../lib/storage";

type ResumeReviewProps = {
  jobDescription: string;
  originalResumeText: string;
  resume: StructuredResume;
  provider: LLMProvider;
  onResumeChange: (resume: StructuredResume) => void;
  onExported?: (exportType: ExportType) => void | Promise<void>;
};

type SectionConfig = {
  id: string;
  label: string;
};

type ReviewTab = "diff" | "editor" | "keywords" | "export";

export function ResumeReview({
  jobDescription,
  originalResumeText,
  resume,
  provider,
  onResumeChange,
  onExported,
}: ResumeReviewProps) {
  const [activeTab, setActiveTab] = useState<ReviewTab>("diff");
  const [revisionInstructions, setRevisionInstructions] = useState<Record<string, string>>({});
  const [revisingSectionId, setRevisingSectionId] = useState("");
  const [revisionError, setRevisionError] = useState("");
  const [exportStatus, setExportStatus] = useState("");
  const [exportError, setExportError] = useState("");

  const optimizedText = useMemo(() => resumeToPlainText(resume), [resume]);
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
        await downloadDocx(resume);
        await onExported?.(action);
        setExportStatus("DOCX downloaded.");
      }
      if (action === "pdf") {
        await downloadPdf(resume);
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

  const tabs: { id: ReviewTab; label: string; icon: React.ReactNode }[] = [
    { id: "diff", label: "Diff", icon: <ArrowLeftRight /> },
    { id: "editor", label: "Editor", icon: <PenLine /> },
    { id: "keywords", label: "Keywords", icon: <Hash /> },
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
        {activeTab === "diff" && (
          <div className="diff-grid">
            <DiffPane title="Original" tokens={diff} side="original" />
            <DiffPane title="Optimized" tokens={diff} side="optimized" />
          </div>
        )}

        {activeTab === "editor" && (
          <>
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
                      placeholder="Ask AI to revise this section…"
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
                      Revise
                    </button>
                  </form>
                </article>
              ))}
            </div>
            {revisionError && <div className="inline-error" style={{ marginTop: 12 }}>{revisionError}</div>}
          </>
        )}

        {activeTab === "keywords" && (
          <div className="keywords-content">
            <KeywordScorePanel label="Before" score={originalScore} />
            <KeywordScorePanel label="After" score={optimizedScore} />
            {optimizedScore.missing.length > 0 && (
              <div className="missing-keywords-section">
                <p className="section-label">Missing keywords</p>
                <div className="keyword-chips missing-chips">
                  {optimizedScore.missing.map((kw) => (
                    <span key={kw} className="chip chip-missing">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {optimizedScore.matched.length > 0 && (
              <div className="matched-keywords-section">
                <p className="section-label">Matched keywords</p>
                <div className="keyword-chips">
                  {optimizedScore.matched.map((kw) => (
                    <span key={kw} className="chip chip-matched">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "export" && (
          <div className="export-content">
            <p className="export-description">
              Download your optimized resume or copy the plain text to paste elsewhere.
            </p>
            <div className="export-buttons">
              <button className="btn btn-secondary" type="button" onClick={() => handleExport("docx")}>
                <FileDown aria-hidden="true" />
                Download DOCX
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => handleExport("pdf")}>
                <Download aria-hidden="true" />
                Download PDF
              </button>
              <button className="btn btn-secondary" type="button" onClick={() => handleExport("copy")}>
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

function KeywordScorePanel({ label, score }: { label: string; score: KeywordScore }) {
  const pct = Math.round(score.ratio * 100);
  return (
    <div className="score-panel">
      <p className="score-heading">{label}</p>
      <p className="score-value">
        {score.matched.length}
        <span className="score-total">/{score.total}</span>
      </p>
      <div className="score-meter" aria-label={`${pct}% match`}>
        <div className="score-meter-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="score-pct">{pct}% keyword match</p>
    </div>
  );
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
