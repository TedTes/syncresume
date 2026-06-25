import { ArrowRight, Clipboard, Download, RefreshCw, SplitSquareHorizontal, Upload } from "lucide-react";
import { Link } from "react-router-dom";
import { ResumeTemplateThumbnail } from "../components/ResumeTemplateThumbnail";
import type { ResumeTemplateId } from "../templates/registry";

const FEATURED_TEMPLATES: ResumeTemplateId[] = [
  "modern",
  "crisp",
  "sidebar",
  "timeline",
  "executive",
  "compact",
  "carbon",
  "prism",
  "ledger",
  "stark",
  "tropic",
  "arctic",
];

const STEPS = [
  {
    icon: Upload,
    num: "01",
    label: "Upload your resume",
    desc: "Import your existing resume. We parse the structure and keep your content intact.",
  },
  {
    icon: Clipboard,
    num: "02",
    label: "Paste the job posting",
    desc: "Drop in any job description. We extract the requirements and keywords automatically.",
  },
  {
    icon: SplitSquareHorizontal,
    num: "03",
    label: "Review the changes",
    desc: "Compare original and tailored versions side by side. Accept or refine any edits.",
  },
  {
    icon: Download,
    num: "04",
    label: "Export and apply",
    desc: "Download as PDF or DOCX. Your resume, cover letter, and job description are saved as a bundle.",
  },
];

const FEATURES = [
  {
    label: "ATS-safe templates",
    desc: "97 clean layouts built to parse correctly through applicant tracking systems — no tables, no text boxes.",
  },
  {
    label: "Job-specific tailoring",
    desc: "Rewrites bullets and skills sections to match the language and priorities of each individual role.",
  },
  {
    label: "Cover letter included",
    desc: "Generates a targeted cover letter alongside every tailored resume — not a generic template.",
  },
  {
    label: "Versioned application bundles",
    desc: "Every run saves a complete package: tailored resume, cover letter, and the job description used to create it.",
  },
];

export default function LandingPage() {
  return (
    <div className="landing">
      <header className="landing-nav">
        <div className="landing-nav-inner">
          <div className="landing-brand">
            <div className="landing-brand-mark" aria-hidden="true">
              <RefreshCw />
            </div>
            <span className="landing-brand-name">SyncResume</span>
          </div>
          <Link className="btn btn-primary btn-sm" to="/workspace/optimize">
            Start tailoring
          </Link>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-container">
          <div className="landing-hero-content">
            <h1 className="landing-hero-headline">
              Tailor every resume<br />to the job.
            </h1>
            <p className="landing-hero-sub">
              Upload your resume, paste a job description, and get a keyword-matched version with a cover letter — ready to export in seconds.
            </p>
            <div className="landing-hero-actions">
              <Link className="btn btn-primary" to="/workspace/optimize">
                Start tailoring
                <ArrowRight aria-hidden="true" />
              </Link>
              <a className="landing-text-link" href="#templates">
                View templates
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section" id="templates">
        <div className="landing-container">
          <div className="landing-section-header">
            <p className="landing-eyebrow">97 templates</p>
            <h2 className="landing-section-title">Professional. ATS-ready.</h2>
            <p className="landing-section-sub">
              Every template exports cleanly to PDF and DOCX — built for readability, not decoration.
            </p>
          </div>
          <div className="landing-template-grid">
            {FEATURED_TEMPLATES.map((id) => (
              <Link
                key={id}
                to="/workspace/optimize"
                className="landing-template-card"
                aria-label={`Use ${id} template`}
              >
                <ResumeTemplateThumbnail templateId={id} />
                <span className="landing-template-label">{id}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section landing-section-alt">
        <div className="landing-container">
          <div className="landing-section-header">
            <p className="landing-eyebrow">How it works</p>
            <h2 className="landing-section-title">Four steps, no friction.</h2>
          </div>
          <div className="landing-steps">
            {STEPS.map(({ icon: Icon, num, label, desc }) => (
              <div key={num} className="landing-step">
                <div className="landing-step-icon">
                  <Icon aria-hidden="true" />
                </div>
                <p className="landing-step-num">{num}</p>
                <h3 className="landing-step-label">{label}</h3>
                <p className="landing-step-desc">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-section">
        <div className="landing-container">
          <div className="landing-section-header">
            <p className="landing-eyebrow">What's included</p>
            <h2 className="landing-section-title">Everything you need to apply smarter.</h2>
          </div>
          <div className="landing-features">
            {FEATURES.map(({ label, desc }) => (
              <div key={label} className="landing-feature">
                <div className="landing-feature-dot" aria-hidden="true" />
                <div>
                  <h3 className="landing-feature-label">{label}</h3>
                  <p className="landing-feature-desc">{desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="landing-cta-row">
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
                <RefreshCw />
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
