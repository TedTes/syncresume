import {
  ArrowRight,
  BriefcaseBusiness,
  FileCheck,
  FileText,
  Mail,
  Package,
  Wand2,
} from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { ResumeTemplateThumbnail } from "../components/ResumeTemplateThumbnail";
import { RESUME_TEMPLATES } from "../templates/registry";

const SHOWCASE_TEMPLATE_IDS = [
  "classic",
  "modern",
  "leadership",
  "executive",
  "metro",
  "product",
  "retro",
  "outline",
] as const;

const STEPS = [
  {
    num: "01",
    label: "Upload your resume",
    desc: "Import your existing resume. We parse the structure and keep your content intact.",
  },
  {
    num: "02",
    label: "Paste the job posting",
    desc: "Drop in any job description. We extract the requirements and keywords automatically.",
  },
  {
    num: "03",
    label: "Review the changes",
    desc: "Compare original and tailored versions side by side. Accept or refine any edits.",
  },
  {
    num: "04",
    label: "Export and apply",
    desc: "Download as PDF or DOCX. Your resume, cover letter, and job description are saved as a bundle.",
  },
];

const FEATURES = [
  {
    icon: FileCheck,
    label: "ATS-safe templates",
    desc: "Clean layouts built to parse correctly through applicant tracking systems — no tables, no text boxes.",
    wide: true,
  },
  {
    icon: Wand2,
    label: "Job-specific tailoring",
    desc: "Rewrites bullets and skills sections to match the language and priorities of each role.",
    wide: false,
  },
  {
    icon: Mail,
    label: "Cover letter included",
    desc: "Generates a targeted cover letter alongside every tailored resume — not a generic template.",
    wide: false,
  },
  {
    icon: Package,
    label: "Application bundles",
    desc: "Every run saves a complete package: tailored resume, cover letter, and the job description used to create it.",
    wide: true,
  },
];

function useLoopingScore() {
  const [score, setScore] = useState(42);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setScore(84);
      return;
    }

    let frameId = 0;
    const cycleMs = 5800;
    const climbStartMs = 1550;
    const climbDurationMs = 1650;
    const startedAt = performance.now();

    function tick(now: number) {
      const elapsed = (now - startedAt) % cycleMs;
      const rawProgress = Math.min(1, Math.max(0, (elapsed - climbStartMs) / climbDurationMs));
      const eased = 1 - Math.pow(1 - rawProgress, 3);
      setScore(Math.round(42 + (84 - 42) * eased));
      frameId = requestAnimationFrame(tick);
    }

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return score;
}

export default function LandingPage() {
  const score = useLoopingScore();
  const scoreStyle = { "--landing-score": `${score}%` } as CSSProperties;
  const [workflowVisible, setWorkflowVisible] = useState(false);
  const [exampleVisible, setExampleVisible] = useState(false);
  const workflowRef = useRef<HTMLDivElement | null>(null);
  const exampleRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setWorkflowVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          setWorkflowVisible(true);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.32 },
    );

    if (workflowRef.current) observer.observe(workflowRef.current);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setExampleVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          setExampleVisible(true);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.2 },
    );

    if (exampleRef.current) observer.observe(exampleRef.current);

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="landing-brand-mark" aria-hidden="true">
              <svg viewBox="0 0 18 22" fill="none" aria-hidden="true">
                  <rect x="2.5" y="1" width="14" height="18.5" rx="2.2" stroke="rgba(255,255,255,0.18)" strokeWidth="1.1" transform="rotate(7 9.5 10.25)" />
                  <path d="M1.5 3C1.5 2.17 2.17 1.5 3 1.5H11.5L16.5 6.5V19C16.5 19.83 15.83 20.5 15 20.5H3C2.17 20.5 1.5 19.83 1.5 19V3Z" fill="rgba(34,197,94,0.07)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
                  <path d="M11.5 1.5L16.5 6.5H13C12.17 6.5 11.5 5.83 11.5 5V1.5Z" fill="#22c55e" />
                  <rect x="4" y="9.5" width="9" height="1.5" rx="0.75" fill="rgba(255,255,255,0.55)" />
                  <rect x="4" y="12.5" width="5.5" height="1.4" rx="0.7" fill="#22c55e" opacity="0.85" />
                  <rect x="4" y="15.5" width="7" height="1.2" rx="0.6" fill="rgba(255,255,255,0.22)" />
                </svg>
            </div>
            <span className="landing-brand-name">SyncResume</span>
          </div>
          <nav className="landing-nav-links" aria-label="Landing page">
            <a href="#how-it-works">How it works</a>
            <a href="#templates">Templates</a>
          </nav>
          <Link className="btn btn-primary btn-sm" to="/workspace/optimize">
            Start tailoring free
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-container">
          <div className="landing-hero-content">
            <div className="landing-hero-text">
              <h1 className="landing-hero-headline">
                Tailor every resume<br />to the job.
              </h1>
              <p className="landing-hero-sub">
                Paste a job description and get a tailored resume that speaks the job's language — keywords matched, bullets rewritten, score lifted.
              </p>
              <div className="landing-hero-actions">
                <Link className="btn btn-primary" to="/workspace/optimize">
                  Start tailoring free
                  <ArrowRight aria-hidden="true" />
                </Link>
                <a className="landing-text-link" href="#templates">
                  View templates
                </a>
              </div>
            </div>

            <div className="landing-peel-demo" aria-hidden="true">
              <div className="landing-peel-label">
                <span />
                Tailored reveal
              </div>
              <div className="landing-peel-deck">
                <div className="landing-peel-card landing-peel-card-depth" />
                <div className="landing-peel-card landing-peel-card-tailored">
                  <div className="landing-peel-card-header">
                    <div>
                      <span>Tailored resume</span>
                      <strong>Senior Backend Engineer</strong>
                    </div>
                    <div className="landing-peel-score" style={scoreStyle}>
                      <strong>{score}%</strong>
                    </div>
                  </div>
                  <div className="landing-peel-lines">
                    <p>
                      Senior backend engineer delivering <mark>scalable distributed systems</mark>,{" "}
                      <mark>Kafka-based workflows</mark>, and <mark>real-time data pipelines</mark>.
                    </p>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="landing-peel-chips">
                    <span>Kafka</span>
                    <span>distributed systems</span>
                    <span>CI/CD</span>
                    <span>real-time pipelines</span>
                    <span>backend</span>
                  </div>
                </div>
                <div className="landing-peel-card landing-peel-card-generic">
                  <div className="landing-peel-card-header">
                    <div>
                      <span>Generic resume</span>
                      <strong>Software Engineer</strong>
                    </div>
                    <div className="landing-peel-score landing-peel-score-before">
                      <strong>42%</strong>
                    </div>
                  </div>
                  <div className="landing-peel-lines">
                    <p>
                      Senior full-stack software engineer with 8+ years building production applications and improving
                      internal tools.
                    </p>
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="landing-peel-note">Peels away to reveal the tailored version underneath.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt" id="how-it-works">
        <div className="landing-container">
          <div className="landing-section-header">
            <p className="landing-eyebrow">How it works</p>
            <h2 className="landing-section-title">Four steps, no friction.</h2>
          </div>
          <div
            className={`landing-flow ${workflowVisible ? "is-visible" : ""}`}
            ref={workflowRef}
          >
            {/* Stage 1: Upload */}
            <div className="landing-flow-stage" style={{ "--flow-delay": "0ms" } as CSSProperties}>
              <div className="landing-flow-card" aria-hidden="true">
                <div className="landing-flow-doc">
                  <div className="landing-flow-doc-header">
                    <FileText />
                    <span>resume.pdf</span>
                  </div>
                  <div className="landing-flow-doc-separator" />
                  <div className="landing-flow-doc-line" />
                  <div className="landing-flow-doc-line landing-flow-doc-line--short" />
                  <div className="landing-flow-doc-line" />
                  <div className="landing-flow-doc-line landing-flow-doc-line--medium" />
                </div>
              </div>
              <p className="landing-flow-num">{STEPS[0].num}</p>
              <h3 className="landing-flow-label">{STEPS[0].label}</h3>
              <p className="landing-flow-desc">{STEPS[0].desc}</p>
            </div>

            {/* Stage 2: Keywords */}
            <div className="landing-flow-stage" style={{ "--flow-delay": "110ms" } as CSSProperties}>
              <div className="landing-flow-card" aria-hidden="true">
                <div className="landing-flow-doc">
                  <div className="landing-flow-doc-line" />
                  <div className="landing-flow-doc-line landing-flow-doc-line--medium" />
                  <div className="landing-flow-chips">
                    <span className="landing-flow-chip">Kafka</span>
                    <span className="landing-flow-chip">distributed systems</span>
                    <span className="landing-flow-chip">CI/CD</span>
                    <span className="landing-flow-chip">real-time pipelines</span>
                    <span className="landing-flow-chip">backend</span>
                  </div>
                </div>
              </div>
              <p className="landing-flow-num">{STEPS[1].num}</p>
              <h3 className="landing-flow-label">{STEPS[1].label}</h3>
              <p className="landing-flow-desc">{STEPS[1].desc}</p>
            </div>

            {/* Stage 3: Compare */}
            <div className="landing-flow-stage" style={{ "--flow-delay": "220ms" } as CSSProperties}>
              <div className="landing-flow-card" aria-hidden="true">
                <div className="landing-flow-compare">
                  <div className="landing-flow-compare-col">
                    <p className="landing-flow-compare-label">Before</p>
                    <div className="landing-flow-doc-line" />
                    <div className="landing-flow-doc-line landing-flow-doc-line--removed" />
                    <div className="landing-flow-doc-line landing-flow-doc-line--short" />
                    <div className="landing-flow-doc-line landing-flow-doc-line--removed landing-flow-doc-line--medium" />
                  </div>
                  <div className="landing-flow-compare-divider" />
                  <div className="landing-flow-compare-col">
                    <p className="landing-flow-compare-label landing-flow-compare-label--after">After</p>
                    <div className="landing-flow-doc-line" />
                    <div className="landing-flow-doc-line landing-flow-doc-line--added" />
                    <div className="landing-flow-doc-line landing-flow-doc-line--short" />
                    <div className="landing-flow-doc-line landing-flow-doc-line--added landing-flow-doc-line--medium" />
                  </div>
                </div>
              </div>
              <p className="landing-flow-num">{STEPS[2].num}</p>
              <h3 className="landing-flow-label">{STEPS[2].label}</h3>
              <p className="landing-flow-desc">{STEPS[2].desc}</p>
            </div>

            {/* Stage 4: Export bundle */}
            <div className="landing-flow-stage" style={{ "--flow-delay": "330ms" } as CSSProperties}>
              <div className="landing-flow-card" aria-hidden="true">
                <div className="landing-flow-bundle">
                  <div className="landing-flow-bundle-file">
                    <FileText />
                    <span>Resume.pdf</span>
                  </div>
                  <div className="landing-flow-bundle-file">
                    <Mail />
                    <span>Cover letter</span>
                  </div>
                  <div className="landing-flow-bundle-file">
                    <BriefcaseBusiness />
                    <span>Job description</span>
                  </div>
                </div>
              </div>
              <p className="landing-flow-num">{STEPS[3].num}</p>
              <h3 className="landing-flow-label">{STEPS[3].label}</h3>
              <p className="landing-flow-desc">{STEPS[3].desc}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <p className="landing-eyebrow">Real example</p>
            <h2 className="landing-section-title">See exactly what changed.</h2>
          </div>
          <div
            className={`landing-example-card ${exampleVisible ? "is-visible" : ""}`}
            ref={exampleRef}
          >
            <div className="landing-example-score">
              <div className="landing-example-score-compare">
                <div className="landing-example-score-num landing-example-score-num--before">
                  <strong>42%</strong>
                  <span>before</span>
                </div>
                <div className="landing-example-score-bar">
                  <div className="landing-example-score-fill" />
                </div>
                <div className="landing-example-score-num landing-example-score-num--after">
                  <strong>84%</strong>
                  <span>after</span>
                </div>
              </div>
              <div className="landing-example-score-stats">
                <div className="landing-example-score-lift">
                  <strong>+42</strong>
                  <span>pts</span>
                </div>
                <div className="landing-example-score-kw">
                  <strong>15</strong>
                  <span>keywords matched</span>
                </div>
              </div>
            </div>
            <div className="landing-example-vdivider" />
            <div className="landing-example-diff">
              <div className="landing-example-diff-meta">
                <span>Summary section</span>
                <span>Tailored for: Senior Backend Engineer</span>
              </div>
              <p className="landing-example-diff-text">
                Senior{" "}
                <s>full-stack software engineer</s>{" "}
                <mark>backend engineer</mark>{" "}
                with 8+ years{" "}
                <s>
                  building production applications. Experience in Node.js, React, and cloud
                  tools. Delivered systems for internal teams and improved operational workflows.
                </s>{" "}
                <mark>
                  delivering scalable distributed systems, real-time data pipelines, and
                  Kafka-based workflows. Deep experience improving reliability across cloud
                  infrastructure and CI/CD delivery.
                </mark>
              </p>
              <div className="landing-example-keywords">
                <span>Kafka</span>
                <span>distributed systems</span>
                <span>CI/CD</span>
                <span>real-time pipelines</span>
                <span>backend</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="landing-positioning">
            <p className="landing-eyebrow">Why SyncResume</p>
            <h2>Transparent AI rewriting, not a black-box resume score.</h2>
            <p>
              SyncResume shows the before and after, the keywords that changed, and the application bundle it created.
              You can review the rewrite, refine the wording, pick a template, and keep every job-specific version
              attached to the role it was made for.
            </p>
          </div>
        </div>
      </section>

      <section className="landing-section" id="templates">
        <div className="landing-container">
          <div className="landing-section-header">
            <p className="landing-eyebrow">Template showcase</p>
            <h2 className="landing-section-title">Choose a layout after the content is right.</h2>
          </div>
          <div className="landing-template-wall">
            {SHOWCASE_TEMPLATE_IDS.map((id) => RESUME_TEMPLATES.find((t) => t.id === id)).filter((t): t is NonNullable<typeof t> => t !== undefined).map((template) => (
              <div
                key={template.id}
                className="landing-template-tile"
              >
                <ResumeTemplateThumbnail templateId={template.id} />
                <span>{template.name}</span>
                <Link
                  to="/workspace/optimize"
                  className="landing-template-hit"
                  aria-label={`Use ${template.name} template`}
                />
              </div>
            ))}
          </div>
          <div className="landing-template-cta-row">
            <div>
              <strong>ATS-safe templates</strong>
              <span>Every format, every style — pick yours inside the app</span>
            </div>
            <Link className="btn btn-secondary" to="/workspace/optimize">
              Browse all templates
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="landing-section-header">
            <p className="landing-eyebrow">What's included</p>
            <h2 className="landing-section-title">Everything you need to apply smarter.</h2>
          </div>
          <div className="landing-features">
            {FEATURES.map(({ icon: Icon, label, desc, wide }) => (
              <div key={label} className={`landing-feature${wide ? " landing-feature--wide" : ""}`}>
                <div className="landing-feature-top">
                  <div className="landing-feature-icon" aria-hidden="true">
                    <Icon />
                  </div>
                  <h3 className="landing-feature-label">{label}</h3>
                </div>
                <p className="landing-feature-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-final-cta">
        <div className="landing-container">
          <div className="landing-final-cta-card">
            <div>
              <p className="landing-eyebrow">Ready to tailor one?</p>
              <h2>Start with a resume and a job description.</h2>
            </div>
            <Link className="btn btn-primary" to="/workspace/optimize">
              Start tailoring free
              <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-container">
          <div className="landing-footer-inner">
            <div className="landing-brand">
              <div className="landing-brand-mark" aria-hidden="true">
                <svg viewBox="0 0 18 22" fill="none" aria-hidden="true">
                  <rect x="2.5" y="1" width="14" height="18.5" rx="2.2" stroke="rgba(255,255,255,0.18)" strokeWidth="1.1" transform="rotate(7 9.5 10.25)" />
                  <path d="M1.5 3C1.5 2.17 2.17 1.5 3 1.5H11.5L16.5 6.5V19C16.5 19.83 15.83 20.5 15 20.5H3C2.17 20.5 1.5 19.83 1.5 19V3Z" fill="rgba(34,197,94,0.07)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.2" />
                  <path d="M11.5 1.5L16.5 6.5H13C12.17 6.5 11.5 5.83 11.5 5V1.5Z" fill="#22c55e" />
                  <rect x="4" y="9.5" width="9" height="1.5" rx="0.75" fill="rgba(255,255,255,0.55)" />
                  <rect x="4" y="12.5" width="5.5" height="1.4" rx="0.7" fill="#22c55e" opacity="0.85" />
                  <rect x="4" y="15.5" width="7" height="1.2" rx="0.6" fill="rgba(255,255,255,0.22)" />
                </svg>
              </div>
              <span className="landing-brand-name">SyncResume</span>
            </div>
            <p className="landing-footer-copy">
              © {new Date().getFullYear()} SyncResume
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
