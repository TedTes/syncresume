import type {
  NewResumeInput,
  NewRunInput,
  ResumeRecord,
  RunRecord,
  RunStatus,
  StorageAdapter,
} from "./types";

/**
 * TODO: Intended production backend — not wired up yet.
 *
 * Planned shape:
 * - Resume files live in a Supabase Storage bucket (S3-compatible). Upload
 *   the raw PDF/DOCX there; keep extracted plain text in a `resumes` table
 *   row alongside the storage object path.
 * - Run history is written by an edge function (`/functions/v1/runs`) so the
 *   optimization call, scoring, and persistence happen server-side — this is
 *   also where the real LLM provider calls (Anthropic/OpenAI/Gemini) should
 *   move to, keeping API keys off the client entirely.
 * - `setActiveResume` / `incrementResumeUsage` become row updates guarded by
 *   row-level security tied to the authenticated user.
 *
 * To activate: implement the methods below against `@supabase/supabase-js`,
 * then point `src/lib/storage/index.ts` at `new SupabaseStorageAdapter()`
 * instead of `LocalStorageAdapter`. No other file should need to change —
 * that's the point of the `StorageAdapter` interface.
 */
export class SupabaseStorageAdapter implements StorageAdapter {
  listResumes(): Promise<ResumeRecord[]> {
    throw new Error("SupabaseStorageAdapter is not implemented yet.");
  }

  saveResume(_input: NewResumeInput): Promise<ResumeRecord> {
    throw new Error("SupabaseStorageAdapter is not implemented yet.");
  }

  setActiveResume(_id: string): Promise<void> {
    throw new Error("SupabaseStorageAdapter is not implemented yet.");
  }

  deleteResume(_id: string): Promise<void> {
    throw new Error("SupabaseStorageAdapter is not implemented yet.");
  }

  incrementResumeUsage(_id: string): Promise<void> {
    throw new Error("SupabaseStorageAdapter is not implemented yet.");
  }

  listRuns(): Promise<RunRecord[]> {
    throw new Error("SupabaseStorageAdapter is not implemented yet.");
  }

  saveRun(_input: NewRunInput): Promise<RunRecord> {
    throw new Error("SupabaseStorageAdapter is not implemented yet.");
  }

  updateRunStatus(_id: string, _status: RunStatus): Promise<void> {
    throw new Error("SupabaseStorageAdapter is not implemented yet.");
  }
}
