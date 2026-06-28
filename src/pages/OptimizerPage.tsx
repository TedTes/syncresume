import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  FileText,
  Link2,
  Loader2,
  Mail,
  Pencil,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { useSettings } from "../context/SettingsContext";
import { fetchJobPageText } from "../lib/fetchJobPage";
import { extractJobTitle } from "../lib/jobTitle";
import { openAIErrorMessage } from "../lib/openai";
import {
  generateCoverLetterWithProvider,
  optimizeResumeWithProvider,
} from "../lib/providers/dispatch";
import { normalizeStructuredResume, resumeToPlainText, type StructuredResume } from "../lib/resume";
import type { ResumeRecord } from "../lib/storage";
import type { ResumeTemplateId } from "../templates/registry";

const ResumeReview = lazy(() =>
  import("../components/ResumeReview").then((module) => ({ default: module.ResumeReview })),
);

function formatRelativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

type JobAddMode = "paste" | "link";
type WorkspaceArtifact = "resume" | "cover-letter" | "job-description";

type OptimizerPageProps = {
  embedded?: boolean;
  onOpenResumes?: () => void;
  onReviewOpenChange?: (isOpen: boolean) => void;
  preferredArtifact?: WorkspaceArtifact;
  reviewBackPath?: string;
  reviewRunId?: string;
  reviewToolbarHost?: HTMLElement | null;
  isTemplatePanelOpen?: boolean;
  onOpenTemplates?: () => void;
};

type ReviewReturnState = {
  returnTo?: string;
  expandedRunId?: string;
} | null;

export default function OptimizerPage({
  embedded = false,
  onOpenResumes,
  onReviewOpenChange,
  preferredArtifact = "resume",
  reviewBackPath,
  reviewRunId,
  reviewToolbarHost,
  isTemplatePanelOpen = false,
  onOpenTemplates,
}: OptimizerPageProps) {
  const {
    runs,
    resumes,
    activeResume,
    setActiveResume,
    getRun,
    addRun,
    updateRunReview,
    updateRunCoverLetter,
    updateResumeName,
    deleteResume,
    incrementResumeUsage,
    recordExport,
    refresh,
  } = useAppData();
  const { provider, toggles } = useSettings();
  const navigate = useNavigate();
  const location = useLocation();

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
  const [isCoverLetterPanelOpen, setIsCoverLetterPanelOpen] = useState(false);
  const [isGeneratingCoverLetter, setIsGeneratingCoverLetter] = useState(false);
  const [isSavingCoverLetter, setIsSavingCoverLetter] = useState(false);
  const [activeArtifact, setActiveArtifact] = useState<WorkspaceArtifact>(preferredArtifact);

  const [optimizedResume, setOptimizedResume] = useState<StructuredResume | null>(null);
  const [reviewOriginalResumeText, setReviewOriginalResumeText] = useState("");
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewSourceResumeId, setReviewSourceResumeId] = useState("");
  const [reviewTemplateId, setReviewTemplateId] = useState<ResumeTemplateId>("ats-simple");
  const [optimizeError, setOptimizeError] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isLoadingSavedReview, setIsLoadingSavedReview] = useState(Boolean(reviewRunId));
  const [currentRunId, setCurrentRunId] = useState("");
  const [renamingVersionId, setRenamingVersionId] = useState("");
  const [renamingVersionName, setRenamingVersionName] = useState("");
  const [isRenamingVersion, setIsRenamingVersion] = useState(false);
  const [versionRenameError, setVersionRenameError] = useState("");
  const [pendingDeleteVersion, setPendingDeleteVersion] = useState<ResumeRecord | null>(null);
  const [deletingVersionId, setDeletingVersionId] = useState("");
  const [versionDeleteError, setVersionDeleteError] = useState("");
  const jobPanelRef = useRef<HTMLDivElement | null>(null);
  const coverLetterPanelRef = useRef<HTMLElement | null>(null);
  const reviewPanelRef = useRef<HTMLDivElement | null>(null);

  const hasJD = jobDescription.trim().length > 0;
  const canOptimize = hasJD && Boolean(activeResume) && !isOptimizing;

  const jdSignals = useMemo(() => {
    const text = jobDescription.trim();
    if (text.length < 80) return { role: "", keywords: [] as string[] };

    const lines = text.split("\n").map((l) => l.trim()).filter((l) => l.length > 2 && l.length < 70);
    const role = lines.find((l) =>
      /\b(engineer|developer|designer|analyst|manager|architect|scientist|lead|director|specialist)\b/i.test(l),
    ) ?? "";

    const knownTech =
      /\b(React|TypeScript|JavaScript|Python|Java|Go|Rust|Node\.?js|AWS|GCP|Azure|Docker|Kubernetes|PostgreSQL|MySQL|MongoDB|Redis|GraphQL|gRPC|Kafka|Terraform|CI\/CD|Next\.?js|Vue|Angular|Swift|Kotlin|Flutter|Figma|SQL|NoSQL|Machine Learning|Spark|Airflow|dbt|Snowflake)\b/g;
    const techMatches = [...new Set((text.match(knownTech) ?? []).map((k) => k.trim()))];
    const acronyms = [...new Set(
      (text.match(/\b[A-Z]{2,5}\b/g) ?? []).filter(
        (w) => !["THE", "AND", "FOR", "WITH", "THAT", "THIS", "WILL", "HAVE", "FROM", "THEY",
                  "YOUR", "BEEN", "WHEN", "WHAT", "MORE", "INTO", "ALSO", "OVER", "WORK",
                  "TEAM", "ROLE", "JOIN", "HELP", "MUST", "NICE", "PLUS", "NOTE"].includes(w),
      ),
    )];
    const keywords = [...new Set([...techMatches, ...acronyms])].slice(0, 8);
    return { role, keywords };
  }, [jobDescription]);

  const resumeVersions = useMemo(() => {
    if (!activeResume) return [];
    return resumes
      .filter((r) => r.versionType === "tailored" && r.sourceResumeId === activeResume.id)
      .map((resume) => ({
        resume,
        run: runs.find((r) => r.tailoredResumeId === resume.id || r.id === resume.sourceRunId) ?? null,
      }))
      .sort((a, b) => new Date(b.resume.uploadedAt).getTime() - new Date(a.resume.uploadedAt).getTime())
      .slice(0, 5);
  }, [resumes, runs, activeResume]);
  const sourceResumeOptions = useMemo(() => {
    const originals = resumes.filter((resume) => resume.versionType !== "tailored");
    return originals.length > 0 ? originals : resumes;
  }, [resumes]);
  const canGenerateCoverLetter =
    hasJD && Boolean(activeResume) && !isGeneratingCoverLetter && !isOptimizing && !isFetchingJD;
  const isJobReferenceCollapsed = Boolean(optimizedResume && isJobPanelCollapsed);
  const shouldShowSavedReviewLoader = Boolean(
    reviewRunId && isLoadingSavedReview && currentRunId !== reviewRunId,
  );
  const shouldShowCoverLetterPanel = Boolean(
    activeArtifact === "cover-letter" ||
      isCoverLetterPanelOpen ||
      isGeneratingCoverLetter ||
      isSavingCoverLetter ||
      coverLetterError ||
      coverLetterStatus,
  );
  const shouldShowResumeReview = Boolean(
    optimizedResume && activeArtifact === "resume",
  );
  const currentReviewRun = currentRunId
    ? runs.find((run) => run.id === currentRunId) ?? null
    : null;
  const isSavedReviewMode = Boolean(reviewRunId);
  const ContentTag = embedded ? "section" : "main";

  function renderResumeAction(label: string) {
    if (embedded) {
      const hasOptions = sourceResumeOptions.length > 0;
      return (
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          disabled={!hasOptions}
          onClick={() => setIsSwitcherOpen(true)}
        >
          {hasOptions ? "Select resume" : "No resumes"}
          <Upload aria-hidden="true" />
        </button>
      );
    }

    if (onOpenResumes) {
      return (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenResumes}>
          {label}
          <Upload aria-hidden="true" />
        </button>
      );
    }

    return (
      <Link to="/resumes" className="btn btn-secondary btn-sm">
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
    setIsCoverLetterPanelOpen(false);
    setIsSavingCoverLetter(false);
    setActiveArtifact("resume");
    setCurrentRunId("");
    setIsJobPanelCollapsed(false);
  }

  function handleReviewBack() {
    resetResult();
    const state = location.state as ReviewReturnState;

    if (reviewRunId && state?.returnTo) {
      navigate(state.returnTo, {
        replace: true,
        state: state.expandedRunId ? { expandedRunId: state.expandedRunId } : undefined,
      });
      return;
    }

    navigate(reviewBackPath ?? "/workspace/optimize", { replace: Boolean(reviewRunId) });
  }

  useEffect(() => {
    setCoverLetter("");
    setCoverLetterStatus("");
    setCoverLetterError("");
    setIsCoverLetterPanelOpen(false);
    setIsSavingCoverLetter(false);
    if (!reviewRunId) {
      setActiveArtifact("resume");
    }
  }, [activeResume?.id, reviewRunId]);

  useEffect(() => {
    onReviewOpenChange?.(Boolean(
      shouldShowResumeReview ||
      shouldShowSavedReviewLoader ||
      shouldShowCoverLetterPanel,
    ));
  }, [
    onReviewOpenChange,
    shouldShowCoverLetterPanel,
    shouldShowResumeReview,
    shouldShowSavedReviewLoader,
  ]);

  useEffect(() => {
    return () => {
      onReviewOpenChange?.(false);
    };
  }, [onReviewOpenChange]);

  useEffect(() => {
    setActiveArtifact(preferredArtifact);
    if (reviewRunId) {
      setIsCoverLetterPanelOpen(preferredArtifact === "cover-letter");
      setCoverLetterStatus("");
      setCoverLetterError("");
    }
  }, [preferredArtifact, reviewRunId]);

  useEffect(() => {
    if (!reviewRunId) {
      if (currentRunId) resetResult();
      setIsLoadingSavedReview(false);
      return;
    }

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
        setCoverLetter(run.coverLetterText ?? "");
        setIsCoverLetterPanelOpen(preferredArtifact === "cover-letter");
        setCoverLetterStatus("");
        setCoverLetterError("");
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

  useEffect(() => {
    if (!reviewRunId || shouldShowSavedReviewLoader) return;

    if (preferredArtifact === "job-description") {
      setIsJobPanelCollapsed(false);
    }
  }, [preferredArtifact, reviewRunId, shouldShowSavedReviewLoader]);

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
      const requestedTitle = extractJobTitle(jobDescription);
      const result = await optimizeResumeWithProvider({
        provider,
        jobDescription,
        resumeText: activeResume.text,
        resumeId: activeResume.id,
        resumeName: activeResume.name,
        saveRunHistory: toggles.saveRunHistory,
        title: requestedTitle,
      });
      setOptimizedResume(result.resume);
      setReviewOriginalResumeText(activeResume.text);
      setReviewTitle(result.run?.title ?? requestedTitle);
      setReviewSourceResumeId(activeResume.id);
      setReviewTemplateId((result.run?.templateId as ResumeTemplateId | undefined) ?? (activeResume.templateId as ResumeTemplateId | undefined) ?? "ats-simple");
      setActiveArtifact("resume");
      setIsCoverLetterPanelOpen(false);
      setIsJobPanelCollapsed(true);

      if (result.persisted) {
        await refresh();
        if (result.run) setCurrentRunId(result.run.id);
        return;
      }

      await incrementResumeUsage(activeResume.id);
      if (toggles.saveRunHistory) {
        const run = await addRun({
          title: requestedTitle,
          resumeId: activeResume.id,
          resumeName: activeResume.name,
          jobDescription,
          score: result.score,
          status: "draft",
        });
        setCurrentRunId(run.id);
        setReviewTitle(run.title);
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
    setActiveArtifact("cover-letter");
    setIsCoverLetterPanelOpen(true);
    setIsGeneratingCoverLetter(true);

    try {
      const resumeText = optimizedResume ? resumeToPlainText(optimizedResume) : activeResume.text;
      const generated = await generateCoverLetterWithProvider({
        provider,
        jobDescription,
        resumeText,
        jobTitle: extractJobTitle(jobDescription),
        runId: currentRunId ?? undefined,
      });
      setCoverLetter(generated);
      setCoverLetterStatus("Cover letter generated.");
      if (currentRunId) {
        await refresh({ force: true });
      }
    } catch (error) {
      setCoverLetterError(openAIErrorMessage(error));
    } finally {
      setIsGeneratingCoverLetter(false);
    }
  }

  async function ensureCoverLetterRun(): Promise<string> {
    if (currentRunId) return currentRunId;
    if (!activeResume) throw new Error("Select a resume before saving a cover letter.");
    if (!jobDescription.trim()) throw new Error("Add a job description before saving a cover letter.");

    const requestedTitle = extractJobTitle(jobDescription);
    const run = await addRun({
      title: requestedTitle,
      resumeId: activeResume.id,
      resumeName: activeResume.name,
      jobDescription,
      score: optimizedResume ? 0 : 0,
      status: "draft",
    });
    setCurrentRunId(run.id);
    setReviewTitle(run.title);
    setReviewSourceResumeId(run.resumeId);
    return run.id;
  }

  async function handleSaveCoverLetter() {
    const normalizedCoverLetter = coverLetter.replace(/\r/g, "").trim();
    if (!normalizedCoverLetter) {
      setCoverLetterError("Write or generate a cover letter before saving.");
      return;
    }

    setIsSavingCoverLetter(true);
    setCoverLetterStatus("");
    setCoverLetterError("");
    try {
      const runId = await ensureCoverLetterRun();
      const run = await updateRunCoverLetter(runId, { coverLetterText: normalizedCoverLetter });
      setCoverLetter(run.coverLetterText ?? normalizedCoverLetter);
      setCoverLetterStatus("Cover letter saved.");
    } catch (error) {
      setCoverLetterError(error instanceof Error ? error.message : "Could not save the cover letter.");
    } finally {
      setIsSavingCoverLetter(false);
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

  function openTailoredVersion(runId: string | null | undefined, resumeId: string) {
    if (runId) {
      navigate(`/workspace/review/${runId}?artifact=resume`, { state: { returnTo: "/workspace" } });
      return;
    }

    void setActiveResume(resumeId);
  }

  function startVersionRename(resume: ResumeRecord) {
    setRenamingVersionId(resume.id);
    setRenamingVersionName(resume.name);
    setVersionRenameError("");
  }

  function cancelVersionRename() {
    setRenamingVersionId("");
    setRenamingVersionName("");
    setVersionRenameError("");
  }

  async function handleRenameVersion(resume: ResumeRecord) {
    const nextName = renamingVersionName.trim();

    if (!nextName) {
      setVersionRenameError("Version name is required.");
      return;
    }

    if (nextName === resume.name) {
      cancelVersionRename();
      return;
    }

    setIsRenamingVersion(true);
    setVersionRenameError("");
    try {
      await updateResumeName(resume.id, nextName);
      cancelVersionRename();
    } catch (error) {
      setVersionRenameError(error instanceof Error ? error.message : "Could not rename this version.");
    } finally {
      setIsRenamingVersion(false);
    }
  }

  function closeDeleteVersionDialog() {
    if (deletingVersionId) return;
    setPendingDeleteVersion(null);
    setVersionDeleteError("");
  }

  async function handleDeleteVersion() {
    if (!pendingDeleteVersion) return;

    const resume = pendingDeleteVersion;
    setDeletingVersionId(resume.id);
    setVersionDeleteError("");
    try {
      await deleteResume(resume.id);
      if (resume.isActive && resume.sourceResumeId) {
        await setActiveResume(resume.sourceResumeId);
      }
      setPendingDeleteVersion(null);
    } catch (error) {
      setVersionDeleteError(error instanceof Error ? error.message : "Could not delete this version.");
    } finally {
      setDeletingVersionId("");
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

      <ContentTag
        className={`page-content optimizer-page${embedded ? " workspace-job-section" : ""}${
          isSavedReviewMode ? " saved-application-review" : ""
        }`}
      >
        {shouldShowSavedReviewLoader ? (
          <div className="review-loading saved-review-loading">
            <Loader2 className="spin" aria-hidden="true" />
            Loading saved review…
          </div>
        ) : (
          <>
            {!isSavedReviewMode && !embedded && (
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
            <div
              className={`job-entry-panel${isJobReferenceCollapsed ? " is-collapsed" : ""}`}
              ref={jobPanelRef}
            >
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
                  {reviewRunId && activeArtifact === "job-description" && (
                    <button
                      type="button"
                      className="mode-switch-button"
                      onClick={handleReviewBack}
                    >
                      <ArrowLeft aria-hidden="true" />
                      Back
                    </button>
                  )}
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
                    disabled={!hasJD || !activeResume || isOptimizing || isFetchingJD}
                    onClick={() => {
                      setActiveArtifact("cover-letter");
                      setIsCoverLetterPanelOpen(true);
                      setCoverLetterStatus("");
                      setCoverLetterError("");
                      requestAnimationFrame(() => {
                        coverLetterPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      });
                    }}
                  >
                    <Mail aria-hidden="true" />
                    Cover letter
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
                        {hasJD && !optimizedResume && jdSignals.keywords.length > 0 && (
                          <div className="jd-signal-row">
                            {jdSignals.role && (
                              <span className="jd-signal-role">{jdSignals.role}</span>
                            )}
                            {jdSignals.keywords.map((kw) => (
                              <span key={kw} className="jd-signal-chip">{kw}</span>
                            ))}
                          </div>
                        )}
                        <div className="job-editor-footer">
                          <span>{jobDescription.trim().length.toLocaleString()} chars</span>
                          {embedded ? (
                            <div className="workspace-resume-inline-wrap">
                              <button
                                type="button"
                                className="workspace-resume-inline"
                                disabled={sourceResumeOptions.length === 0}
                                onClick={() => setIsSwitcherOpen((open) => !open)}
                              >
                                <span className="resume-pill-dot" aria-hidden="true" />
                                <span>{activeResume?.name ?? (sourceResumeOptions.length > 0 ? "Select resume" : "No resumes added")}</span>
                                {sourceResumeOptions.length > 0 && <ChevronDown aria-hidden="true" />}
                              </button>
                              {isSwitcherOpen && sourceResumeOptions.length > 0 && (
                                <div className="workspace-resume-inline-menu">
                                  {sourceResumeOptions.map((resume) => (
                                    <button
                                      key={resume.id}
                                      type="button"
                                      className="workspace-resume-inline-option"
                                      onClick={() => {
                                        setActiveResume(resume.id);
                                        setIsSwitcherOpen(false);
                                      }}
                                    >
                                      {resume.id === activeResume?.id ? <CheckCircle2 aria-hidden="true" /> : null}
                                      <span>{resume.name}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span>
                              {activeResume ? `Tailoring against ${activeResume.name}` : "Select a resume above."}
                            </span>
                          )}
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
                            {hasJD && !optimizedResume && jdSignals.keywords.length > 0 && (
                              <div className="jd-signal-row">
                                {jdSignals.role && (
                                  <span className="jd-signal-role">{jdSignals.role}</span>
                                )}
                                {jdSignals.keywords.map((kw) => (
                                  <span key={kw} className="jd-signal-chip">{kw}</span>
                                ))}
                              </div>
                            )}
                            <div className="job-editor-footer">
                              <span>{jobDescription.trim().length.toLocaleString()} characters extracted</span>
                              {embedded ? (
                                <div className="workspace-resume-inline-wrap">
                                  <button
                                    type="button"
                                    className="workspace-resume-inline"
                                    disabled={sourceResumeOptions.length === 0}
                                    onClick={() => setIsSwitcherOpen((open) => !open)}
                                  >
                                    <span className="resume-pill-dot" aria-hidden="true" />
                                    <span>{activeResume?.name ?? (sourceResumeOptions.length > 0 ? "Select resume" : "No resumes added")}</span>
                                    {sourceResumeOptions.length > 0 && <ChevronDown aria-hidden="true" />}
                                  </button>
                                  {isSwitcherOpen && sourceResumeOptions.length > 0 && (
                                    <div className="workspace-resume-inline-menu">
                                      {sourceResumeOptions.map((resume) => (
                                        <button
                                          key={resume.id}
                                          type="button"
                                          className="workspace-resume-inline-option"
                                          onClick={() => {
                                            setActiveResume(resume.id);
                                            setIsSwitcherOpen(false);
                                          }}
                                        >
                                          {resume.id === activeResume?.id ? <CheckCircle2 aria-hidden="true" /> : null}
                                          <span>{resume.name}</span>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span>
                                  {activeResume ? `Tailoring against ${activeResume.name}` : "Select a resume above."}
                                </span>
                              )}
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

          {shouldShowCoverLetterPanel && (() => {
            const clSubtitle = optimizedResume
              ? "Generated from the tailored resume and target job."
              : "Generated from the selected resume and target job.";

            const clActions = (
              <>
                <button className="btn btn-primary btn-sm" type="button" disabled={!canGenerateCoverLetter} onClick={handleGenerateCoverLetter}>
                  {isGeneratingCoverLetter ? <Loader2 className="spin" aria-hidden="true" /> : <Mail aria-hidden="true" />}
                  {coverLetter ? "Regenerate" : "Generate"}
                </button>
                <button className="btn btn-secondary btn-sm" type="button" disabled={isSavingCoverLetter || !coverLetter.trim()} onClick={handleSaveCoverLetter}>
                  {isSavingCoverLetter ? <Loader2 className="spin" aria-hidden="true" /> : <FileText aria-hidden="true" />}
                  Save
                </button>
                <button className="btn btn-secondary btn-sm" type="button" disabled={!coverLetter.trim()} onClick={handleCopyCoverLetter}>
                  <ClipboardCopy aria-hidden="true" />
                  Copy
                </button>
              </>
            );

            const usePortal = Boolean(reviewToolbarHost && activeArtifact === "cover-letter");

            return (
              <>
                {usePortal && reviewToolbarHost && createPortal(
                  <div className="review-topbar">
                    <button className="btn btn-ghost btn-sm review-back-button" type="button" onClick={handleReviewBack}>
                      <ArrowLeft aria-hidden="true" />
                      Back
                    </button>
                    <div className="review-topbar-context">
                      <strong>Cover letter</strong>
                      <span>{clSubtitle}</span>
                    </div>
                    <div className="review-topbar-actions">{clActions}</div>
                  </div>,
                  reviewToolbarHost,
                )}

                <section className="job-cover-panel" aria-label="Cover letter" ref={coverLetterPanelRef}>
                  {!usePortal && (
                    <div className="cover-letter-header">
                      <div>
                        <p className="section-label">Cover letter</p>
                        <h3>{clSubtitle}</h3>
                      </div>
                      <div className="cover-letter-actions">
                        {reviewRunId && activeArtifact === "cover-letter" && (
                          <button className="btn btn-secondary" type="button" onClick={handleReviewBack}>
                            <ArrowLeft aria-hidden="true" />
                            Back
                          </button>
                        )}
                        {clActions}
                      </div>
                    </div>
                  )}

                  <textarea
                    className="cover-letter-textarea job-cover-textarea"
                    value={coverLetter}
                    disabled={isGeneratingCoverLetter}
                    onChange={(event) => setCoverLetter(event.target.value)}
                    placeholder="Write your cover letter here, or use Generate to draft one from the selected resume and job."
                    spellCheck
                  />

                  {coverLetterStatus && <p className="export-status-msg">{coverLetterStatus}</p>}
                  {coverLetterError && <div className="inline-error">{coverLetterError}</div>}
                </section>
              </>
            );
          })()}

          {optimizeError && <div className="inline-error">{optimizeError}</div>}
          {isLoadingSavedReview && (
            <div className="review-loading">
              <Loader2 className="spin" aria-hidden="true" />
              Loading saved review…
            </div>
          )}
            </section>

            {!optimizedResume && !reviewRunId && resumeVersions.length > 0 && (
              <section className="workspace-versions" aria-label="Tailored versions">
                <h3 className="workspace-versions-heading">Tailored versions</h3>
                <div className="workspace-versions-list">
                  {resumeVersions.map(({ resume, run }) => {
                    const applicationRunId = run?.id ?? resume.sourceRunId;
                    const isRenaming = renamingVersionId === resume.id;
                    const secondaryLabel =
                      run?.title && run.title !== resume.name
                        ? `${run.title} · ${formatRelativeDate(resume.uploadedAt)}`
                        : formatRelativeDate(resume.uploadedAt);

                    return (
                      <article
                        key={resume.id}
                        className={`workspace-version-item${isRenaming ? " is-renaming" : ""}`}
                        role={isRenaming ? undefined : "button"}
                        tabIndex={isRenaming ? undefined : 0}
                        onClick={(event) => {
                          if (isRenaming) return;
                          const target = event.target as HTMLElement;
                          if (target.closest("button,input,form")) return;
                          openTailoredVersion(applicationRunId, resume.id);
                        }}
                        onKeyDown={(event) => {
                          if (isRenaming) return;
                          const target = event.target as HTMLElement;
                          if (target.closest("button,input,form")) return;
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            openTailoredVersion(applicationRunId, resume.id);
                          }
                        }}
                      >
                        <div className="workspace-version-open">
                          <div className="workspace-version-meta">
                            {isRenaming ? (
                              <>
                                <form
                                  className="run-title-edit workspace-version-rename-form"
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    void handleRenameVersion(resume);
                                  }}
                                >
                                  <input
                                    className="run-title-input"
                                    value={renamingVersionName}
                                    autoFocus
                                    disabled={isRenamingVersion}
                                    onChange={(event) => setRenamingVersionName(event.target.value)}
                                    onKeyDown={(event) => {
                                      if (event.key === "Escape") cancelVersionRename();
                                    }}
                                    aria-label="Tailored version name"
                                  />
                                  <button
                                    type="button"
                                    className="run-title-edit-button"
                                    disabled={isRenamingVersion}
                                    onClick={() => void handleRenameVersion(resume)}
                                    aria-label={`Save ${resume.name} name`}
                                  >
                                    {isRenamingVersion ? <Loader2 className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                                  </button>
                                  <button
                                    type="button"
                                    className="run-title-edit-button cancel"
                                    disabled={isRenamingVersion}
                                    onClick={cancelVersionRename}
                                    aria-label="Cancel rename"
                                  >
                                    <X aria-hidden="true" />
                                  </button>
                                </form>
                                {versionRenameError && (
                                  <span className="workspace-version-error">{versionRenameError}</span>
                                )}
                              </>
                            ) : (
                              <>
                                <div className="run-title workspace-version-name-row">
                                  <button
                                    type="button"
                                    className="workspace-version-name-button"
                                    onClick={() => openTailoredVersion(applicationRunId, resume.id)}
                                  >
                                    <span className="run-title-label workspace-version-name">{resume.name}</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="run-title-action workspace-version-title-action"
                                    title="Rename version"
                                    onClick={() => startVersionRename(resume)}
                                    aria-label={`Rename ${resume.name}`}
                                  >
                                    <Pencil aria-hidden="true" />
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  className="workspace-version-date-button"
                                  onClick={() => openTailoredVersion(applicationRunId, resume.id)}
                                >
                                  <span className="workspace-version-date">{secondaryLabel}</span>
                                </button>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            className="workspace-version-end workspace-version-end-button"
                            onClick={() => openTailoredVersion(applicationRunId, resume.id)}
                            aria-label={`Open ${resume.name}`}
                          >
                            {run?.hasCoverLetter && (
                              <span className="workspace-version-badge">CL</span>
                            )}
                            {resume.matchScore != null && (
                              <span className="workspace-version-score">{resume.matchScore}%</span>
                            )}
                          </button>
                        </div>

                        <div className="workspace-version-actions" aria-label={`${resume.name} actions`}>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm btn-icon-only workspace-version-delete"
                            disabled={deletingVersionId === resume.id || isRenamingVersion}
                            onClick={() => {
                              setPendingDeleteVersion(resume);
                              setVersionDeleteError("");
                            }}
                            aria-label={`Delete ${resume.name}`}
                          >
                            {deletingVersionId === resume.id ? <Loader2 className="spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}

            {shouldShowResumeReview && optimizedResume && (
              <div ref={reviewPanelRef} className="review-panel-anchor">
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
              initialTemplateId={reviewTemplateId}
              onBack={handleReviewBack}
              topbarPortalTarget={reviewToolbarHost}
              title={reviewTitle || currentReviewRun?.title}
              matchScore={currentReviewRun?.score ?? null}
              isTemplatePanelOpen={isTemplatePanelOpen}
              onOpenTemplates={onOpenTemplates}
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
              onTemplateChange={
                currentRunId
                  ? async (templateId, resume) => {
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
              </div>
            )}
          </>
        )}
      </ContentTag>

      {pendingDeleteVersion && (
        <div
          className="confirm-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDeleteVersionDialog();
          }}
        >
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-version-title"
          >
            <div className="confirm-modal-header">
              <h2 id="delete-version-title">Delete tailored version?</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon-only"
                disabled={Boolean(deletingVersionId)}
                onClick={closeDeleteVersionDialog}
                aria-label="Close delete confirmation"
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <p>
              Delete “{pendingDeleteVersion.name}”. This removes the tailored resume version
              from the workspace.
            </p>
            {versionDeleteError && <div className="inline-error">{versionDeleteError}</div>}
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={Boolean(deletingVersionId)}
                onClick={closeDeleteVersionDialog}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                disabled={Boolean(deletingVersionId)}
                onClick={() => void handleDeleteVersion()}
              >
                {deletingVersionId ? <Loader2 className="spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                Delete
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  );
}
