import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { storage } from "../lib/storage";
import type {
  NewResumeInput,
  NewRunInput,
  ResumeRecord,
  RunRecord,
  RunStatus,
} from "../lib/storage";

type AppDataContextValue = {
  resumes: ResumeRecord[];
  runs: RunRecord[];
  isLoading: boolean;
  activeResume: ResumeRecord | null;
  addResume: (input: NewResumeInput) => Promise<ResumeRecord>;
  setActiveResume: (id: string) => Promise<void>;
  deleteResume: (id: string) => Promise<void>;
  incrementResumeUsage: (id: string) => Promise<void>;
  addRun: (input: NewRunInput) => Promise<RunRecord>;
  updateRunStatus: (id: string, status: RunStatus) => Promise<void>;
  refresh: () => Promise<void>;
};

const AppDataContext = createContext<AppDataContextValue | null>(null);

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [resumes, setResumes] = useState<ResumeRecord[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    const [nextResumes, nextRuns] = await Promise.all([storage.listResumes(), storage.listRuns()]);
    setResumes(nextResumes);
    setRuns(nextRuns);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      await refresh();
      if (active) setIsLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  async function addResume(input: NewResumeInput) {
    const record = await storage.saveResume(input);
    await refresh();
    return record;
  }

  async function setActiveResume(id: string) {
    await storage.setActiveResume(id);
    await refresh();
  }

  async function deleteResume(id: string) {
    await storage.deleteResume(id);
    await refresh();
  }

  async function incrementResumeUsage(id: string) {
    await storage.incrementResumeUsage(id);
    await refresh();
  }

  async function addRun(input: NewRunInput) {
    const record = await storage.saveRun(input);
    await refresh();
    return record;
  }

  async function updateRunStatus(id: string, status: RunStatus) {
    await storage.updateRunStatus(id, status);
    await refresh();
  }

  const activeResume = resumes.find((resume) => resume.isActive) ?? null;

  const value: AppDataContextValue = {
    resumes,
    runs,
    isLoading,
    activeResume,
    addResume,
    setActiveResume,
    deleteResume,
    incrementResumeUsage,
    addRun,
    updateRunStatus,
    refresh,
  };

  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useAppData must be used within an AppDataProvider");
  return ctx;
}
