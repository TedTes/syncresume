import type { StructuredResume } from "../resume";

export type ResumeFileType = "pdf" | "docx" | "text";
export type ResumeVersionType = "base" | "tailored";

export type ResumeRecord = {
  id: string;
  name: string;
  fileType: ResumeFileType;
  text: string;
  characterCount: number;
  uploadedAt: string;
  usageCount: number;
  isActive: boolean;
  templateId: string;
  versionType: ResumeVersionType;
  sourceResumeId?: string | null;
  sourceRunId?: string | null;
  tailoredFor?: string | null;
  matchScore?: number | null;
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
  hasReview?: boolean;
  originalResumeText?: string;
  optimizedResume?: StructuredResume | null;
  optimizedResumeText?: string;
  beforeScore?: number;
  matchedKeywords?: string[];
  partialKeywords?: string[];
  missingKeywords?: string[];
  templateId?: string;
  tailoredResumeId?: string | null;
  hasCoverLetter?: boolean;
  coverLetterText?: string | null;
};

export type NewResumeInput = Omit<ResumeRecord, "id" | "uploadedAt" | "usageCount" | "isActive" | "templateId" | "versionType"> & {
  templateId?: string;
  versionType?: ResumeVersionType;
  file?: File;
};
export type NewRunInput = Omit<RunRecord, "id" | "createdAt">;
export type RunReviewUpdateInput = {
  jobDescription: string;
  originalResumeText: string;
  resume: StructuredResume;
  templateId?: string;
};

export type RunCoverLetterUpdateInput = {
  coverLetterText: string;
};

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
  updateResumeName(id: string, name: string): Promise<ResumeRecord>;
  updateResumeText(id: string, text: string): Promise<ResumeRecord>;
  updateResumeTemplate(id: string, templateId: string): Promise<ResumeRecord>;
  deleteResume(id: string): Promise<void>;
  incrementResumeUsage(id: string): Promise<void>;

  listRuns(): Promise<RunRecord[]>;
  getRun(id: string): Promise<RunRecord>;
  saveRun(input: NewRunInput): Promise<RunRecord>;
  updateRunTitle(id: string, title: string): Promise<RunRecord>;
  updateRunReview(id: string, input: RunReviewUpdateInput): Promise<RunRecord>;
  updateRunCoverLetter(id: string, input: RunCoverLetterUpdateInput): Promise<RunRecord>;
  updateRunStatus(id: string, status: RunStatus): Promise<void>;
  deleteRun(id: string): Promise<void>;
  recordExport(runId: string, exportType: ExportType): Promise<void>;
}
