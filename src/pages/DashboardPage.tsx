import {
  Briefcase,
  Check,
  ChevronDown,
  ChevronRight,
  FileText,
  Loader2,
  Mail,
  Pencil,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent, type KeyboardEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { TopbarAccount } from "../components/TopbarAccount";
import { extractJobTitle } from "../lib/jobTitle";
import type { RunRecord } from "../lib/storage";

type ApplicationArtifact = "resume" | "cover-letter" | "job-description";
type DashboardLocationState = {
  expandedRunId?: string;
} | null;

function scoreTierClass(score: number): string {
  if (score >= 70) return "score-high";
  if (score >= 40) return "score-mid";
  return "score-low";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function runDateKey(iso: string): string {
  return new Date(iso).toISOString().slice(0, 10);
}

function isLowQualityRunTitle(title: string): boolean {
  const normalized = title.trim().toLowerCase();
  if (!normalized) return true;
  if (normalized === "untitled role") return true;
  if (normalized.startsWith("reports to")) return true;
  if (/^\d+\+?\s*(years?|yrs?)\b/.test(normalized)) return true;
  if (/^\d+\s*[-–]\s*\d+\s*(years?|yrs?)\b/.test(normalized)) return true;
  if (/\b(years?|yrs?)\s+of\s+experience\b/.test(normalized)) return true;
  if (/\bexperience\s+(in|with|required)\b/.test(normalized)) return true;
  return false;
}

function displayRunTitle(run: RunRecord): string {
  const derivedTitle = extractJobTitle(run.jobDescription);
  if (isLowQualityRunTitle(run.title)) return derivedTitle;
  return run.title;
}

export default function DashboardPage() {
  const { resumes, runs, getRun, updateRunTitle, deleteRun } = useAppData();
  const navigate = useNavigate();
  const location = useLocation();
  const [editingRunId, setEditingRunId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [savingTitleId, setSavingTitleId] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [loadingRunId, setLoadingRunId] = useState<string | null>(null);
  const [deletingRunId, setDeletingRunId] = useState<string | null>(null);
  const [pendingDeleteRun, setPendingDeleteRun] = useState<RunRecord | null>(null);
  const [runDetails, setRunDetails] = useState<Record<string, RunRecord>>({});
  const [detailsError, setDetailsError] = useState<Record<string, string>>({});

  const runItems = runs.map((run) => ({
    run,
    displayTitle: displayRunTitle(run),
  }));
  const duplicateTotals = runItems.reduce((groups, item) => {
    const key = `${item.displayTitle}|${runDateKey(item.run.createdAt)}|${item.run.resumeName}`;
    groups.set(key, (groups.get(key) ?? 0) + 1);
    return groups;
  }, new Map<string, number>());
  const duplicateSeen = new Map<string, number>();
  const visibleRuns = runItems.map((item) => {
    const key = `${item.displayTitle}|${runDateKey(item.run.createdAt)}|${item.run.resumeName}`;
    const seen = (duplicateSeen.get(key) ?? 0) + 1;
    duplicateSeen.set(key, seen);
    const duplicateCount = duplicateTotals.get(key) ?? 1;
    return {
      ...item,
      duplicateCount,
      attemptNumber: duplicateCount - seen + 1,
    };
  });
  const bestRun = visibleRuns.reduce<(typeof visibleRuns)[number] | null>((best, item) => {
    if (!best || item.run.score > best.run.score) return item;
    return best;
  }, null);
  const bestScore = bestRun?.run.score ?? 0;

  useEffect(() => {
    const state = location.state as DashboardLocationState;
    if (!state?.expandedRunId) return;

    const run = runs.find((item) => item.id === state.expandedRunId);
    if (!run) return;

    setExpandedRunId(run.id);
    void loadRunDetail(run).catch(() => undefined);
  }, [location.state, runs]);

  async function loadRunDetail(run: RunRecord): Promise<RunRecord> {
    if (runDetails[run.id]) return runDetails[run.id];

    setLoadingRunId(run.id);
    setDetailsError((current) => {
      const next = { ...current };
      delete next[run.id];
      return next;
    });

    try {
      const detail = await getRun(run.id);
      setRunDetails((current) => ({ ...current, [run.id]: detail }));
      return detail;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not load this application.";
      setDetailsError((current) => ({
        ...current,
        [run.id]: message,
      }));
      throw new Error(message);
    } finally {
      setLoadingRunId(null);
    }
  }

  async function toggleApplicationBundle(run: RunRecord) {
    if (editingRunId === run.id) return;

    if (expandedRunId === run.id) {
      setExpandedRunId(null);
      return;
    }

    setExpandedRunId(run.id);
    void loadRunDetail(run).catch(() => undefined);
  }

  async function openArtifact(run: RunRecord, type: ApplicationArtifact) {
    if (!run.hasReview) {
      setDetailsError((current) => ({
        ...current,
        [run.id]: "This application does not have a saved review yet.",
      }));
      return;
    }

    navigate(`/applications/${run.id}?artifact=${type}`, {
      state: {
        returnTo: "/dashboard",
        expandedRunId: run.id,
      },
    });
  }

  function handleApplicationKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    run: RunRecord,
  ) {
    const target = event.target as HTMLElement;
    if (target.closest("button,input,form")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void toggleApplicationBundle(run);
    }
  }

  function startRename(run: RunRecord, title: string) {
    setEditingRunId(run.id);
    setDraftTitle(title);
    setRenameError(null);
  }

  function cancelRename() {
    setEditingRunId(null);
    setDraftTitle("");
    setRenameError(null);
  }

  async function submitRename(event: FormEvent<HTMLFormElement>, run: RunRecord) {
    event.preventDefault();
    const nextTitle = draftTitle.trim();
    if (nextTitle.length < 3) {
      setRenameError("Use at least 3 characters.");
      return;
    }

    setSavingTitleId(run.id);
    setRenameError(null);
    try {
      const renamed = await updateRunTitle(run.id, nextTitle);
      setRunDetails((current) => {
        if (!current[run.id]) return current;
        return { ...current, [run.id]: { ...current[run.id], title: renamed.title } };
      });
      cancelRename();
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "Could not rename this run.");
    } finally {
      setSavingTitleId(null);
    }
  }

  async function handleDeleteApplication(run: RunRecord) {
    setDeletingRunId(run.id);
    setDetailsError((current) => {
      const next = { ...current };
      delete next[run.id];
      return next;
    });

    try {
      await deleteRun(run.id);
      setPendingDeleteRun(null);
      setExpandedRunId((current) => (current === run.id ? null : current));
      setRunDetails((current) => {
        const next = { ...current };
        delete next[run.id];
        return next;
      });
    } catch (error) {
      setDetailsError((current) => ({
        ...current,
        [run.id]: error instanceof Error ? error.message : "Could not delete this application.",
      }));
    } finally {
      setDeletingRunId(null);
    }
  }

  return (
    <>
      <header className="page-topbar">
        <span className="page-topbar-title">Dashboard</span>
        <TopbarAccount />
      </header>

      <main className="page-content">
        <section className="dashboard-command-row" aria-label="Dashboard actions">
          <div>
            <p className="section-label">Resume tailoring</p>
            <h1>Start with a job, compare the result, then save the version that works.</h1>
          </div>
          <Link className="btn btn-primary btn-sm dashboard-primary-cta" to="/workspace/optimize">
            <Sparkles aria-hidden="true" />
            Tailor for a new job
          </Link>
        </section>

        <div className="stat-cards">
          <div className="stat-card">
            <p className="stat-card-label">Total runs</p>
            <p className="stat-card-value">{runs.length}</p>
          </div>
          <div className="stat-card">
            <p className="stat-card-label">Best match score</p>
            <p className="stat-card-value">{runs.length > 0 ? `${bestScore}%` : "—"}</p>
            {bestRun ? (
              <p className="stat-card-hint">Best visible run: {bestRun.displayTitle}</p>
            ) : (
              <p className="stat-card-hint">Run an optimization to see your score</p>
            )}
          </div>
          <div className="stat-card">
            <p className="stat-card-label">Resumes on file</p>
            <p className="stat-card-value">{resumes.length}</p>
          </div>
        </div>

        <p className="section-label">TAILORED APPLICATIONS</p>
        {runs.length === 0 ? (
          <div className="empty-state">
            No tailored applications yet. Start with a job to save the resume, job description, and cover letter bundle here.
          </div>
        ) : (
          <div className="runs-list">
            {visibleRuns.map(({ run, displayTitle, duplicateCount, attemptNumber }) => {
              const isBestRun = bestRun?.run.id === run.id;
              const isExpanded = expandedRunId === run.id;
              const details = runDetails[run.id] ?? run;
              const isLoadingDetails = loadingRunId === run.id;
              const detailError = detailsError[run.id];
              const coverLetterText = details.coverLetterText?.trim() ?? "";
              const applicationArtifacts = [
                {
                  id: "resume" as const,
                  icon: FileText,
                  title: "Resume",
                  meta: details.resumeName || run.resumeName,
                  isAvailable: Boolean(run.hasReview),
                  action: run.hasReview ? "Review" : "Empty",
                },
                {
                  id: "cover-letter" as const,
                  icon: Mail,
                  title: "Cover letter",
                  meta: isLoadingDetails
                    ? "Loading..."
                    : coverLetterText
                      ? "Saved cover letter"
                      : "Not generated yet",
                  isAvailable: Boolean(coverLetterText || details.hasCoverLetter),
                  action: coverLetterText || details.hasCoverLetter ? "View" : "Empty",
                },
                {
                  id: "job-description" as const,
                  icon: Briefcase,
                  title: "Job description",
                  meta: `${(details.jobDescription || run.jobDescription).length.toLocaleString()} chars`,
                  isAvailable: true,
                  action: "View",
                },
              ];

              return (
                <article className={`application-card ${isExpanded ? "is-open" : ""}`} key={run.id}>
                  <div
                    aria-controls={`application-bundle-${run.id}`}
                    aria-expanded={isExpanded}
                    className="application-card-header"
                    role="button"
                    tabIndex={0}
                    onClick={(event) => {
                      const target = event.target as HTMLElement;
                      if (target.closest("button,input,form")) return;
                      void toggleApplicationBundle(run);
                    }}
                    onKeyDown={(event) => handleApplicationKeyDown(event, run)}
                    title={isExpanded ? "Collapse application bundle" : "Expand application bundle"}
                  >
                    <div className="run-row-main">
                      <div className="run-title">
                        {editingRunId === run.id ? (
                          <form className="run-title-edit" onSubmit={(event) => submitRename(event, run)}>
                            <input
                              aria-label="Application name"
                              className="run-title-input"
                              disabled={savingTitleId === run.id}
                              value={draftTitle}
                              onChange={(event) => setDraftTitle(event.target.value)}
                              autoFocus
                            />
                            <button
                              aria-label="Save role name"
                              className="run-title-edit-button"
                              disabled={savingTitleId === run.id}
                              type="submit"
                            >
                              <Check aria-hidden="true" />
                            </button>
                            <button
                              aria-label="Cancel rename"
                              className="run-title-edit-button cancel"
                              disabled={savingTitleId === run.id}
                              type="button"
                              onClick={cancelRename}
                            >
                              <X aria-hidden="true" />
                            </button>
                          </form>
                        ) : (
                          <>
                            <span className="run-title-label">{displayTitle}</span>
                            <button
                              aria-label={`Rename application ${displayTitle}`}
                              className="run-title-action"
                              title="Rename application"
                              type="button"
                              onClick={() => startRename(run, displayTitle)}
                            >
                              <Pencil aria-hidden="true" />
                            </button>
                          </>
                        )}
                        {duplicateCount > 1 && (
                          <span className="run-inline-pill">Attempt {attemptNumber}</span>
                        )}
                        {isBestRun && <span className="run-inline-pill best">Best</span>}
                      </div>
                      {editingRunId === run.id && renameError ? (
                        <span className="run-rename-error">{renameError}</span>
                      ) : null}
                      <span className="run-meta">
                        {formatDate(run.createdAt)}
                        {duplicateCount > 1 ? `, ${formatTime(run.createdAt)}` : ""} · {run.resumeName}
                      </span>
                    </div>
                    <div className="run-row-end">
                      <span className={`status-pill ${run.status}`}>{run.status}</span>
                      <span className={`score-pill ${scoreTierClass(run.score)}`}>{run.score}%</span>
                      <button
                        type="button"
                        className="application-delete-button"
                        aria-label={`Delete application ${displayTitle}`}
                        title="Delete application"
                        disabled={deletingRunId === run.id}
                        onClick={(event) => {
                          event.stopPropagation();
                          setPendingDeleteRun(run);
                        }}
                      >
                        {deletingRunId === run.id ? (
                          <Loader2 className="spin" aria-hidden="true" />
                        ) : (
                          <X aria-hidden="true" />
                        )}
                      </button>
                      <ChevronDown className="application-card-chevron" aria-hidden="true" />
                    </div>
                  </div>

                  <div
                    className="application-card-body-collapse"
                    id={`application-bundle-${run.id}`}
                    aria-hidden={!isExpanded}
                  >
                    <div className="application-card-body-inner">
                      <div className="application-card-body">
                        {detailError ? <div className="inline-error">{detailError}</div> : null}
                        <div className="application-artifact-list" aria-label="Application files">
                          {applicationArtifacts.map((artifact) => {
                            const Icon = artifact.icon;

                            return (
                              <button
                                className="application-artifact-item"
                                key={artifact.id}
                                type="button"
                                tabIndex={isExpanded ? 0 : -1}
                                onClick={() => void openArtifact(run, artifact.id)}
                              >
                                <span className="application-artifact-item-icon">
                                  <Icon aria-hidden="true" />
                                </span>
                                <span className="application-artifact-item-copy">
                                  <span>{artifact.title}</span>
                                  <small>{artifact.meta}</small>
                                </span>
                                <span
                                  className={`application-artifact-state ${
                                    artifact.isAvailable ? "is-ready" : ""
                                  }`}
                                >
                                  {artifact.action}
                                </span>
                                <ChevronRight className="application-artifact-chevron" aria-hidden="true" />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
      {pendingDeleteRun && (
        <div
          className="confirm-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingRunId) {
              setPendingDeleteRun(null);
            }
          }}
        >
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-application-title"
            aria-describedby="delete-application-copy"
          >
            <div className="confirm-modal-header">
              <h2 id="delete-application-title">Delete application?</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon-only"
                aria-label="Close delete confirmation"
                disabled={Boolean(deletingRunId)}
                onClick={() => setPendingDeleteRun(null)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <p id="delete-application-copy">
              This will remove {displayRunTitle(pendingDeleteRun)} and its saved resume, cover letter, and job description bundle.
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={Boolean(deletingRunId)}
                onClick={() => setPendingDeleteRun(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm btn-danger"
                disabled={Boolean(deletingRunId)}
                onClick={() => void handleDeleteApplication(pendingDeleteRun)}
              >
                {deletingRunId ? <Loader2 className="spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
