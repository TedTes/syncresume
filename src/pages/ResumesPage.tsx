import {
  AlertCircle,
  Check,
  CheckCircle2,
  ClipboardPaste,
  Download,
  FileText,
  ListTodo,
  Loader2,
  PenLine,
  Save,
  UploadCloud,
  X,
} from "lucide-react";
import {
  ChangeEvent,
  DragEvent,
  type KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { ResumeTemplatePreview } from "../components/ResumeTemplatePreview";
import { ResumeSectionTextEditor } from "../components/ResumeSectionTextEditor";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";
import { useSettings } from "../context/SettingsContext";
import {
  downloadResumeDocumentDocx,
  downloadResumeDocumentPdf,
} from "../lib/exportResume";
import { extractResumeText } from "../lib/fileExtract";
import { applyUserProfileContactFallback } from "../lib/userProfile";
import {
  parseResumeDocument,
  serializeResumeDocument,
  updateResumeDocumentSection,
  updateResumeDocumentSectionContentKind,
  withFallbackContactSection,
  type ResumeDocument,
  type ResumeSection,
  type ResumeSectionContentKind,
} from "../lib/resumeDocument";
import {
  normalizeResumeTemplateId,
} from "../templates/registry";
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
type EditorExportType = "docx" | "pdf";

const EDITOR_EXPORT_OPTIONS: Array<{ type: EditorExportType; label: string }> = [
  { type: "docx", label: "DOCX" },
  { type: "pdf", label: "PDF" },
];

type FilePreview = {
  resumeId: string;
  url: string;
  name: string;
};

type ResumesPageProps = {
  embedded?: boolean;
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

export default function ResumesPage({ embedded = false }: ResumesPageProps) {
  const {
    resumes,
    addResume,
    setActiveResume,
    updateResumeName,
    updateResumeText,
    updateResumeTemplate,
    deleteResume,
  } = useAppData();
  const { isConfigured: hasBackend, isLoading: isAuthLoading, user } = useAuth();
  const {
    selectedTemplateId,
    setSelectedTemplateId,
    setTemplatePreviewDocument,
    userProfileDetails,
  } = useSettings();
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
  const [editedResumeDocument, setEditedResumeDocument] = useState<ResumeDocument | null>(null);
  const [selectedEditorExportTypes, setSelectedEditorExportTypes] = useState<EditorExportType[]>([
    "docx",
    "pdf",
  ]);
  const [isEditorExportMenuOpen, setIsEditorExportMenuOpen] = useState(false);
  const [editError, setEditError] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [isSavingExtractedText, setIsSavingExtractedText] = useState(false);
  const [renamingResumeId, setRenamingResumeId] = useState("");
  const [renamingResumeName, setRenamingResumeName] = useState("");
  const [isRenamingResume, setIsRenamingResume] = useState(false);
  const [resumeRenameError, setResumeRenameError] = useState("");
  const [selectedEditorSectionId, setSelectedEditorSectionId] = useState("");
  const [deletingId, setDeletingId] = useState("");
  const [pendingDeleteResume, setPendingDeleteResume] = useState<ResumeRecord | null>(null);
  const dragCounterRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorExportGroupRef = useRef<HTMLDivElement | null>(null);
  const requiresSignIn = hasBackend && !user;
  const uploadsDisabled = isUploading || isAuthLoading || requiresSignIn;
  const previewResume = resumes.find((resume) => resume.id === previewId) ?? null;
  const previewResumeDocument = useMemo(
    () => (previewResume ? parseResumeWithSourceContact(previewResume) : null),
    [previewResume, resumes],
  );
  const previewResumeDocumentWithProfile = useMemo(
    () =>
      previewResumeDocument
        ? applyUserProfileContactFallback(previewResumeDocument, userProfileDetails)
        : null,
    [previewResumeDocument, userProfileDetails],
  );
  const previewTemplateId = selectedTemplateId;
  const editingResume = resumes.find((resume) => resume.id === editingResumeId) ?? null;
  const editedResumeDocumentWithProfile = useMemo(
    () =>
      editedResumeDocument
        ? applyUserProfileContactFallback(editedResumeDocument, userProfileDetails)
        : null,
    [editedResumeDocument, userProfileDetails],
  );
  const isFullPagePreview = Boolean(previewId || previewLoadingId || filePreview || previewError);
  const currentEditedResumeText = editedResumeDocument
    ? serializeResumeDocument(editedResumeDocument)
    : "";
  const derivedBySource = resumes.reduce((groups, resume) => {
    if (resume.versionType === "tailored" && resume.sourceResumeId) {
      const sourceId = resume.sourceResumeId;
      groups.set(sourceId, [...(groups.get(sourceId) ?? []), resume]);
    }
    return groups;
  }, new Map<string, ResumeRecord[]>());
  const baseResumes = resumes.filter((resume) => resume.versionType !== "tailored");
  const orderedBaseResumes = baseResumes
    .map((resume, index) => ({ resume, index }))
    .sort((left, right) => {
      const leftHasSelection =
        left.resume.isActive || (derivedBySource.get(left.resume.id) ?? []).some((resume) => resume.isActive);
      const rightHasSelection =
        right.resume.isActive || (derivedBySource.get(right.resume.id) ?? []).some((resume) => resume.isActive);
      return Number(rightHasSelection) - Number(leftHasSelection) || left.index - right.index;
    })
    .map(({ resume }) => resume);
  const ContentTag = embedded ? "section" : "main";

  function parseResumeWithSourceContact(resume: ResumeRecord): ResumeDocument {
    const document = parseResumeDocument(resume.text, resume.name);
    const sourceResume = resume.sourceResumeId
      ? resumes.find((candidate) => candidate.id === resume.sourceResumeId)
      : null;
    const sourceDocument = sourceResume
      ? parseResumeDocument(sourceResume.text, sourceResume.name)
      : null;

    return withFallbackContactSection(document, sourceDocument);
  }

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

  useEffect(() => {
    if (!isEditorExportMenuOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!editorExportGroupRef.current?.contains(event.target as Node)) {
        setIsEditorExportMenuOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isEditorExportMenuOpen]);

  useEffect(() => {
    setTemplatePreviewDocument(editedResumeDocumentWithProfile ?? previewResumeDocumentWithProfile);
    return () => setTemplatePreviewDocument(null);
  }, [
    editedResumeDocumentWithProfile,
    previewResumeDocumentWithProfile,
    setTemplatePreviewDocument,
  ]);

  useEffect(() => {
    if (!editedResumeDocument) return;
    if (selectedEditorSectionId && editedResumeDocument.sections.some((section) => section.id === selectedEditorSectionId)) {
      return;
    }

    setSelectedEditorSectionId(editedResumeDocument.sections[0]?.id ?? "");
  }, [editedResumeDocument, selectedEditorSectionId]);

  function closePreview() {
    setPreviewId("");
    setPreviewLoadingId("");
    setPreviewError("");
    setFilePreview(null);
  }

  function openExtractedEditor(resume: ResumeRecord) {
    closePreview();
    setEditingResumeId(resume.id);
    setEditedResumeDocument(parseResumeWithSourceContact(resume));
    setSelectedEditorSectionId("");
    setSelectedTemplateId(normalizeResumeTemplateId(resume.templateId));
    setEditError("");
    setEditStatus("");
  }

  function closeExtractedEditor() {
    setEditingResumeId("");
    setEditedResumeDocument(null);
    setIsEditorExportMenuOpen(false);
    setEditError("");
    setEditStatus("");
  }

  function updateEditedSection(sectionId: string, content: string) {
    if (!editedResumeDocument) return;

    setEditedResumeDocument(updateResumeDocumentSection(editedResumeDocument, sectionId, content));
    setEditStatus("");
    setEditError("");
  }

  function updateEditedSectionContentKind(
    sectionId: string,
    contentKind: ResumeSectionContentKind,
  ) {
    if (!editedResumeDocument) return;

    setEditedResumeDocument(
      updateResumeDocumentSectionContentKind(editedResumeDocument, sectionId, contentKind),
    );
    setEditStatus("");
    setEditError("");
  }

  function updateEditedSectionFormat(
    sectionId: string,
    content: string,
    contentKind: ResumeSectionContentKind,
  ) {
    if (!editedResumeDocument) return;

    setEditedResumeDocument(
      updateResumeDocumentSectionContentKind(
        updateResumeDocumentSection(editedResumeDocument, sectionId, content),
        sectionId,
        contentKind,
      ),
    );
    setEditStatus("");
    setEditError("");
  }

  function renderEditableSectionContent(section: ResumeSection) {
    return (
      <ResumeSectionTextEditor
        section={section}
        isSelected={section.id === selectedEditorSectionId}
        onSelect={() => setSelectedEditorSectionId(section.id)}
        onContentChange={(content) => updateEditedSection(section.id, content)}
        onContentKindChange={(contentKind) => updateEditedSectionContentKind(section.id, contentKind)}
        onContentAndKindChange={(content, contentKind) =>
          updateEditedSectionFormat(section.id, content, contentKind)
        }
      />
    );
  }

  function toggleEditorExportType(type: EditorExportType) {
    setSelectedEditorExportTypes((current) => {
      const next = current.includes(type)
        ? current.filter((item) => item !== type)
        : [...current, type];

      return EDITOR_EXPORT_OPTIONS.map((option) => option.type).filter((item) =>
        next.includes(item),
      );
    });
  }

  async function handleExportEditedResume() {
    if (!editedResumeDocument || !editingResume || selectedEditorExportTypes.length === 0) return;

    setEditError("");
    try {
      for (const type of selectedEditorExportTypes) {
        if (type === "docx") {
          await downloadResumeDocumentDocx(
            editedResumeDocumentWithProfile ?? editedResumeDocument,
            selectedTemplateId,
            editingResume.name,
          );
        }
        if (type === "pdf") {
          await downloadResumeDocumentPdf(
            editedResumeDocumentWithProfile ?? editedResumeDocument,
            selectedTemplateId,
            editingResume.name,
          );
        }
      }
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Could not export resume.");
    }
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
          templateId: selectedTemplateId,
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

  async function handleDeleteResume(resume: ResumeRecord) {
    setDeletingId(resume.id);
    setUploadError("");
    try {
      await deleteResume(resume.id);
      setPreviewId((current) => (current === resume.id ? "" : current));
      setFilePreview((current) => (current?.resumeId === resume.id ? null : current));
      setEditingResumeId((current) => (current === resume.id ? "" : current));
      setPendingDeleteResume(null);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not delete that resume.");
    } finally {
      setDeletingId("");
    }
  }

  async function handleSaveExtractedText() {
    if (!editingResume || !editedResumeDocument) return;

    const normalizedText = currentEditedResumeText.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
    if (normalizedText.length < 20) {
      setEditError("Extracted resume text must be at least 20 characters.");
      return;
    }

    setIsSavingExtractedText(true);
    setEditError("");
    setEditStatus("");
    try {
      await updateResumeText(editingResume.id, normalizedText);
      await updateResumeTemplate(editingResume.id, selectedTemplateId);
      setEditedResumeDocument(parseResumeDocument(normalizedText, editingResume.name));
      setEditStatus("Saved extracted text.");
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Could not save extracted text.");
    } finally {
      setIsSavingExtractedText(false);
    }
  }

  function handlePreview(resumeId: string) {
    if (previewId === resumeId) {
      closePreview();
      return;
    }

    setPreviewId(resumeId);
    setPreviewError("");
    setFilePreview(null);
    setPreviewLoadingId("");
  }

  function handleResumeOpenKeyDown(event: KeyboardEvent<HTMLDivElement>, resumeId: string) {
    const target = event.target as HTMLElement;
    if (target.closest("button,input,form")) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePreview(resumeId);
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
        templateId: selectedTemplateId,
      });
      setTextResumeName("");
      setTextResumeValue("");
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Could not save pasted resume.");
    } finally {
      setIsSavingTextResume(false);
    }
  }

  function startResumeRename(resume: ResumeRecord) {
    setRenamingResumeId(resume.id);
    setRenamingResumeName(resume.name);
    setResumeRenameError("");
  }

  function cancelResumeRename() {
    setRenamingResumeId("");
    setRenamingResumeName("");
    setResumeRenameError("");
  }

  async function handleRenameResume(resume: ResumeRecord) {
    const nextName = renamingResumeName.trim();
    if (!nextName) {
      setResumeRenameError("Resume name is required.");
      return;
    }

    if (nextName === resume.name) {
      cancelResumeRename();
      return;
    }

    setIsRenamingResume(true);
    setResumeRenameError("");
    try {
      await updateResumeName(resume.id, nextName);
      cancelResumeRename();
    } catch (error) {
      setResumeRenameError(error instanceof Error ? error.message : "Could not rename that resume.");
    } finally {
      setIsRenamingResume(false);
    }
  }

  function renderResumeRow(resume: ResumeRecord, variant: "base" | "tailored" = "base") {
    const isTailored = variant === "tailored" || resume.versionType === "tailored";
    const isRenaming = renamingResumeId === resume.id;
    return (
      <div
        className={`resume-row${isTailored ? " resume-row-derived" : ""}${
          resume.isActive ? " resume-row-active" : ""
        }`}
      >
        {isRenaming ? (
          <div className="resume-row-open resume-row-rename-area">
            <span className="resume-row-icon" aria-hidden="true">
              <FileText />
            </span>
            <span className="resume-row-info">
              <form
                className="run-title-edit resume-rename-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleRenameResume(resume);
                }}
              >
                <input
                  className="run-title-input resume-rename-input"
                  value={renamingResumeName}
                  autoFocus
                  disabled={isRenamingResume}
                  aria-label={`Rename ${resume.name}`}
                  style={{
                    width: `${Math.min(Math.max(renamingResumeName.length + 3, 18), 56)}ch`,
                  }}
                  onChange={(event) => setRenamingResumeName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      event.preventDefault();
                      cancelResumeRename();
                    }
                  }}
                />
                <button
                  type="submit"
                  className="run-title-edit-button"
                  disabled={isRenamingResume}
                  aria-label={`Save ${resume.name} name`}
                >
                  {isRenamingResume ? <Loader2 className="spin" aria-hidden="true" /> : <Check aria-hidden="true" />}
                </button>
                <button
                  type="button"
                  className="run-title-edit-button cancel"
                  aria-label="Cancel rename"
                  disabled={isRenamingResume}
                  onClick={cancelResumeRename}
                >
                  <X aria-hidden="true" />
                </button>
              </form>
              {resumeRenameError && <span className="resume-rename-error">{resumeRenameError}</span>}
            </span>
          </div>
        ) : (
          <div
            className="resume-row-open"
            aria-label={`Open ${resume.name}`}
            aria-disabled={previewLoadingId === resume.id}
            role="button"
            tabIndex={previewLoadingId === resume.id ? -1 : 0}
            onClick={(event) => {
              const target = event.target as HTMLElement;
              if (target.closest("button,input,form") || previewLoadingId === resume.id) return;
              handlePreview(resume.id);
            }}
            onKeyDown={(event) => handleResumeOpenKeyDown(event, resume.id)}
          >
            <span className="resume-row-icon" aria-hidden="true">
              {previewLoadingId === resume.id ? <Loader2 className="spin" /> : <FileText />}
            </span>
            <span className="resume-row-info">
              <span className="resume-row-title-line">
                <span className="resume-row-name">{resume.name}</span>
                <button
                  type="button"
                  className="resume-name-action"
                  aria-label={`Rename ${resume.name}`}
                  title="Rename"
                  onClick={() => startResumeRename(resume)}
                >
                  <PenLine aria-hidden="true" />
                </button>
              </span>
              <span className="resume-row-meta">
                {isTailored
                  ? `Tailored${resume.tailoredFor ? ` for ${resume.tailoredFor}` : ""} · ${resume.matchScore ?? "—"}% match · ${formatDate(resume.uploadedAt)}`
                  : `Uploaded ${formatDate(resume.uploadedAt)} · ${resume.characterCount.toLocaleString()} chars · used in ${resume.usageCount} runs`}
              </span>
            </span>
          </div>
        )}
        {!isRenaming && (
          <div className="resume-row-actions">
            {resume.isActive ? (
              <span className="badge-active" aria-label="Active resume" title="Active">
                Active
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-secondary btn-sm resume-set-active"
                aria-label={isTailored ? `Set version active: ${resume.name}` : `Set resume active: ${resume.name}`}
                title="Set active"
                onClick={() => setActiveResume(resume.id)}
              >
                Set active
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon-only"
              aria-label={`Delete ${resume.name}`}
              title="Delete"
              disabled={deletingId === resume.id}
              onClick={() => setPendingDeleteResume(resume)}
            >
              {deletingId === resume.id ? (
                <Loader2 className="spin" aria-hidden="true" />
              ) : (
                <X aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </div>
    );
  }


  return (
    <>
      {!embedded && (
        <header className="page-topbar">
          <span className="page-topbar-title">Resumes</span>
        </header>
      )}

      {editingResume ? (
        <main
          className={`pdf-fullpage extracted-editor-page${embedded ? " workspace-fullpage-overlay" : ""}`}
          aria-label="Edit extracted resume text"
        >
          <div className="pdf-fullpage-header">
            <button type="button" className="btn btn-ghost btn-sm" onClick={closeExtractedEditor}>
              <X aria-hidden="true" />
              Close
            </button>
            <span className="pdf-fullpage-name">{editingResume.name} · extracted text</span>
            <div className="pdf-fullpage-actions">
              <div className="review-export-group" ref={editorExportGroupRef}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm review-export-button"
                  disabled={!editedResumeDocument || selectedEditorExportTypes.length === 0}
                  onClick={() => void handleExportEditedResume()}
                >
                  <Download aria-hidden="true" />
                  Export
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm review-export-menu-button"
                  aria-label="Choose export formats"
                  aria-expanded={isEditorExportMenuOpen}
                  disabled={!editedResumeDocument}
                  onClick={() => setIsEditorExportMenuOpen((isOpen) => !isOpen)}
                >
                  <ListTodo aria-hidden="true" />
                </button>
                {isEditorExportMenuOpen && (
                  <div className="export-format-menu" aria-label="Export formats">
                    {EDITOR_EXPORT_OPTIONS.map((option) => (
                      <label
                        className={`export-format-toggle ${
                          selectedEditorExportTypes.includes(option.type) ? "active" : ""
                        }`}
                        key={option.type}
                      >
                        <input
                          type="checkbox"
                          checked={selectedEditorExportTypes.includes(option.type)}
                          disabled={!editedResumeDocument}
                          onChange={() => toggleEditorExportType(option.type)}
                        />
                        <span>{option.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={isSavingExtractedText || currentEditedResumeText.trim().length < 20}
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
            {editedResumeDocument && (
              <div className="document-editor-stage" aria-label="Editable resume document">
                <ResumeTemplatePreview
                  key={selectedTemplateId}
                  document={editedResumeDocument}
                  templateId={selectedTemplateId}
                  renderContactSectionContent={renderEditableSectionContent}
                  renderSectionContent={renderEditableSectionContent}
                />
              </div>
            )}
            {editError && <div className="inline-error">{editError}</div>}
            {editStatus && <div className="inline-success">{editStatus}</div>}
          </div>
        </main>
      ) : isFullPagePreview ? (
        <main
          className={`pdf-fullpage${embedded ? " workspace-fullpage-overlay" : ""}`}
          aria-label="Resume preview"
        >
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
                    aria-label={`Edit ${previewResume.name}`}
                    title="Edit resume"
                    onClick={() => openExtractedEditor(previewResume)}
                  >
                    <PenLine aria-hidden="true" />
                    Edit
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      if (!previewResumeDocumentWithProfile) return;
                      void downloadResumeDocumentPdf(
                        previewResumeDocumentWithProfile,
                        previewTemplateId,
                        previewResume.name,
                      );
                    }}
                  >
                    <Download aria-hidden="true" />
                    Export
                  </button>
                </>
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
              {previewResumeDocumentWithProfile && (
                <div className="template-fullpage-preview-shell">
                  <ResumeTemplatePreview
                    key={previewTemplateId}
                    document={previewResumeDocumentWithProfile}
                    templateId={previewTemplateId}
                  />
                </div>
              )}
            </div>
          ) : filePreview ? (
            <iframe
              className="pdf-fullpage-frame"
              src={`${filePreview.url}#toolbar=0&navpanes=0&scrollbar=1`}
              title={`${filePreview.name} PDF preview`}
            />
          ) : previewResumeDocumentWithProfile ? (
            <div className="extracted-preview-shell template-fullpage-preview-shell">
              <ResumeTemplatePreview
                key={previewTemplateId}
                document={previewResumeDocumentWithProfile}
                templateId={previewTemplateId}
              />
            </div>
          ) : null}
        </main>
      ) : (
      <ContentTag className={`page-content${embedded ? " workspace-resume-section" : ""}`}>
        {!embedded && (
          <>
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
            <span className="resume-input-title">Add resume</span>
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
                className={`resume-upload-compact ${isDraggingOver ? "dragging" : ""} ${uploadsDisabled ? "disabled" : ""}`}
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                aria-busy={isUploading}
                aria-disabled={uploadsDisabled}
              >
                <div className="resume-upload-compact-copy">
                  <span className="resume-upload-compact-title">
                    {isUploading
                      ? "Uploading resume..."
                      : isAuthLoading
                        ? "Checking session..."
                        : requiresSignIn
                          ? "Sign in to upload resumes"
                          : isDraggingOver
                            ? "Drop to upload"
                            : "Upload PDF or DOCX"}
                  </span>
                  <span className="resume-upload-compact-sub">
                    Choose a file, or drag it onto this row.
                  </span>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={uploadsDisabled}
                  onClick={() => {
                    if (uploadsDisabled) {
                      if (requiresSignIn) setUploadError("Sign in before uploading resumes.");
                      return;
                    }
                    fileInputRef.current?.click();
                  }}
                >
                  {isUploading ? (
                    <Loader2 className="spin" aria-hidden="true" />
                  ) : (
                    <UploadCloud aria-hidden="true" />
                  )}
                  Upload
                </button>
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
          </>
        )}

        <div className="resume-list-header">
          <p className="section-label">Your resumes</p>
          {embedded && (
            <div className="resume-list-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm resume-upload-link"
                disabled={uploadsDisabled}
                onClick={() => {
                  if (uploadsDisabled) {
                    if (requiresSignIn) setUploadError("Sign in before uploading resumes.");
                    return;
                  }
                  fileInputRef.current?.click();
                }}
              >
                {isUploading ? (
                  <Loader2 className="spin" aria-hidden="true" />
                ) : (
                  <UploadCloud aria-hidden="true" />
                )}
                Upload new
              </button>
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
          )}
        </div>
        {embedded && uploadError && <div className="inline-error embedded-upload-error">{uploadError}</div>}
        {embedded && uploadQueue.length > 0 && (
          <div className="upload-queue embedded-upload-queue" aria-live="polite">
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
        {resumes.length === 0 ? (
          <div className="empty-state">No resumes uploaded yet.</div>
        ) : (
          <div className="resumes-list">
            {orderedBaseResumes.map((resume) => (
              <div className="resume-group" key={resume.id}>
                {renderResumeRow(resume)}
              </div>
            ))}
          </div>
        )}
      </ContentTag>
      )}
      {pendingDeleteResume && (
        <div
          className="confirm-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !deletingId) {
              setPendingDeleteResume(null);
            }
          }}
        >
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-resume-title"
            aria-describedby="delete-resume-copy"
          >
            <div className="confirm-modal-header">
              <h2 id="delete-resume-title">Delete resume?</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon-only"
                aria-label="Close delete confirmation"
                disabled={Boolean(deletingId)}
                onClick={() => setPendingDeleteResume(null)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <p id="delete-resume-copy">
              This will remove {pendingDeleteResume.name} from your resume list.
            </p>
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={Boolean(deletingId)}
                onClick={() => setPendingDeleteResume(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm btn-danger"
                disabled={Boolean(deletingId)}
                onClick={() => void handleDeleteResume(pendingDeleteResume)}
              >
                {deletingId ? <Loader2 className="spin" aria-hidden="true" /> : <X aria-hidden="true" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
