import { useAppData } from "../context/AppDataContext";

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

export default function DashboardPage() {
  const { resumes, runs } = useAppData();

  const bestScore = runs.length > 0 ? Math.max(...runs.map((run) => run.score)) : 0;

  return (
    <>
      <header className="page-topbar">
        <span className="page-topbar-title">Dashboard</span>
      </header>

      <main className="page-content">
        <div className="stat-cards">
          <div className="stat-card">
            <p className="stat-card-label">Total runs</p>
            <p className="stat-card-value">{runs.length}</p>
          </div>
          <div className="stat-card">
            <p className="stat-card-label">Best match score</p>
            <p className="stat-card-value">{runs.length > 0 ? `${bestScore}%` : "—"}</p>
            {runs.length === 0 && (
              <p className="stat-card-hint">Run an optimization to see your score</p>
            )}
          </div>
          <div className="stat-card">
            <p className="stat-card-label">Resumes on file</p>
            <p className="stat-card-value">{resumes.length}</p>
          </div>
        </div>

        <p className="section-label">Recent runs</p>
        {runs.length === 0 ? (
          <div className="empty-state">
            No runs yet — head to the Workspace to run your first match.
          </div>
        ) : (
          <div className="runs-list">
            {runs.map((run) => (
              <div className="run-row" key={run.id}>
                <div className="run-row-main">
                  <span className="run-title">{run.title}</span>
                  <span className="run-meta">
                    {formatDate(run.createdAt)} · {run.resumeName}
                  </span>
                </div>
                <div className="run-row-end">
                  <span className={`status-pill ${run.status}`}>{run.status}</span>
                  <span className={`score-pill ${scoreTierClass(run.score)}`}>{run.score}%</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
