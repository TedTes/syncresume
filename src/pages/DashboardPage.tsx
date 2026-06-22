import { Sparkles } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { extractJobTitle } from "../lib/jobTitle";
import type { RunRecord } from "../lib/storage";

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
  const { resumes, runs } = useAppData();
  const navigate = useNavigate();

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

  return (
    <>
      <header className="page-topbar">
        <span className="page-topbar-title">Dashboard</span>
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

        <p className="section-label">Tailored Resumes</p>
        {runs.length === 0 ? (
          <div className="empty-state">
            No runs yet. Tailor your first resume for a job to see match results here.
          </div>
        ) : (
          <div className="runs-list">
            {visibleRuns.map(({ run, displayTitle, duplicateCount, attemptNumber }) => {
              const canOpenReview = Boolean(run.hasReview);
              const isBestRun = bestRun?.run.id === run.id;

              return (
                <button
                  className="run-row"
                  key={run.id}
                  type="button"
                  disabled={!canOpenReview}
                  onClick={() => {
                    if (canOpenReview) navigate(`/workspace/review/${run.id}`);
                  }}
                  title={canOpenReview ? "Open saved review" : "Review unavailable for this run"}
                >
                  <div className="run-row-main">
                    <span className="run-title">
                      <span>{displayTitle}</span>
                      {duplicateCount > 1 && (
                        <span className="run-inline-pill">Attempt {attemptNumber}</span>
                      )}
                      {isBestRun && <span className="run-inline-pill best">Best</span>}
                    </span>
                    <span className="run-meta">
                      {formatDate(run.createdAt)}
                      {duplicateCount > 1 ? `, ${formatTime(run.createdAt)}` : ""} · {run.resumeName}
                      {!canOpenReview ? " · Review unavailable" : ""}
                    </span>
                  </div>
                  <div className="run-row-end">
                    <span className={`status-pill ${run.status}`}>{run.status}</span>
                    <span className={`score-pill ${scoreTierClass(run.score)}`}>{run.score}%</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </main>
    </>
  );
}
