import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  FileText,
  Link2,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { useSettings } from "../context/SettingsContext";
import { fetchJobPageText } from "../lib/fetchJobPage";
import { openAIErrorMessage } from "../lib/openai";
import { optimizeResumeWithProvider } from "../lib/providers/dispatch";
import { resumeToPlainText, scoreKeywords, type StructuredResume } from "../lib/resume";

const ResumeReview = lazy(() =>
  import("../components/ResumeReview").then((module) => ({ default: module.ResumeReview })),
);

type JobAddMode = "paste" | "link";

function deriveRunTitle(jobDescription: string): string {
  const firstLine = jobDescription
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);
  if (!firstLine) return "Untitled role";
  return firstLine.length > 70 ? `${firstLine.slice(0, 67)}…` : firstLine;
}

export default function OptimizerPage() {
  const { resumes, activeResume, setActiveResume, addRun, incrementResumeUsage, updateRunStatus } =
    useAppData();
  const { provider, toggles } = useSettings();

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [jobAddMode, setJobAddMode] = useState<JobAddMode | null>(null);
  const [jobDescription, setJobDescription] = useState("");
  const [linkValue, setLinkValue] = useState("");
  const [isFetchingJD, setIsFetchingJD] = useState(false);
  const [fetchJDError, setFetchJDError] = useState("");

  const [optimizedResume, setOptimizedResume] = useState<StructuredResume | null>(null);
  const [optimizeError, setOptimizeError] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [currentRunId, setCurrentRunId] = useState("");

  const hasJD = jobDescription.trim().length > 0;
  const canOptimize = hasJD && Boolean(activeResume) && !isOptimizing;

  function resetResult() {
    setOptimizedResume(null);
    setOptimizeError("");
    setCurrentRunId("");
  }

  async function handleFetchLink() {
    setIsFetchingJD(true);
    setFetchJDError("");

    try {
      const text = await fetchJobPageText(linkValue.trim());
      setJobDescription(text);
      resetResult();
    } catch (error) {
      setFetchJDError(error instanceof Error ? error.message : "Could not fetch the job page.");
    } finally {
      setIsFetchingJD(false);
    }
  }

  async function handleOptimize() {
    if (!canOptimize || !activeResume) return;

    setIsOptimizing(true);
    setOptimizeError("");

    try {
      const result = await optimizeResumeWithProvider({
        provider,
        jobDescription,
        resumeText: activeResume.text,
      });
      setOptimizedResume(result);

      const score = Math.round(scoreKeywords(jobDescription, resumeToPlainText(result)).ratio * 100);
      await incrementResumeUsage(activeResume.id);

      if (toggles.saveRunHistory) {
        const run = await addRun({
          title: deriveRunTitle(jobDescription),
          resumeId: activeResume.id,
          resumeName: activeResume.name,
          jobDescription,
          score,
          status: "draft",
        });
        setCurrentRunId(run.id);
      }
    } catch (error) {
      setOptimizeError(openAIErrorMessage(error));
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <>
      <header className="page-topbar">
        <span className="page-topbar-title">Optimizer</span>
        <div className="page-topbar-end">
          {activeResume ? (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="resume-pill"
                onClick={() => setIsSwitcherOpen((open) => !open)}
              >
                <span className="resume-pill-dot" aria-hidden="true" />
                {activeResume.name} · switch
                <ChevronDown aria-hidden="true" />
              </button>
              {isSwitcherOpen && (
                <div
                  className="insight-card"
                  style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 20, width: 240 }}
                >
                  {resumes.map((resume) => (
                    <button
                      key={resume.id}
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ width: "100%", justifyContent: "flex-start", marginBottom: 4 }}
                      onClick={() => {
                        setActiveResume(resume.id);
                        setIsSwitcherOpen(false);
                      }}
                    >
                      {resume.id === activeResume.id ? <CheckCircle2 aria-hidden="true" /> : null}
                      {resume.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </header>

      <main className="page-content">
        <section className="input-col" aria-label="Job description input">
          {!jobAddMode && (
            <div className="choice-section">
              <p className="choice-heading">How do you want to add the job?</p>
              <div className="choice-row">
                <button
                  type="button"
                  className="choice-card"
                  onClick={() => setJobAddMode("paste")}
                >
                  <span className="choice-card-icon" aria-hidden="true">
                    <FileText />
                  </span>
                  <span className="choice-card-title">Paste description</span>
                  <span className="choice-card-desc">Copy the full JD and paste it in</span>
                </button>
                <div className="choice-divider" aria-hidden="true">
                  <span>or</span>
                </div>
                <button
                  type="button"
                  className="choice-card"
                  onClick={() => setJobAddMode("link")}
                >
                  <span className="choice-card-icon" aria-hidden="true">
                    <Link2 />
                  </span>
                  <span className="choice-card-title">Drop a link</span>
                  <span className="choice-card-desc">Paste the posting URL, we'll fetch it</span>
                </button>
              </div>
              {!activeResume && (
                <div className="warning-banner choice-warning">
                  <AlertTriangle aria-hidden="true" />
                  <span className="warning-banner-text">Resume required to optimize.</span>
                  <Link to="/resumes" className="btn btn-secondary btn-sm">
                    Upload
                    <Upload aria-hidden="true" />
                  </Link>
                </div>
              )}
            </div>
          )}

          {jobAddMode && (
            <div className="job-entry-panel">
              <div className="job-entry-header">
                <div className="job-entry-title">
                  <h2>{jobAddMode === "paste" ? "Job Description" : "Job posting URL"}</h2>
                  {!activeResume && (
                    <div className="warning-banner">
                      <AlertTriangle aria-hidden="true" />
                      <span className="warning-banner-text">Resume required.</span>
                      <Link to="/resumes" className="btn btn-secondary btn-sm">
                        Upload
                        <Upload aria-hidden="true" />
                      </Link>
                    </div>
                  )}
                </div>
                <div className="job-entry-actions">
                  <button
                    type="button"
                    className="mode-switch-button"
                    disabled={isOptimizing || isFetchingJD}
                    onClick={() => setJobAddMode(jobAddMode === "paste" ? "link" : "paste")}
                  >
                    {jobAddMode === "paste" ? <Link2 aria-hidden="true" /> : <FileText aria-hidden="true" />}
                    {jobAddMode === "paste" ? "Use link" : "Paste JD"}
                  </button>
                  <button
                    className="btn btn-primary btn-optimize"
                    type="button"
                    disabled={!canOptimize}
                    onClick={handleOptimize}
                  >
                    {isOptimizing ? (
                      <Loader2 className="spin" aria-hidden="true" />
                    ) : (
                      <Sparkles aria-hidden="true" />
                    )}
                    {isOptimizing ? "Optimizing…" : "Optimize"}
                  </button>
                </div>
              </div>

              {jobAddMode === "paste" && (
                <div className="job-editor-card">
                  <textarea
                    id="job-description"
                    className="field-textarea job-textarea"
                    value={jobDescription}
                    placeholder="Paste the full role description here. Include responsibilities, required skills, qualifications, tools, and any nice-to-have requirements."
                    disabled={isOptimizing}
                    rows={12}
                    onChange={(e) => {
                      setJobDescription(e.target.value);
                      resetResult();
                    }}
                  />
                  <div className="job-editor-footer">
                    <span>{jobDescription.trim().length.toLocaleString()} chars</span>
                    <span>Include requirements, responsibilities, tools, and nice-to-haves.</span>
                  </div>
                </div>
              )}

              {jobAddMode === "link" && (
                <div className="job-editor-card">
                  <div className="job-link-row">
                    <input
                      id="job-link"
                      className="field-input"
                      type="url"
                      value={linkValue}
                      placeholder="https://company.com/careers/job-id"
                      disabled={isFetchingJD || isOptimizing}
                      onChange={(e) => setLinkValue(e.target.value)}
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      type="button"
                      disabled={!linkValue.trim() || isFetchingJD || isOptimizing}
                      onClick={handleFetchLink}
                    >
                      {isFetchingJD ? <Loader2 className="spin" aria-hidden="true" /> : null}
                      {isFetchingJD ? "Fetching…" : "Fetch"}
                    </button>
                  </div>
                  {fetchJDError && (
                    <div className="inline-error">
                      <AlertCircle aria-hidden="true" />
                      {fetchJDError}
                    </div>
                  )}
                  {jobDescription && (
                    <>
                      <textarea
                        className="field-textarea job-textarea compact"
                        value={jobDescription}
                        rows={9}
                        disabled={isOptimizing}
                        onChange={(e) => {
                          setJobDescription(e.target.value);
                          resetResult();
                        }}
                      />
                      <div className="job-editor-footer">
                        <span>{jobDescription.trim().length.toLocaleString()} characters extracted</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {optimizeError && <div className="inline-error">{optimizeError}</div>}
        </section>

        {optimizedResume && (
          <Suspense
            fallback={
              <div className="review-loading">
                <Loader2 className="spin" aria-hidden="true" />
                Loading review workspace…
              </div>
            }
          >
            <ResumeReview
              jobDescription={jobDescription}
              originalResumeText={activeResume?.text ?? ""}
              resume={optimizedResume}
              onResumeChange={setOptimizedResume}
              onExported={() => {
                if (currentRunId) {
                  void updateRunStatus(currentRunId, "exported");
                }
              }}
            />
          </Suspense>
        )}
      </main>
    </>
  );
}
