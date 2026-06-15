import { FormEvent, useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardCopy,
  Download,
  FileDown,
  Loader2,
  RefreshCw,
  WandSparkles,
} from "lucide-react";
import { reviseResumeSection } from "../lib/aiResume";
import { copyPlainText, downloadDocx, downloadPdf } from "../lib/exportResume";
import { openAIErrorMessage } from "../lib/openai";
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

type ResumeReviewProps = {
  apiKey: string;
  jobDescription: string;
  originalResumeText: string;
  resume: StructuredResume;
  onResumeChange: (resume: StructuredResume) => void;
};

type SectionConfig = {
  id: string;
  label: string;
};

export function ResumeReview({
  apiKey,
  jobDescription,
  originalResumeText,
  resume,
  onResumeChange,
}: ResumeReviewProps) {
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
      setRevisionError("Add a section instruction before revising.");
      return;
    }

    setRevisingSectionId(section.id);
    setRevisionError("");

    try {
      const revisedText = await reviseResumeSection({
        apiKey,
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
        setExportStatus("DOCX downloaded.");
      }
      if (action === "pdf") {
        downloadPdf(resume);
        setExportStatus("PDF downloaded.");
      }
      if (action === "copy") {
        await copyPlainText(resume);
        setExportStatus("Plain text copied.");
      }
    } catch (error) {
      setExportError(error instanceof Error ? error.message : "Export failed.");
    }
  }

  return (
    <section className="review-workspace" aria-labelledby="review-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Step 4</p>
          <h2 id="review-title">Review and edit</h2>
        </div>
        <div className="score-grid" aria-label="Keyword match scores">
          <KeywordScoreCard label="Before" score={originalScore} />
          <KeywordScoreCard label="After" score={optimizedScore} />
        </div>
      </div>

      <div className="diff-grid" aria-label="Side-by-side resume diff">
        <DiffPane title="Original" tokens={diff} side="original" />
        <DiffPane title="Optimized" tokens={diff} side="optimized" />
      </div>

      <div className="editor-grid">
        {sections.map((section) => (
          <article className="section-editor" key={section.id}>
            <div className="editor-heading">
              <h3>{section.label}</h3>
              {section.id.startsWith("experience:") ? <span>Role section</span> : null}
            </div>
            <textarea
              value={sectionText(resume, section.id)}
              onChange={(event) => handleSectionChange(section.id, event.target.value)}
            />
            <form className="revision-row" onSubmit={(event) => handleReviseSection(event, section)}>
              <input
                type="text"
                value={revisionInstructions[section.id] ?? ""}
                placeholder="Ask AI to revise this section..."
                onChange={(event) =>
                  setRevisionInstructions((current) => ({
                    ...current,
                    [section.id]: event.target.value,
                  }))
                }
              />
              <button
                type="submit"
                disabled={revisingSectionId.length > 0 || !(revisionInstructions[section.id] ?? "").trim()}
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

      {revisionError ? <div className="inline-error">{revisionError}</div> : null}

      <section className="export-panel" aria-labelledby="export-title">
        <div>
          <p className="eyebrow">Step 5</p>
          <h2 id="export-title">Export</h2>
        </div>
        <div className="export-actions">
          <button type="button" onClick={() => handleExport("docx")}>
            <FileDown aria-hidden="true" />
            DOCX
          </button>
          <button type="button" onClick={() => handleExport("pdf")}>
            <Download aria-hidden="true" />
            PDF
          </button>
          <button type="button" onClick={() => handleExport("copy")}>
            <ClipboardCopy aria-hidden="true" />
            Copy text
          </button>
        </div>
        {exportStatus ? <span className="export-status">{exportStatus}</span> : null}
        {exportError ? <div className="inline-error">{exportError}</div> : null}
      </section>
    </section>
  );
}

function KeywordScoreCard({ label, score }: { label: string; score: KeywordScore }) {
  return (
    <div className="score-card">
      <span>{label}</span>
      <strong>
        {score.matched.length}/{score.total}
      </strong>
      <div className="score-meter" aria-hidden="true">
        <span style={{ width: `${Math.round(score.ratio * 100)}%` }} />
      </div>
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
      <div className="diff-title">
        <h3>{title}</h3>
        {side === "optimized" ? <CheckCircle2 aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}
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
