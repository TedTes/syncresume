export type ResumeFileType = "pdf" | "docx" | "text";

export type ResumeRecord = {
  id: string;
  name: string;
  fileType: ResumeFileType;
  text: string;
  characterCount: number;
  uploadedAt: string;
  usageCount: number;
  isActive: boolean;
};

export type RunStatus = "draft" | "exported";
export type ExportType = "docx" | "pdf" | "copy";

export type RunRecord = {
  id: string;
  title: string;
  resumeId: string;
  resumeName: string;
  jobDescription: string;
  score: number;
  status: RunStatus;
  createdAt: string;
};

export type NewResumeInput = Omit<ResumeRecord, "id" | "uploadedAt" | "usageCount" | "isActive"> & {
  file?: File;
};
export type NewRunInput = Omit<RunRecord, "id" | "createdAt">;

/**
 * Storage contract for resumes and run history.
 *
 * The production implementation is Cloudflare-backed: resume metadata and run
 * history in D1, original files in R2, and mutations through the Worker API.
 */
export interface StorageAdapter {
  listResumes(): Promise<ResumeRecord[]>;
  saveResume(input: NewResumeInput): Promise<ResumeRecord>;
  getResumeFile?(id: string): Promise<Blob>;
  setActiveResume(id: string): Promise<void>;
  deleteResume(id: string): Promise<void>;
  incrementResumeUsage(id: string): Promise<void>;

  listRuns(): Promise<RunRecord[]>;
  saveRun(input: NewRunInput): Promise<RunRecord>;
  updateRunStatus(id: string, status: RunStatus): Promise<void>;
  recordExport(runId: string, exportType: ExportType): Promise<void>;
}
