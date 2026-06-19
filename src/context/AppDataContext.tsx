import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { useAuth } from "./AuthContext";
import { CloudflareStorageAdapter } from "../lib/storage/cloudflareAdapter";
import type {
  NewResumeInput,
  NewRunInput,
  ExportType,
  ResumeRecord,
  RunRecord,
  RunStatus,
  StorageAdapter,
} from "../lib/storage";

type AppDataContextValue = {
  resumes: ResumeRecord[];
  runs: RunRecord[];
  isLoading: boolean;
  activeResume: ResumeRecord | null;
  addResume: (input: NewResumeInput) => Promise<ResumeRecord>;
  getResumeFile: (id: string) => Promise<Blob>;
  setActiveResume: (id: string) => Promise<void>;
  deleteResume: (id: string) => Promise<void>;
  incrementResumeUsage: (id: string) => Promise<void>;
  addRun: (input: NewRunInput) => Promise<RunRecord>;
  updateRunStatus: (id: string, status: RunStatus) => Promise<void>;
  recordExport: (runId: string, exportType: ExportType) => Promise<void>;
  refresh: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);
const storage: StorageAdapter = new CloudflareStorageAdapter();

export function AppDataProvider({ children }: { children: ReactNode }) {
  const { isConfigured: hasBackend, isLoading: isAuthLoading, user } = useAuth();
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!hasBackend || !user) {
      setResumes([]);
      setRuns([]);
      return;
    }

    const [nextResumes, nextRuns] = await Promise.all([storage.listResumes(), storage.listRuns()]);
    setResumes(nextResumes);
    setRuns(nextRuns);
  }, [hasBackend, user]);

  useEffect(() => {
    if (isAuthLoading) {
      setIsLoading(true);
      return;
    }

    let active = true;
    (async () => {
      try {
        await refresh();
      } finally {
        if (active) setIsLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [isAuthLoading, refresh]);

  async function addResume(input: NewResumeInput) {
    requireBackendUser();
    const record = await storage.saveResume(input);
    await refresh();
    return record;
  }

  async function getResumeFile(id: string) {
    requireBackendUser();
    if (!storage.getResumeFile) {
      throw new Error("Original file preview is not available for this storage mode.");
    }
    return storage.getResumeFile(id);
  }

  async function setActiveResume(id: string) {
    requireBackendUser();
    await storage.setActiveResume(id);
    await refresh();
  }

  async function deleteResume(id: string) {
    requireBackendUser();
    await storage.deleteResume(id);
    await refresh();
  }

  async function incrementResumeUsage(id: string) {
    requireBackendUser();
    await storage.incrementResumeUsage(id);
    await refresh();
  }

  async function addRun(input: NewRunInput) {
    requireBackendUser();
    const record = await storage.saveRun(input);
    await refresh();
    return record;
  }

  async function updateRunStatus(id: string, status: RunStatus) {
    requireBackendUser();
    await storage.updateRunStatus(id, status);
    await refresh();
  }

  async function recordExport(runId: string, exportType: ExportType) {
    requireBackendUser();
    await storage.recordExport(runId, exportType);
    await refresh();
  }

  const activeResume = resumes.find((resume) => resume.isActive) ?? null;

  function requireBackendUser() {
    if (!hasBackend) {
      throw new Error("Cloudflare API is not configured. Set VITE_CLOUDFLARE_API_URL.");
    }
    if (!user) {
      throw new Error("Sign in before continuing.");
    }
  }

  const value: AppDataContextValue = {
    resumes,
    runs,
    isLoading,
    activeResume,
    addResume,
    getResumeFile,
    setActiveResume,
    deleteResume,
    incrementResumeUsage,
    addRun,
    updateRunStatus,
    recordExport,
    refresh,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within an AppDataProvider");
  return ctx;
}
