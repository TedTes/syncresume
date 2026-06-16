import type {
  NewResumeInput,
  NewRunInput,
  ResumeRecord,
  RunRecord,
  RunStatus,
  StorageAdapter,
} from "./types";

const RESUMES_KEY = "syncresume.resumes.v1";
const RUNS_KEY = "syncresume.runs.v1";

function readList<T>(key: string): T[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList<T>(key: string, value: T[]): void {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function makeId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/**
 * localStorage-backed implementation. Holds resume text and run metadata
 * only — no secrets are ever written here. This is the "for now" adapter;
 * swap `index.ts` to the Supabase adapter once that backend exists.
 */
export class LocalStorageAdapter implements StorageAdapter {
  async listResumes(): Promise<ResumeRecord[]> {
    return readList<ResumeRecord>(RESUMES_KEY).sort((a, b) =>
      b.uploadedAt.localeCompare(a.uploadedAt),
    );
  }

  async saveResume(input: NewResumeInput): Promise<ResumeRecord> {
    const resumes = readList<ResumeRecord>(RESUMES_KEY);
    const isFirst = resumes.length === 0;
    const record: ResumeRecord = {
      ...input,
      id: makeId(),
      uploadedAt: new Date().toISOString(),
      usageCount: 0,
      isActive: isFirst,
    };
    writeList(RESUMES_KEY, [...resumes, record]);
    return record;
  }

  async setActiveResume(id: string): Promise<void> {
    const resumes = readList<ResumeRecord>(RESUMES_KEY);
    writeList(
      RESUMES_KEY,
      resumes.map((resume) => ({ ...resume, isActive: resume.id === id })),
    );
  }

  async deleteResume(id: string): Promise<void> {
    const resumes = readList<ResumeRecord>(RESUMES_KEY);
    writeList(RESUMES_KEY, resumes.filter((resume) => resume.id !== id));
  }

  async incrementResumeUsage(id: string): Promise<void> {
    const resumes = readList<ResumeRecord>(RESUMES_KEY);
    writeList(
      RESUMES_KEY,
      resumes.map((resume) =>
        resume.id === id ? { ...resume, usageCount: resume.usageCount + 1 } : resume,
      ),
    );
  }

  async listRuns(): Promise<RunRecord[]> {
    return readList<RunRecord>(RUNS_KEY).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveRun(input: NewRunInput): Promise<RunRecord> {
    const runs = readList<RunRecord>(RUNS_KEY);
    const record: RunRecord = {
      ...input,
      id: makeId(),
      createdAt: new Date().toISOString(),
    };
    writeList(RUNS_KEY, [...runs, record]);
    return record;
  }

  async updateRunStatus(id: string, status: RunStatus): Promise<void> {
    const runs = readList<RunRecord>(RUNS_KEY);
    writeList(
      RUNS_KEY,
      runs.map((run) => (run.id === id ? { ...run, status } : run)),
    );
  }
}
