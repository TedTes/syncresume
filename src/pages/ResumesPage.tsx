import { CheckCircle2, Eye, FileText, Loader2, UploadCloud } from "lucide-react";
import { ChangeEvent, DragEvent, useRef, useState } from "react";
import { useAppData } from "../context/AppDataContext";
import { extractResumeText } from "../lib/fileExtract";
import type { ResumeFileType } from "../lib/storage";

function fileTypeFromName(name: string): ResumeFileType {
  return name.toLowerCase().endsWith(".docx") ? "docx" : "pdf";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function ResumesPage() {
  const { resumes, addResume, setActiveResume } = useAppData();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [previewId, setPreviewId] = useState("");
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    setIsUploading(true);
    setUploadError("");

    for (const file of Array.from(files)) {
      try {
        const extracted = await extractResumeText(file);
        await addResume({
          name: extracted.name,
          fileType: fileTypeFromName(extracted.name),
          text: extracted.text,
          characterCount: extracted.characterCount,
        });
      } catch (error) {
        setUploadError(error instanceof Error ? error.message : "Could not read that file.");
      }
    }

    setIsUploading(false);
  }

  function handleFileInput(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    event.target.value = "";
    if (files && files.length > 0) void handleFiles(files);
  }

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    if (Array.from(e.dataTransfer.types).includes("Files")) {
      dragCounterRef.current += 1;
      setIsDraggingOver(true);
    }
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
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
    if (e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
  }

  return (
    <>
      <header className="page-topbar">
        <span className="page-topbar-title">Resumes</span>
      </header>

      <main className="page-content">
        <div
          className={`dropzone-large ${isDraggingOver ? "dragging" : ""}`}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
        >
          <span className="dropzone-large-icon" aria-hidden="true">
            {isUploading ? <Loader2 className="spin" /> : <UploadCloud />}
          </span>
          <span className="dropzone-large-title">
            {isUploading ? "Uploading…" : "Drop your resume here"}
          </span>
          <span className="dropzone-large-sub">PDF or DOCX · multiple files supported</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            multiple
            className="sr-only"
            onChange={handleFileInput}
          />
        </div>

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
                      Uploaded {formatDate(resume.uploadedAt)} · used in {resume.usageCount} runs
                    </span>
                  </div>
                  <div className="resume-row-actions">
                    {resume.isActive ? (
                      <span className="badge-active">
                        <CheckCircle2 aria-hidden="true" />
                        Active
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setActiveResume(resume.id)}
                      >
                        Set active
                      </button>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => setPreviewId((current) => (current === resume.id ? "" : resume.id))}
                    >
                      <Eye aria-hidden="true" />
                      Preview
                    </button>
                  </div>
                </div>
                {previewId === resume.id && <pre className="resume-preview">{resume.text}</pre>}
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
