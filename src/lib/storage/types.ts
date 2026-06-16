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

export type NewResumeInput = Omit<ResumeRecord, "id" | "uploadedAt" | "usageCount" | "isActive">;
export type NewRunInput = Omit<RunRecord, "id" | "createdAt">;

/**
 * Storage contract for resumes and run history.
 *
 * Implementations are swappable: the active implementation today is
 * localStorage-backed (see localAdapter.ts). A future Supabase-backed
 * implementation (resume files in an S3-compatible bucket, run history via
 * edge functions) can replace it without any UI code changes — see
 * supabaseAdapter.ts for the intended shape.
 */
export interface StorageAdapter {
  listResumes(): Promise<ResumeRecord[]>;
  saveResume(input: NewResumeInput): Promise<ResumeRecord>;
  setActiveResume(id: string): Promise<void>;
  deleteResume(id: string): Promise<void>;
  incrementResumeUsage(id: string): Promise<void>;

  listRuns(): Promise<RunRecord[]>;
  saveRun(input: NewRunInput): Promise<RunRecord>;
  updateRunStatus(id: string, status: RunStatus): Promise<void>;
}
