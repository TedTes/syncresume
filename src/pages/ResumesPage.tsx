import {
  AlertCircle,
  CheckCircle2,
  ClipboardPaste,
  Download,
  Eye,
  ExternalLink,
  FileText,
  Loader2,
  PenLine,
  Save,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { ChangeEvent, DragEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { downloadTextPdf } from "../lib/exportResume";
import { extractResumeText } from "../lib/fileExtract";
import type { ResumeFileType, ResumeRecord } from "../lib/storage";

const MAX_RESUME_BYTES = 25 * 1024 * 1024;

type UploadStatus = "queued" | "extracting" | "uploading" | "done" | "error";

type UploadQueueItem = {
  id: string;
  name: string;
  size: number;
  status: UploadStatus;
  message: string;
};

type ResumeInputMode = "upload" | "paste";

type FilePreview = {
  resumeId: string;
  url: string;
  name: string;
};

function fileTypeFromName(name: string): ResumeFileType {
  const normalized = name.toLowerCase();
  if (normalized.endsWith(".pdf")) return "pdf";
  if (normalized.endsWith(".docx")) return "docx";
  throw new Error("Upload a PDF or DOCX resume.");
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function makeUploadId(file: File, index: number): string {
  return `${file.name}-${file.size}-${file.lastModified}-${index}`;
}

function waitForRenderFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

export default function ResumesPage() {
  const {
    resumes,
    addResume,
    getResumeFile,
    setActiveResume,
    updateResumeText,
    deleteResume,
  } = useAppData();
  const { isConfigured: hasBackend, isLoading: isAuthLoading, user } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const [textResumeName, setTextResumeName] = useState("");
  const [textResumeValue, setTextResumeValue] = useState("");
  const [resumeInputMode, setResumeInputMode] = useState<ResumeInputMode>("upload");
  const [isSavingTextResume, setIsSavingTextResume] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewId, setPreviewId] = useState("");
  const [previewLoadingId, setPreviewLoadingId] = useState("");
  const [previewError, setPreviewError] = useState("");
  const [filePreview, setFilePreview] = useState<FilePreview | null>(null);
  const [editingResumeId, setEditingResumeId] = useState("");
  const [editedResumeText, setEditedResumeText] = useState("");
  const [editError, setEditError] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [isSavingExtractedText, setIsSavingExtractedText] = useState(false);
  const [deletingId, setDeletingId] = useState("");
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const requiresSignIn = hasBackend && !user;
  const uploadsDisabled = isUploading || isAuthLoading || requiresSignIn;
  const previewResume = resumes.find((resume) => resume.id === previewId) ?? null;
  const editingResume = resumes.find((resume) => resume.id === editingResumeId) ?? null;
  const isFullPagePreview = Boolean(previewId || previewLoadingId || filePreview || previewError);

  function updateUploadItem(id: string, patch: Partial<UploadQueueItem>) {
    setUploadQueue((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }

  useEffect(() => {
    return () => {
      if (filePreview?.url) URL.revokeObjectURL(filePreview.url);
    };
  }, [filePreview?.url]);

  function closePreview() {
    setPreviewId("");
    setPreviewLoadingId("");
    setPreviewError("");
    setFilePreview(null);
  }

  function openExtractedEditor(resume: ResumeRecord) {
    closePreview();
    setEditingResumeId(resume.id);
    setEditedResumeText(resume.text);
    setEditError("");
    setEditStatus("");
  }

  function closeExtractedEditor() {
    setEditingResumeId("");
    setEditedResumeText("");
    setEditError("");
    setEditStatus("");
  }

  function switchResumeInputMode(mode: ResumeInputMode) {
    setResumeInputMode(mode);
    setUploadError("");
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
  }

  async function handleFiles(files: FileList | File[]) {
    if (requiresSignIn) {
      setUploadError("Sign in before uploading resumes.");
      return;
    }

    const incomingFiles = Array.from(files);
    if (incomingFiles.length === 0) return;

    setIsUploading(true);
    setUploadError("");
    const queueItems = incomingFiles.map((file, index) => ({
      id: makeUploadId(file, index),
      name: file.name,
      size: file.size,
      status: "queued" as const,
      message: "Waiting",
    }));
    setUploadQueue(queueItems);
    await waitForRenderFrame();

    for (const [index, file] of incomingFiles.entries()) {
      const itemId = queueItems[index].id;
      try {
        if (file.size > MAX_RESUME_BYTES) {
          throw new Error(`File is larger than ${formatBytes(MAX_RESUME_BYTES)}.`);
        }

        const fileType = fileTypeFromName(file.name);
        updateUploadItem(itemId, { status: "extracting", message: "Extracting text" });
        const extracted = await extractResumeText(file);
        updateUploadItem(itemId, {
          status: "uploading",
          message: `${extracted.characterCount.toLocaleString()} characters extracted`,
        });
        await addResume({
          name: extracted.name,
          fileType,
          text: extracted.text,
          characterCount: extracted.characterCount,
          file,
        });
        updateUploadItem(itemId, { status: "done", message: "Uploaded" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Could not process that file.";
        updateUploadItem(itemId, { status: "error", message });
        setUploadError("Some files could not be uploaded. Check the processing details.");
      }
    }

    setIsUploading(false);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (files.length > 0) void handleFiles(files);
  }

  function handleDropzoneKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (uploadsDisabled) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      fileInputRef.current?.click();
    }
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (uploadsDisabled) return;
    if (Array.from(e.dataTransfer.types).includes("Files")) {
      dragCounterRef.current += 1;
      setIsDraggingOver(true);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = uploadsDisabled ? "none" : "copy";
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDraggingOver(false);
    }
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    dragCounterRef.current = 0;
    setIsDraggingOver(false);
    if (uploadsDisabled) {
      if (requiresSignIn) setUploadError("Sign in before uploading resumes.");
      return;
    }
    if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
  }

  async function handleDeleteResume(id: string) {
    setDeletingId(id);
    setUploadError("");
    try {
      await deleteResume(id);
      setPreviewId((current) => (current === id ? "" : current));
      setFilePreview((current) => (current?.resumeId === id ? null : current));
      setEditingResumeId((current) => (current === id ? "" : current));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not delete that resume.");
    } finally {
      setDeletingId("");
    }
  }

  async function handleSaveExtractedText() {
    if (!editingResume) return;

    const normalizedText = editedResumeText.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
    if (normalizedText.length < 20) {
      setEditError("Extracted resume text must be at least 20 characters.");
      return;
    }

    setIsSavingExtractedText(true);
    setEditError("");
    setEditStatus("");
    try {
      await updateResumeText(editingResume.id, normalizedText);
      setEditedResumeText(normalizedText);
      setEditStatus("Saved extracted text.");
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Could not save extracted text.");
    } finally {
      setIsSavingExtractedText(false);
    }
  }

  async function handlePreview(resumeId: string, fileType: ResumeFileType, name: string) {
    if (previewId === resumeId) {
      closePreview();
      return;
    }

    setPreviewId(resumeId);
    setPreviewError("");
    setFilePreview(null);

    if (fileType !== "pdf") return;

    setPreviewLoadingId(resumeId);
    try {
      const blob = await getResumeFile(resumeId);
      const pdfBlob = blob.type === "application/pdf" ? blob : new Blob([blob], { type: "application/pdf" });
      setFilePreview({
        resumeId,
        name,
        url: URL.createObjectURL(pdfBlob),
      });
    } catch (error) {
      setPreviewError(
        error instanceof Error ? error.message : "Could not open the original PDF preview.",
      );
    } finally {
      setPreviewLoadingId("");
    }
  }

  async function handleSaveTextResume() {
    if (requiresSignIn) {
      setUploadError("Sign in before saving resumes.");
      return;
    }

    const normalizedText = textResumeValue.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
    if (normalizedText.length < 20) {
      setUploadError("Paste enough resume text before saving.");
      return;
    }

    setIsSavingTextResume(true);
    setUploadError("");
    try {
      await addResume({
        name: textResumeName.trim() || "Pasted Resume.txt",
        fileType: "text",
        text: normalizedText,
        characterCount: normalizedText.length,
      });
      setTextResumeName("");
      setTextResumeValue("");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not save pasted resume.");
    } finally {
      setIsSavingTextResume(false);
    }
  }

  return (
    <>
      <header className="page-topbar">
        <span className="page-topbar-title">Resumes</span>
      </header>

      {editingResume ? (
        <main className="pdf-fullpage extracted-editor-page" aria-label="Edit extracted resume text">
          <div className="pdf-fullpage-header">
            <button type="button" className="btn btn-ghost btn-sm" onClick={closeExtractedEditor}>
              <X aria-hidden="true" />
              Close
            </button>
            <span className="pdf-fullpage-name">{editingResume.name} · extracted text</span>
            <div className="pdf-fullpage-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => downloadTextPdf(editedResumeText, editingResume.name)}
              >
                <Download aria-hidden="true" />
                PDF
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isSavingExtractedText || editedResumeText.trim().length < 20}
                onClick={() => void handleSaveExtractedText()}
              >
                {isSavingExtractedText ? (
                  <Loader2 className="spin" aria-hidden="true" />
                ) : (
                  <Save aria-hidden="true" />
                )}
                Save
              </button>
            </div>
          </div>
          <div className="extracted-editor-shell">
            <div className="extracted-editor-meta">
              <span>{editedResumeText.trim().length.toLocaleString()} chars</span>
              <span>PDF/DOCX extraction is editable here; the original file remains unchanged.</span>
            </div>
            <textarea
              className="field-textarea extracted-editor-textarea"
              value={editedResumeText}
              onChange={(event) => {
                setEditedResumeText(event.target.value);
                setEditStatus("");
                setEditError("");
              }}
            />
            {editError && <div className="inline-error">{editError}</div>}
            {editStatus && <div className="inline-success">{editStatus}</div>}
          </div>
        </main>
      ) : isFullPagePreview ? (
        <main className="pdf-fullpage" aria-label="Resume preview">
          <div className="pdf-fullpage-header">
            <button type="button" className="btn btn-ghost btn-sm" onClick={closePreview}>
              <X aria-hidden="true" />
              Close
            </button>
            <span className="pdf-fullpage-name">
              {filePreview?.name ?? previewResume?.name ?? (previewError ? "Preview unavailable" : "Loading preview…")}
            </span>
            <div className="pdf-fullpage-actions">
              {previewResume && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => openExtractedEditor(previewResume)}
                  >
                    <PenLine aria-hidden="true" />
                    Edit text
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => downloadTextPdf(previewResume.text, previewResume.name)}
                  >
                    <Download aria-hidden="true" />
                    PDF
                  </button>
                </>
              )}
              {filePreview && (
                <a
                  className="btn btn-ghost btn-sm"
                  href={filePreview.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink aria-hidden="true" />
                  Open original
                </a>
              )}
            </div>
          </div>
          {previewLoadingId ? (
            <div className="resume-preview-loading" style={{ flex: 1 }}>
              <Loader2 className="spin" aria-hidden="true" />
              Opening preview…
            </div>
          ) : previewError ? (
            <div className="extracted-preview-shell">
              <div className="inline-error">{previewError}</div>
              {previewResume && <pre className="resume-preview extracted-preview">{previewResume.text}</pre>}
            </div>
          ) : filePreview ? (
            <iframe
              className="pdf-fullpage-frame"
              src={`${filePreview.url}#toolbar=0&navpanes=0&scrollbar=1`}
              title={`${filePreview.name} PDF preview`}
            />
          ) : previewResume ? (
            <div className="extracted-preview-shell">
              <pre className="resume-preview extracted-preview">{previewResume.text}</pre>
            </div>
          ) : null}
        </main>
      ) : (
      <main className="page-content">
        {requiresSignIn && (
          <div className="resume-auth-callout">
            <div>
              <span className="resume-auth-title">Sign in required</span>
              <span className="resume-auth-copy">
                Uploads sync through Cloudflare storage after you sign in.
              </span>
            </div>
            <Link className="btn btn-secondary btn-sm" to="/settings">
              Open Settings
            </Link>
          </div>
        )}

        <section className="resume-input-section" aria-label="Add resume">
          <div className="resume-input-toolbar">
            <span className="resume-input-title">
              {resumeInputMode === "upload" ? "Upload resume" : "Paste resume text"}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              type="button"
              onClick={() =>
                switchResumeInputMode(resumeInputMode === "upload" ? "paste" : "upload")
              }
            >
              {resumeInputMode === "upload" ? (
                <ClipboardPaste aria-hidden="true" />
              ) : (
                <UploadCloud aria-hidden="true" />
              )}
              {resumeInputMode === "upload" ? "Paste text" : "Upload file"}
            </button>
          </div>

          {resumeInputMode === "upload" ? (
            <>
              <div
                className={`dropzone-large ${isDraggingOver ? "dragging" : ""} ${uploadsDisabled ? "disabled" : ""}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => {
                  if (uploadsDisabled) {
                    if (requiresSignIn) setUploadError("Sign in before uploading resumes.");
                    return;
                  }
                  fileInputRef.current?.click();
                }}
                onKeyDown={handleDropzoneKeyDown}
                role="button"
                tabIndex={0}
                aria-busy={isUploading}
                aria-disabled={uploadsDisabled}
              >
                <span className="dropzone-large-icon" aria-hidden="true">
                  {isUploading ? <Loader2 className="spin" /> : <UploadCloud />}
                </span>
                <span className="dropzone-large-title">
                  {isUploading
                    ? "Uploading..."
                    : isAuthLoading
                      ? "Checking session..."
                      : requiresSignIn
                        ? "Sign in to upload resumes"
                        : "Drop your resume here"}
                </span>
                <span className="dropzone-large-sub">PDF or DOCX · multiple files supported</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  multiple
                  className="sr-only"
                  disabled={uploadsDisabled}
                  onChange={handleFileInput}
                />
              </div>

              {uploadQueue.length > 0 && (
                <div className="upload-queue" aria-live="polite">
                  {uploadQueue.map((item) => (
                    <div className={`upload-queue-row ${item.status}`} key={item.id}>
                      <span className="upload-queue-icon" aria-hidden="true">
                        {item.status === "done" ? (
                          <CheckCircle2 />
                        ) : item.status === "error" ? (
                          <AlertCircle />
                        ) : (
                          <Loader2 className="spin" />
                        )}
                      </span>
                      <div className="upload-queue-main">
                        <span className="upload-queue-name">{item.name}</span>
                        <span className="upload-queue-meta">
                          {formatBytes(item.size)} · {item.message}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="paste-resume-panel">
              <div className="paste-resume-grid">
                <input
                  className="field-input"
                  type="text"
                  value={textResumeName}
                  placeholder="Resume name"
                  disabled={isAuthLoading || requiresSignIn}
                  onChange={(event) => setTextResumeName(event.target.value)}
                />
                <textarea
                  className="field-textarea paste-resume-textarea"
                  value={textResumeValue}
                  rows={5}
                  placeholder="Paste the resume text here..."
                  disabled={isAuthLoading || requiresSignIn}
                  onChange={(event) => setTextResumeValue(event.target.value)}
                />
              </div>
              <div className="paste-resume-footer">
                <span>{textResumeValue.trim().length.toLocaleString()} chars</span>
                <button
                  className="btn btn-secondary btn-sm"
                  type="button"
                  disabled={
                    isAuthLoading ||
                    requiresSignIn ||
                    isSavingTextResume ||
                    textResumeValue.trim().length < 20
                  }
                  onClick={() => void handleSaveTextResume()}
                >
                  {isSavingTextResume ? (
                    <Loader2 className="spin" aria-hidden="true" />
                  ) : (
                    <CheckCircle2 aria-hidden="true" />
                  )}
                  Save text
                </button>
              </div>
            </div>
          )}
        </section>

        {uploadError && <div className="inline-error" style={{ marginBottom: 16 }}>{uploadError}</div>}

        <p className="section-label">Your resumes</p>
        {resumes.length === 0 ? (
          <div className="empty-state">No resumes uploaded yet.</div>
        ) : (
          <div className="resumes-list">
            {resumes.map((resume) => (
              <div key={resume.id}>
                <div className="resume-row">
                  <span className="resume-row-icon" aria-hidden="true">
                    <FileText />
                  </span>
                  <div className="resume-row-info">
                    <span className="resume-row-name">{resume.name}</span>
                    <span className="resume-row-meta">
                      Uploaded {formatDate(resume.uploadedAt)} · {resume.characterCount.toLocaleString()} chars · used in {resume.usageCount} runs
                    </span>
                  </div>
                  <div className="resume-row-actions">
                    {resume.isActive ? (
                      <span className="badge-active">
                        <CheckCircle2 aria-hidden="true" />
                        Selected
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setActiveResume(resume.id)}
                      >
                        Use resume
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={previewLoadingId === resume.id}
                      onClick={() => void handlePreview(resume.id, resume.fileType, resume.name)}
                    >
                      {previewLoadingId === resume.id ? (
                        <Loader2 className="spin" aria-hidden="true" />
                      ) : (
                        <Eye aria-hidden="true" />
                      )}
                      Preview
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => openExtractedEditor(resume)}
                    >
                      <PenLine aria-hidden="true" />
                      Edit text
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={deletingId === resume.id}
                      onClick={() => void handleDeleteResume(resume.id)}
                    >
                      {deletingId === resume.id ? (
                        <Loader2 className="spin" aria-hidden="true" />
                      ) : (
                        <Trash2 aria-hidden="true" />
                      )}
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      )}
    </>
  );
}
