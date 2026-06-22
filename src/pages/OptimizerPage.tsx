import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  FileText,
  Link2,
  Loader2,
  Mail,
  Sparkles,
  Upload,
} from "lucide-react";
import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { useSettings } from "../context/SettingsContext";
import { fetchJobPageText } from "../lib/fetchJobPage";
import { deriveTailoredResumeName, extractJobTitle } from "../lib/jobTitle";
import { openAIErrorMessage } from "../lib/openai";
import {
  generateCoverLetterWithProvider,
  optimizeResumeWithProvider,
} from "../lib/providers/dispatch";
import { normalizeStructuredResume, resumeToPlainText, type StructuredResume } from "../lib/resume";
import type { ResumeTemplateId } from "../lib/resumeTemplates";

const ResumeReview = lazy(() =>
  import("../components/ResumeReview").then((module) => ({ default: module.ResumeReview })),
);

type JobAddMode = "paste" | "link";

type OptimizerPageProps = {
  embedded?: boolean;
  onOpenResumes?: () => void;
  reviewRunId?: string;
};

export default function OptimizerPage({ embedded = false, onOpenResumes, reviewRunId }: OptimizerPageProps) {
  const {
    resumes,
    activeResume,
    setActiveResume,
    addResume,
    getRun,
    addRun,
    updateRunReview,
    incrementResumeUsage,
    recordExport,
    refresh,
  } = useAppData();
  const { provider, toggles } = useSettings();

  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [jobAddMode, setJobAddMode] = useState<JobAddMode>("paste");
  const [jobDescription, setJobDescription] = useState("");
  const [isJobPanelCollapsed, setIsJobPanelCollapsed] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [isFetchingJD, setIsFetchingJD] = useState(false);
  const [fetchJDError, setFetchJDError] = useState("");
  const [coverLetter, setCoverLetter] = useState("");
  const [coverLetterStatus, setCoverLetterStatus] = useState("");
  const [coverLetterError, setCoverLetterError] = useState("");
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);

  const [optimizedResume, setOptimizedResume] = useState<StructuredResume | null>(null);
  const [reviewOriginalResumeText, setReviewOriginalResumeText] = useState("");
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewSourceResumeId, setReviewSourceResumeId] = useState("");
  const [reviewTemplateId, setReviewTemplateId] = useState<ResumeTemplateId>("ats-simple");
  const [optimizeError, setOptimizeError] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isLoadingSavedReview, setIsLoadingSavedReview] = useState(false);
  const [currentRunId, setCurrentRunId] = useState("");

  const hasJD = jobDescription.trim().length > 0;
  const canOptimize = hasJD && Boolean(activeResume) && !isOptimizing;
  const canGenerateCoverLetter =
    hasJD && Boolean(activeResume) && !isGeneratingCoverLetter && !isOptimizing && !isFetchingJD;
  const isJobReferenceCollapsed = Boolean(optimizedResume && isJobPanelCollapsed);
  const ContentTag = embedded ? "section" : "main";

  function renderResumeAction(label: string) {
    if (onOpenResumes) {
      return (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenResumes}>
          {label}
          <Upload aria-hidden="true" />
        </button>
      );
    }

    return (
      <Link to="/workspace/resumes" className="btn btn-secondary btn-sm">
        {label}
        <Upload aria-hidden="true" />
      </Link>
    );
  }

  function resetResult() {
    setOptimizedResume(null);
    setReviewOriginalResumeText("");
    setReviewTitle("");
    setReviewSourceResumeId("");
    setReviewTemplateId((activeResume?.templateId as ResumeTemplateId | undefined) ?? "ats-simple");
    setOptimizeError("");
    setCoverLetter("");
    setCoverLetterStatus("");
    setCoverLetterError("");
    setCurrentRunId("");
    setIsJobPanelCollapsed(false);
  }

  useEffect(() => {
    setCoverLetter("");
    setCoverLetterStatus("");
    setCoverLetterError("");
  }, [activeResume?.id]);

  useEffect(() => {
    if (!reviewRunId) return;

    let isCurrent = true;
    setIsLoadingSavedReview(true);
    setOptimizeError("");

    (async () => {
      try {
        const run = await getRun(reviewRunId);
        if (!isCurrent) return;

        const savedResume = normalizeStructuredResume(run.optimizedResume);
        if (!run.optimizedResume) {
          throw new Error("This run does not have a saved optimized resume to review.");
        }

        setJobAddMode("paste");
        setJobDescription(run.jobDescription);
        setOptimizedResume(savedResume);
        setReviewOriginalResumeText(
          run.originalResumeText || resumes.find((resume) => resume.id === run.resumeId)?.text || "",
        );
        setReviewTitle(run.title);
        setReviewSourceResumeId(run.resumeId);
        setReviewTemplateId((run.templateId as ResumeTemplateId | undefined) ?? "ats-simple");
        setCurrentRunId(run.id);
        setIsJobPanelCollapsed(true);
      } catch (error) {
        if (isCurrent) {
          setOptimizeError(error instanceof Error ? error.message : "Could not load saved review.");
        }
      } finally {
        if (isCurrent) setIsLoadingSavedReview(false);
      }
    })();

    return () => {
      isCurrent = false;
    };
  }, [reviewRunId]);

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
        resumeId: activeResume.id,
        resumeName: activeResume.name,
        saveRunHistory: toggles.saveRunHistory,
        title: extractJobTitle(jobDescription),
      });
      setOptimizedResume(result.resume);
      setReviewOriginalResumeText(activeResume.text);
      setReviewTitle(extractJobTitle(jobDescription));
      setReviewSourceResumeId(activeResume.id);
      setReviewTemplateId((result.run?.templateId as ResumeTemplateId | undefined) ?? (activeResume.templateId as ResumeTemplateId | undefined) ?? "ats-simple");
      setIsJobPanelCollapsed(true);

      if (result.persisted) {
        await refresh();
        if (result.run) setCurrentRunId(result.run.id);
        return;
      }

      await incrementResumeUsage(activeResume.id);
      if (toggles.saveRunHistory) {
        const run = await addRun({
          title: extractJobTitle(jobDescription),
          resumeId: activeResume.id,
          resumeName: activeResume.name,
          jobDescription,
          score: result.score,
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

  async function handleGenerateCoverLetter() {
    if (!canGenerateCoverLetter || !activeResume) return;

    setCoverLetterStatus("");
    setCoverLetterError("");
    setIsGeneratingCoverLetter(true);

    try {
      const resumeText = optimizedResume ? resumeToPlainText(optimizedResume) : activeResume.text;
      const generated = await generateCoverLetterWithProvider({
        provider,
        jobDescription,
        resumeText,
        jobTitle: extractJobTitle(jobDescription),
      });
      setCoverLetter(generated);
      setCoverLetterStatus("Cover letter generated.");
    } catch (error) {
      setCoverLetterError(openAIErrorMessage(error));
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  }

  async function handleCopyCoverLetter() {
    setCoverLetterStatus("");
    setCoverLetterError("");

    try {
      await navigator.clipboard.writeText(coverLetter);
      setCoverLetterStatus("Cover letter copied.");
    } catch {
      setCoverLetterError("Could not copy the cover letter.");
    }
  }

  return (
    <>
      {!embedded && (
        <header className="page-topbar">
          <span className="page-topbar-title">Workspace</span>
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
      )}

      <ContentTag className={`page-content optimizer-page${embedded ? " workspace-job-section" : ""}`}>
        {!embedded && (
          <section className="optimizer-resume-context" aria-label="Selected resume">
            <div className="optimizer-context-copy">
              <span className="section-label">Selected resume</span>
              {activeResume ? (
                <>
                  <h1>{activeResume.name}</h1>
                  <p>
                    {activeResume.characterCount.toLocaleString()} chars · used in {activeResume.usageCount} runs
                  </p>
                </>
              ) : (
                <>
                  <h1>No resume selected</h1>
                  <p>Choose a source resume before generating a tailored version.</p>
                </>
              )}
            </div>
            <div className="optimizer-context-actions">
              {renderResumeAction(activeResume ? "Change resume" : "Add resume")}
            </div>
          </section>
        )}

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
                  {renderResumeAction("Upload")}
                </div>
              )}
            </div>
          )}

          {jobAddMode && (!optimizedResume || !isJobReferenceCollapsed) && (
            <div className={`job-entry-panel${isJobReferenceCollapsed ? " is-collapsed" : ""}`}>
              <div className="job-entry-header">
                <div className="job-entry-title">
                  <div>
                    <span className="section-label">Target job</span>
                    <h2 key={jobAddMode}>{jobAddMode === "paste" ? "Job description" : "Job posting URL"}</h2>
                  </div>
                  {!activeResume && (
                    <div className="warning-banner">
                      <AlertTriangle aria-hidden="true" />
                      <span className="warning-banner-text">Resume required.</span>
                      {renderResumeAction("Upload")}
                    </div>
                  )}
                </div>
                <div className="job-entry-actions">
                  {optimizedResume && (
                    <button
                      type="button"
                      className="mode-switch-button"
                      aria-expanded={!isJobReferenceCollapsed}
                      onClick={() => setIsJobPanelCollapsed((collapsed) => !collapsed)}
                    >
                      {isJobReferenceCollapsed ? (
                        <ChevronDown aria-hidden="true" />
                      ) : (
                        <ChevronUp aria-hidden="true" />
                      )}
                      {isJobReferenceCollapsed ? "Show job" : "Collapse job"}
                    </button>
                  )}
                  <button
                    type="button"
                    className="mode-switch-button"
                    disabled={isOptimizing || isFetchingJD}
                    onClick={() => {
                      setJobAddMode(jobAddMode === "paste" ? "link" : "paste");
                      setIsJobPanelCollapsed(false);
                    }}
                  >
                    {jobAddMode === "paste" ? <Link2 aria-hidden="true" /> : <FileText aria-hidden="true" />}
                    {jobAddMode === "paste" ? "Use link" : "Paste JD"}
                  </button>
                  <button
                    type="button"
                    className="mode-switch-button"
                    disabled={!canGenerateCoverLetter}
                    onClick={handleGenerateCoverLetter}
                  >
                    {isGeneratingCoverLetter ? (
                      <Loader2 className="spin" aria-hidden="true" />
                    ) : (
                      <Mail aria-hidden="true" />
                    )}
                    {coverLetter ? "Regenerate cover" : "Cover letter"}
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
                    {isOptimizing ? "Optimizing..." : "Optimize"}
                  </button>
                </div>
              </div>

              <div className={`job-reference-body${isJobReferenceCollapsed ? " is-collapsed" : ""}`}>
                <div className="job-editor-section" aria-hidden={isJobReferenceCollapsed || undefined}>
                  <div className="job-editor-section-inner">
                    {jobAddMode === "paste" && (
                      <div className="job-editor-card" key="paste-description">
                        <textarea
                          id="job-description"
                          className="field-textarea job-textarea"
                          value={jobDescription}
                          placeholder="Paste the full role description here. Include responsibilities, required skills, qualifications, tools, and any nice-to-have requirements."
                          disabled={isOptimizing || isJobReferenceCollapsed}
                          rows={12}
                          onChange={(e) => {
                            setJobDescription(e.target.value);
                            resetResult();
                          }}
                        />
                        <div className="job-editor-footer">
                          <span>{jobDescription.trim().length.toLocaleString()} chars</span>
                          <span>
                            {activeResume
                              ? `Tailoring against ${activeResume.name}`
                              : "Select a resume below before optimizing."}
                          </span>
                        </div>
                      </div>
                    )}

                    {jobAddMode === "link" && (
                      <div className="job-editor-card" key="job-link">
                        <div className="job-link-row">
                          <input
                            id="job-link"
                            className="field-input"
                            type="url"
                            value={linkValue}
                            placeholder="https://company.com/careers/job-id"
                            disabled={isFetchingJD || isOptimizing || isJobReferenceCollapsed}
                            onChange={(e) => setLinkValue(e.target.value)}
                          />
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            disabled={!linkValue.trim() || isFetchingJD || isOptimizing || isJobReferenceCollapsed}
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
                              disabled={isOptimizing || isJobReferenceCollapsed}
                              onChange={(e) => {
                                setJobDescription(e.target.value);
                                resetResult();
                              }}
                            />
                            <div className="job-editor-footer">
                              <span>{jobDescription.trim().length.toLocaleString()} characters extracted</span>
                              <span>
                                {activeResume
                                  ? `Tailoring against ${activeResume.name}`
                                  : "Select a resume below before optimizing."}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="job-collapsed-summary-wrapper">
                  <div className="job-collapsed-summary-inner">
                    <div className="job-collapsed-summary">
                      <span>{jobDescription.trim().length.toLocaleString()} characters in target job</span>
                      <span>Expanded only when you need to edit the source context.</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {(coverLetter || isGeneratingCoverLetter || coverLetterError || coverLetterStatus) && (
            <section className="job-cover-panel" aria-label="Cover letter">
              <div className="cover-letter-header">
                <div>
                  <p className="section-label">Cover letter</p>
                  <h3>
                    {optimizedResume
                      ? "Generated from the tailored resume and target job."
                      : "Generated from the selected resume and target job."}
                  </h3>
                </div>
                <div className="cover-letter-actions">
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={!canGenerateCoverLetter}
                    onClick={handleGenerateCoverLetter}
                  >
                    {isGeneratingCoverLetter ? (
                      <Loader2 className="spin" aria-hidden="true" />
                    ) : (
                      <Mail aria-hidden="true" />
                    )}
                    {coverLetter ? "Regenerate" : "Generate"}
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={!coverLetter.trim()}
                    onClick={handleCopyCoverLetter}
                  >
                    <ClipboardCopy aria-hidden="true" />
                    Copy
                  </button>
                </div>
              </div>

              <textarea
                className="cover-letter-textarea job-cover-textarea"
                value={coverLetter}
                disabled={isGeneratingCoverLetter}
                onChange={(event) => setCoverLetter(event.target.value)}
                placeholder="Your generated cover letter will appear here. You can edit it before copying."
                spellCheck
              />

              {coverLetterStatus && <p className="export-status-msg">{coverLetterStatus}</p>}
              {coverLetterError && <div className="inline-error">{coverLetterError}</div>}
            </section>
          )}

          {optimizeError && <div className="inline-error">{optimizeError}</div>}
          {isLoadingSavedReview && (
            <div className="review-loading">
              <Loader2 className="spin" aria-hidden="true" />
              Loading saved review…
            </div>
          )}
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
              originalResumeText={reviewOriginalResumeText || activeResume?.text || ""}
              resume={optimizedResume}
              provider={provider}
              onResumeChange={setOptimizedResume}
              sourceResume={activeResume}
              runTitle={reviewTitle || extractJobTitle(jobDescription)}
              runId={currentRunId}
              initialTemplateId={reviewTemplateId}
              onStartNewSession={() => {
                setJobDescription("");
                resetResult();
              }}
              onShowJob={() => setIsJobPanelCollapsed(false)}
              onSaveVersion={async (resume, score, templateId) => {
                const sourceResumeId = reviewSourceResumeId || activeResume?.sourceResumeId || activeResume?.id;
                if (!sourceResumeId) return;
                const text = resumeToPlainText(resume);
                await addResume({
                  name: deriveTailoredResumeName(jobDescription),
                  fileType: "text",
                  text,
                  characterCount: text.length,
                  templateId,
                  versionType: "tailored",
                  sourceResumeId,
                  sourceRunId: currentRunId || undefined,
                  tailoredFor: extractJobTitle(jobDescription),
                  matchScore: score,
                });
              }}
              onSaveReview={
                currentRunId
                  ? async (resume, templateId) => {
                      const run = await updateRunReview(currentRunId, {
                        jobDescription,
                        originalResumeText: reviewOriginalResumeText || activeResume?.text || "",
                        resume,
                        templateId,
                      });

                      if (run.optimizedResume) {
                        setOptimizedResume(normalizeStructuredResume(run.optimizedResume));
                      }
                      setReviewOriginalResumeText(run.originalResumeText || reviewOriginalResumeText);
                      setReviewTitle(run.title);
                      setReviewSourceResumeId(run.resumeId);
                      setReviewTemplateId((run.templateId as ResumeTemplateId | undefined) ?? templateId);
                      setCurrentRunId(run.id);
                    }
                  : undefined
              }
              onExported={(exportType) => {
                if (currentRunId) {
                  return recordExport(currentRunId, exportType);
                }
              }}
            />
          </Suspense>
        )}
      </ContentTag>
    </>
  );
}
