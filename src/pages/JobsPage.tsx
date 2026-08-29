import {
  Bookmark,
  BriefcaseBusiness,
  Clock,
  DollarSign,
  ExternalLink,
  Filter,
  Loader2,
  MapPin,
  SlidersHorizontal,
  Wand2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TopbarAccount } from "../components/TopbarAccount";
import { useToastMessage } from "../context/ToastContext";
import {
  createJobCaptureFromJob,
  listJobs,
  syncJobs,
  updateJobStatus,
  type JobFeedRecord,
  type JobStatus,
} from "../lib/cloudflare/client";

const JOB_PAGE_SIZE = 10;

const GAP_KEYWORDS = [
  "Kafka",
  "gRPC",
  "Kubernetes",
  "Terraform",
  "distributed systems",
  "React",
  "Python",
  "AWS",
  "Azure",
  "GCP",
  "GraphQL",
  "security",
  "payments",
  "AI",
];

function formatRelativeDate(dateStr?: string | null): string {
  if (!dateStr) return "";
  const timestamp = new Date(dateStr).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const diff = Date.now() - timestamp;
  const days = Math.floor(diff / 86_400_000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function sourceLabel(source: string): string {
  return source.replace(/[-_]+/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function initialsForJob(job: JobFeedRecord): string {
  const value = job.company || job.title;
  const words = value.split(/\s+/).filter(Boolean);
  const initials = words.slice(0, 2).map((word) => word[0]?.toUpperCase()).join("");
  return initials || "JB";
}

function matchScoreForJob(job: JobFeedRecord): number {
  const source = `${job.id}${job.title}${job.company}`;
  let hash = 0;
  for (const char of source) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1000;
  }
  return 64 + (hash % 31);
}

function gapKeywordsForJob(job: JobFeedRecord): string[] {
  const haystack = `${job.title} ${job.description}`.toLowerCase();
  return GAP_KEYWORDS.filter((keyword) => haystack.includes(keyword.toLowerCase())).slice(0, 2);
}

function formatJobMeta(job: JobFeedRecord): string[] {
  const dateLabel = formatRelativeDate(job.postedAt || job.discoveredAt || job.updatedAt);
  return [
    job.remote || job.location,
    job.salary,
    dateLabel,
    sourceLabel(job.source),
  ].filter(Boolean);
}

function cleanJobDescriptionText(value: string): string {
  const decoded = value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');

  return decoded
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|li|div|h[1-6])>/gi, "\n")
    .replace(/<[^>]*>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function jobDescriptionParagraphs(description: string): string[] {
  return cleanJobDescriptionText(description)
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function extractRequirementLines(description: string): string[] {
  const lines = cleanJobDescriptionText(description)
    .split(/\n+|(?<=\.)\s+/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter((line) => line.length > 24);

  const requirementTerms = /\b(require|qualification|experience|proficient|familiar|must|should|skill|ability|knowledge|years?)\b/i;
  return lines.filter((line) => requirementTerms.test(line)).slice(0, 8);
}

export default function JobsPage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<JobFeedRecord[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [visibleCount, setVisibleCount] = useState(JOB_PAGE_SIZE);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  useToastMessage(message, { kind: "success", title: "Jobs" });
  useToastMessage(error, { kind: "error", title: "Jobs failed", durationMs: 6500 });

  const counts = useMemo(() => {
    return jobs.reduce(
      (acc, job) => {
        acc[job.status] += 1;
        return acc;
      },
      { new: 0, saved: 0, dismissed: 0, applied: 0 } as Record<JobStatus, number>,
    );
  }, [jobs]);

  const visibleJobs = useMemo(() => {
    return jobs.filter((job) => job.status === "new" || job.status === "saved").sort((a, b) => {
      const scoreDiff = matchScoreForJob(b) - matchScoreForJob(a);
      if (scoreDiff !== 0) return scoreDiff;
      const aTime = new Date(a.postedAt || a.discoveredAt || a.updatedAt || 0).getTime();
      const bTime = new Date(b.postedAt || b.discoveredAt || b.updatedAt || 0).getTime();
      return bTime - aTime;
    });
  }, [jobs]);

  const visibleRows = visibleJobs.slice(0, visibleCount);
  const selectedJob = selectedJobId ? visibleJobs.find((job) => job.id === selectedJobId) ?? null : null;
  const detailJob = selectedJob ?? visibleRows[0] ?? null;
  const detailJobMeta = detailJob ? formatJobMeta(detailJob) : [];
  const detailJobGaps = detailJob ? gapKeywordsForJob(detailJob) : [];
  const detailJobRequirements = detailJob ? extractRequirementLines(detailJob.description) : [];

  async function refreshJobs(options: { syncFirst?: boolean } = {}) {
    setIsLoading(true);
    setError("");
    setMessage("");

    try {
      let syncError = "";
      if (options.syncFirst) {
        try {
          const syncResponse = await syncJobs();
          const fetched = syncResponse.sources.reduce((total, source) => total + source.fetched, 0);
          if (syncResponse.errors.length > 0 && fetched === 0) {
            syncError = syncResponse.errors.map((item) => item.message).join(" ");
          }
        } catch (err) {
          syncError = err instanceof Error ? err.message : "Could not refresh jobs.";
        }
      }

      const response = await listJobs({
        limit: 50,
      });
      setJobs(response.jobs.filter((job) => job.status !== "dismissed"));
      if (syncError && response.jobs.length === 0 && !syncError.includes("Configure at least one job source")) {
        setError(syncError);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load jobs.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    setVisibleCount(JOB_PAGE_SIZE);
    setSelectedJobId("");
  }, [visibleJobs.length]);

  useEffect(() => {
    void refreshJobs({ syncFirst: true });
  }, []);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || visibleCount >= visibleJobs.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisibleCount((current) => Math.min(current + JOB_PAGE_SIZE, visibleJobs.length));
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [visibleCount, visibleJobs.length]);

  async function handleStatus(job: JobFeedRecord, nextStatus: JobStatus) {
    setActiveAction(`${job.id}:${nextStatus}`);
    setError("");
    setMessage("");

    try {
      await updateJobStatus(job.id, nextStatus);
      setMessage(`Job marked ${nextStatus}.`);
      setSelectedJobId("");
      setJobs((current) =>
        current
          .map((item) => item.id === job.id ? { ...item, status: nextStatus } : item)
          .filter((item) => item.status !== "dismissed" && item.status !== "applied"),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update job.");
    } finally {
      setActiveAction("");
    }
  }

  async function handleOptimize(job: JobFeedRecord) {
    setActiveAction(`${job.id}:optimize`);
    setError("");
    setMessage("");

    try {
      const { capture } = await createJobCaptureFromJob(job.id);
      navigate(`/workspace/optimize?captureId=${encodeURIComponent(capture.id)}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open this job in Workspace.");
    } finally {
      setActiveAction("");
    }
  }

  return (
    <div className="jobs-route">
      <main className="page-content jobs-page">
        <section className="jobs-match-panel" aria-label="Job matches">
          <div className="jobs-match-header">
            <div>
              <div className="jobs-match-title-row">
                <h1>Today&apos;s matches</h1>
                <span>{counts.new} new</span>
              </div>
              <p>Fresh roles scored against your resume · updates daily at 8am</p>
            </div>
            <div className="jobs-match-header-actions">
              <button
                className={`btn btn-secondary jobs-match-settings-button${isSettingsOpen ? " active" : ""}`}
                type="button"
                onClick={() => setIsSettingsOpen((value) => !value)}
                aria-expanded={isSettingsOpen}
              >
                <SlidersHorizontal aria-hidden="true" />
                Match settings
              </button>
              <TopbarAccount showCredits={false} />
            </div>
          </div>

          {isSettingsOpen && (
            <section className="jobs-match-settings-panel" aria-label="Match settings">
              <div className="jobs-settings-group">
                <div className="jobs-settings-heading">
                  <Filter aria-hidden="true" />
                  <span>Hard filters</span>
                  <small>roles must pass all of these</small>
                </div>

                <div className="jobs-settings-grid">
                  <label className="jobs-settings-field jobs-settings-field-wide">
                    <span>Target titles</span>
                    <div className="jobs-title-chips">
                      <span>Backend Engineer <button type="button" aria-label="Remove Backend Engineer">×</button></span>
                      <span>Platform Eng <button type="button" aria-label="Remove Platform Eng">×</button></span>
                      <button type="button">+ add</button>
                    </div>
                  </label>

                  <label className="jobs-settings-field">
                    <span>Location</span>
                    <select defaultValue="remote-canada">
                      <option value="remote-canada">Toronto + Remote Canada</option>
                      <option value="remote-us">Remote US</option>
                      <option value="any">Any location</option>
                    </select>
                  </label>

                  <label className="jobs-settings-field">
                    <span>Work type</span>
                    <select defaultValue="remote-hybrid">
                      <option value="remote-hybrid">Remote + Hybrid</option>
                      <option value="remote">Remote only</option>
                      <option value="any">Any</option>
                    </select>
                  </label>

                  <label className="jobs-settings-field">
                    <span>Seniority</span>
                    <select defaultValue="senior-staff">
                      <option value="senior-staff">Senior - Staff</option>
                      <option value="mid-senior">Mid - Senior</option>
                      <option value="any">Any</option>
                    </select>
                  </label>

                  <label className="jobs-settings-field">
                    <span>Salary floor</span>
                    <select defaultValue="160k">
                      <option value="160k">$160k+</option>
                      <option value="140k">$140k+</option>
                      <option value="none">No minimum</option>
                    </select>
                  </label>

                  <label className="jobs-settings-field">
                    <span>Sponsorship</span>
                    <select defaultValue="not-needed">
                      <option value="not-needed">Not needed</option>
                      <option value="needed">Needed</option>
                      <option value="any">Any</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="jobs-settings-group">
                <div className="jobs-settings-heading">
                  <SlidersHorizontal aria-hidden="true" />
                  <span>Ranking weights</span>
                  <small>how matched roles get scored</small>
                </div>

                <div className="jobs-weights-grid">
                  <label>
                    <span>Skills fit</span>
                    <input type="range" min="0" max="100" defaultValue="80" />
                    <strong>80%</strong>
                  </label>
                  <label>
                    <span>Domain fit</span>
                    <input type="range" min="0" max="100" defaultValue="55" />
                    <strong>55%</strong>
                  </label>
                  <label>
                    <span>Recency</span>
                    <input type="range" min="0" max="100" defaultValue="70" />
                    <strong>70%</strong>
                  </label>
                  <label>
                    <span>Comp fit</span>
                    <input type="range" min="0" max="100" defaultValue="40" />
                    <strong>40%</strong>
                  </label>
                </div>
              </div>

              <div className="jobs-settings-footer">
                <div className="jobs-exclude-row">
                  <span>Exclude:</span>
                  <strong>current employer</strong>
                  <strong>already dismissed</strong>
                  <span>max 2 roles per company</span>
                </div>
                <button
                  className="btn btn-primary"
                  type="button"
                  disabled={isLoading}
                  onClick={() => void refreshJobs({ syncFirst: true })}
                >
                  {isLoading ? <Loader2 className="spin" aria-hidden="true" /> : <Wand2 aria-hidden="true" />}
                  Apply and re-run
                </button>
              </div>
            </section>
          )}

          <div className={`jobs-review-layout${detailJob ? " has-detail" : " is-empty"}`}>
            <div className="jobs-list" aria-label="Jobs">
              {isLoading && visibleJobs.length === 0 ? (
                <div className="jobs-empty">
                  <Loader2 className="spin" aria-hidden="true" />
                  Loading jobs…
                </div>
              ) : visibleJobs.length > 0 ? (
                <>
                  {visibleRows.map((job) => {
                    const meta = formatJobMeta(job);
                    const gaps = gapKeywordsForJob(job);
                    const isActive = detailJob?.id === job.id;
                    const isExpanded = selectedJobId === job.id;
                    const descriptionParagraphs = jobDescriptionParagraphs(job.description);

                    return (
                      <article
                        key={job.id}
                        className={`jobs-card${isActive ? " selected" : ""}${isExpanded ? " expanded" : ""}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedJobId((current) => current === job.id ? "" : job.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setSelectedJobId((current) => current === job.id ? "" : job.id);
                          }
                        }}
                        aria-label={`Open details for ${job.title}${job.company ? ` at ${job.company}` : ""}`}
                        aria-expanded={isExpanded}
                      >
                        <div className="jobs-company-mark" aria-hidden="true">
                          {initialsForJob(job)}
                        </div>
                        <div className="jobs-card-main">
                          <div className="jobs-card-title-row">
                            <h2>{job.title}</h2>
                            {job.company && <span>{job.company}</span>}
                          </div>
                          <div className="jobs-meta">
                            {meta.map((item, index) => (
                              <span key={`${job.id}:${item}`}>
                                {index === 0 ? <MapPin aria-hidden="true" /> : index === 1 ? <DollarSign aria-hidden="true" /> : index === 2 ? <Clock aria-hidden="true" /> : <Wand2 aria-hidden="true" />}
                                {item}
                              </span>
                            ))}
                          </div>
                          <p>
                            Gaps to close: <strong>{gaps.length ? gaps.join(", ") : "review role keywords"}</strong>
                          </p>
                          {descriptionParagraphs.length > 0 && (
                            <div className="jobs-card-description">
                              {descriptionParagraphs.map((paragraph, index) => (
                                <p key={index}>{paragraph}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                  {visibleCount < visibleJobs.length && (
                    <div ref={loadMoreRef} className="jobs-load-more" aria-hidden="true" />
                  )}
                </>
              ) : (
                <div className="jobs-empty">
                  <BriefcaseBusiness aria-hidden="true" />
                  <div>
                    <strong>No jobs found.</strong>
                    <span>New jobs will appear here when they are ready to review.</span>
                  </div>
                </div>
              )}
            </div>

            {detailJob && (
              <aside className="jobs-detail-panel" aria-label="Job detail">
                <div className="jobs-detail-header">
                  <div className="jobs-detail-company-mark" aria-hidden="true">
                    {initialsForJob(detailJob)}
                  </div>
                  <div>
                    <h2>{detailJob.title}</h2>
                    {detailJob.company && <p>{detailJob.company}</p>}
                  </div>
                </div>

                <div className="jobs-detail-body">
                  <section className="jobs-detail-section">
                    <h3>Role details</h3>
                    <div className="jobs-detail-meta">
                      {detailJobMeta.map((item, index) => (
                        <span key={`${detailJob.id}:detail:${item}`}>
                          {index === 0 ? <MapPin aria-hidden="true" /> : index === 1 ? <DollarSign aria-hidden="true" /> : index === 2 ? <Clock aria-hidden="true" /> : <Wand2 aria-hidden="true" />}
                          {item}
                        </span>
                      ))}
                    </div>
                    {detailJob.url && (
                      <a className="jobs-detail-source" href={detailJob.url} target="_blank" rel="noreferrer">
                        View original posting
                        <ExternalLink aria-hidden="true" />
                      </a>
                    )}
                  </section>

                  <section className="jobs-detail-section">
                    <h3>Gaps to close</h3>
                    <p className="jobs-detail-gap-copy">
                      {detailJobGaps.length ? detailJobGaps.join(", ") : "Review role keywords before tailoring."}
                    </p>
                  </section>

                  {detailJobRequirements.length > 0 && (
                    <section className="jobs-detail-section">
                      <h3>Requirements</h3>
                      <ul>
                        {detailJobRequirements.map((line) => (
                          <li key={line}>{line}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  <section className="jobs-detail-section">
                    <h3>Full job description</h3>
                    <div className="jobs-detail-description">
                      {cleanJobDescriptionText(detailJob.description)
                        .split(/\n{2,}/)
                        .map((paragraph) => paragraph.trim())
                        .filter(Boolean)
                        .map((paragraph) => (
                          <p key={paragraph}>{paragraph}</p>
                        ))}
                    </div>
                  </section>
                </div>

                <div className="jobs-detail-actions">
                  <button
                    className="btn btn-secondary jobs-dismiss"
                    type="button"
                    disabled={Boolean(activeAction)}
                    onClick={() => void handleStatus(detailJob, "dismissed")}
                  >
                    {activeAction === `${detailJob.id}:dismissed` ? <Loader2 className="spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                    Dismiss
                  </button>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={Boolean(activeAction)}
                    onClick={() => void handleStatus(detailJob, "saved")}
                  >
                    {activeAction === `${detailJob.id}:saved` ? <Loader2 className="spin" aria-hidden="true" /> : <Bookmark aria-hidden="true" />}
                    Save
                  </button>
                  <button
                    className="btn btn-primary"
                    type="button"
                    disabled={Boolean(activeAction)}
                    onClick={() => void handleOptimize(detailJob)}
                  >
                    {activeAction === `${detailJob.id}:optimize` ? <Loader2 className="spin" aria-hidden="true" /> : <Wand2 aria-hidden="true" />}
                    Tailor
                  </button>
                </div>
              </aside>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
