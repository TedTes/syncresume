import {
  CheckCircle2,
  FileText,
  KeyRound,
  Loader2,
  Sparkles,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { ChangeEvent, FormEvent, lazy, Suspense, useMemo, useState } from "react";
import { optimizeResume } from "./lib/aiResume";
import { extractResumeText, type ExtractedFile } from "./lib/fileExtract";
import { DEFAULT_MODEL, openAIErrorMessage, validateApiKey } from "./lib/openai";
import { resumeToPlainText, type StructuredResume } from "./lib/resume";

const ResumeReview = lazy(() =>
  import("./components/ResumeReview").then((module) => ({ default: module.ResumeReview })),
);

type KeyStatus =
  | { state: "idle"; message: string }
  | { state: "checking"; message: string }
  | { state: "valid"; message: string }
  | { state: "error"; message: string };

export default function App() {
  const [apiKey, setApiKey] = useState("");
  const [validatedKey, setValidatedKey] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeText, setResumeText] = useState("");
  const [optimizedResume, setOptimizedResume] = useState<StructuredResume | null>(null);
  const [optimizeError, setOptimizeError] = useState("");
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [extractedFile, setExtractedFile] = useState<ExtractedFile | null>(null);
  const [fileError, setFileError] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);
  const [keyStatus, setKeyStatus] = useState<KeyStatus>({
    state: "idle",
    message: "Enter an OpenAI API key to unlock the optimizer.",
  });
  const canOptimize = useMemo(
    () =>
      Boolean(validatedKey) &&
      jobDescription.trim().length > 0 &&
      resumeText.trim().length > 0 &&
      !isExtracting,
    [isExtracting, jobDescription, resumeText, validatedKey],
  );
  const optimizedText = optimizedResume ? resumeToPlainText(optimizedResume) : "";

  async function handleKeySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const key = apiKey.trim();

    if (!key) {
      setKeyStatus({ state: "error", message: "API key is required." });
      return;
    }

      setValidatedKey("");
      setExtractedFile(null);
      setKeyStatus({ state: "checking", message: "Validating key with a lightweight call..." });

    try {
      await validateApiKey(key);
      setValidatedKey(key);
      setOptimizedResume(null);
      setOptimizeError("");
      setKeyStatus({
        state: "valid",
        message: "Key validated for this browser session.",
      });
    } catch (error) {
      setKeyStatus({ state: "error", message: openAIErrorMessage(error) });
    }
  }

  async function handleResumeFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsExtracting(true);
    setFileError("");
    setExtractedFile(null);

    try {
      const extracted = await extractResumeText(file);
      setResumeText(extracted.text);
      setOptimizedResume(null);
      setOptimizeError("");
      setExtractedFile(extracted);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Could not extract resume text.");
    } finally {
      setIsExtracting(false);
    }
  }

  async function handleOptimize() {
    if (!canOptimize) {
      return;
    }

    setIsOptimizing(true);
    setOptimizeError("");

    try {
      const result = await optimizeResume({
        apiKey: validatedKey,
        jobDescription,
        resumeText,
      });
      setOptimizedResume(result);
    } catch (error) {
      setOptimizeError(openAIErrorMessage(error));
    } finally {
      setIsOptimizing(false);
    }
  }

  return (
    <main className="app-shell">
      <section className="workspace">
        <header className="topbar">
          <div className="brand-strip">
            <div className="brand-mark" aria-hidden="true">
              SR
            </div>
            <div>
              <p className="eyebrow">syncresume.io</p>
              <h1>Resume optimizer workspace</h1>
            </div>
          </div>
          <div>
            <span className="model-pill">{DEFAULT_MODEL}</span>
          </div>
        </header>

        <div className="workflow-grid">
          <section className="panel key-panel" aria-labelledby="api-key-title">
            <div className="panel-heading">
              <KeyRound aria-hidden="true" />
              <div>
                <p className="eyebrow">Step 1</p>
                <h2 id="api-key-title">API key setup</h2>
              </div>
            </div>

            <form className="key-form" onSubmit={handleKeySubmit}>
              <label htmlFor="api-key">LLM API key</label>
              <div className="key-row">
                <input
                  id="api-key"
                  autoComplete="off"
                  type="password"
                  value={apiKey}
                  placeholder="sk-..."
                  onChange={(event) => {
                    setApiKey(event.target.value);
                    setValidatedKey("");
                    setOptimizedResume(null);
                    setOptimizeError("");
                    setKeyStatus({
                      state: "idle",
                      message: "Enter an OpenAI API key to unlock the optimizer.",
                    });
                  }}
                />
                <button
                  type="submit"
                  disabled={keyStatus.state === "checking" || apiKey.trim().length === 0}
                >
                  {keyStatus.state === "checking" ? (
                    <Loader2 className="spin" aria-hidden="true" />
                  ) : (
                    <KeyRound aria-hidden="true" />
                  )}
                  Validate
                </button>
              </div>
            </form>

            <StatusMessage status={keyStatus} />
            <p className="privacy-note">
              The key lives only in React state, is never persisted, and clears on reload.
            </p>
          </section>

          <section className="panel inputs-panel" aria-disabled={validatedKey ? undefined : true}>
            <div className="panel-heading">
              <FileText aria-hidden="true" />
              <div>
                <p className="eyebrow">Step 2</p>
                <h2>Inputs</h2>
              </div>
            </div>

            <div className="input-stack">
              <label htmlFor="job-description">Job description</label>
              <textarea
                id="job-description"
                value={jobDescription}
                disabled={!validatedKey || isExtracting || isOptimizing}
                placeholder="Paste the full job description..."
                onChange={(event) => {
                  setJobDescription(event.target.value);
                  setOptimizedResume(null);
                  setOptimizeError("");
                }}
              />
            </div>

            <div className="input-stack">
              <div className="label-row">
                <label htmlFor="resume-text">Resume text</label>
                <label className={`upload-button ${!validatedKey ? "disabled" : ""}`}>
                  {isExtracting ? (
                    <Loader2 className="spin" aria-hidden="true" />
                  ) : (
                    <UploadCloud aria-hidden="true" />
                  )}
                  Upload
                  <input
                    type="file"
                    accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    disabled={!validatedKey || isExtracting || isOptimizing}
                    onChange={handleResumeFile}
                  />
                </label>
              </div>
              <textarea
                id="resume-text"
                value={resumeText}
                disabled={!validatedKey || isExtracting || isOptimizing}
                placeholder="Paste resume text or upload a PDF/DOCX..."
                onChange={(event) => {
                  setResumeText(event.target.value);
                  setOptimizedResume(null);
                  setOptimizeError("");
                  setExtractedFile(null);
                }}
              />
            </div>

            <div className="input-meta">
              {extractedFile ? (
                <span>
                  {extractedFile.name} · {extractedFile.characterCount.toLocaleString()} characters
                  extracted
                </span>
              ) : (
                <span>PDF and DOCX extraction runs locally in this browser.</span>
              )}
              {fileError ? <strong>{fileError}</strong> : null}
            </div>

            <button
              className="optimize-button"
              type="button"
              disabled={!canOptimize || isOptimizing}
              onClick={handleOptimize}
            >
              {isOptimizing ? (
                <Loader2 className="spin" aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
              {isOptimizing ? "Optimizing..." : "Optimize resume"}
            </button>
          </section>

          <section className="panel locked-panel" aria-disabled={validatedKey ? undefined : true}>
            <div className="panel-heading">
              <Sparkles aria-hidden="true" />
              <div>
                <p className="eyebrow">Step 3</p>
                <h2>Optimization</h2>
              </div>
            </div>
            {isOptimizing ? (
              <div className="progress-box">
                <Loader2 className="spin" aria-hidden="true" />
                <div>
                  <strong>Generating structured resume</strong>
                  <span>Estimated wait: 20-45 seconds.</span>
                </div>
              </div>
            ) : optimizedResume ? (
              <div className="result-box">
                <CheckCircle2 aria-hidden="true" />
                <div>
                  <strong>Optimized draft ready</strong>
                  <span>
                    {optimizedResume.experience.length} role
                    {optimizedResume.experience.length === 1 ? "" : "s"} ·{" "}
                    {optimizedResume.skills.length} skills · {optimizedText.length.toLocaleString()}{" "}
                    characters
                  </span>
                </div>
              </div>
            ) : (
              <p>Structured AI rewrite, review, section revision, and export are queued next.</p>
            )}
            {optimizeError ? <div className="inline-error">{optimizeError}</div> : null}
          </section>
        </div>

        {optimizedResume ? (
          <Suspense
            fallback={
              <div className="review-loading">
                <Loader2 className="spin" aria-hidden="true" />
                Loading review workspace...
              </div>
            }
          >
            <ResumeReview
              apiKey={validatedKey}
              jobDescription={jobDescription}
              originalResumeText={resumeText}
              resume={optimizedResume}
              onResumeChange={setOptimizedResume}
            />
          </Suspense>
        ) : null}
      </section>
    </main>
  );
}

function StatusMessage({ status }: { status: KeyStatus }) {
  const Icon =
    status.state === "valid"
      ? CheckCircle2
      : status.state === "error"
        ? XCircle
        : status.state === "checking"
          ? Loader2
          : KeyRound;

  return (
    <div className={`status-message ${status.state}`} role="status">
      <Icon className={status.state === "checking" ? "spin" : ""} aria-hidden="true" />
      <span>{status.message}</span>
    </div>
  );
}
