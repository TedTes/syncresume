import type {
  NewResumeInput,
  NewRunInput,
  ResumeRecord,
  RunRecord,
  RunStatus,
  StorageAdapter,
} from "./types";
import { getSupabaseClient, SUPABASE_RESUME_BUCKET } from "../supabase/client";
import type { Database } from "../supabase/database.types";

type ResumeRow = Database["public"]["Tables"]["resumes"]["Row"];
type RunRow = Database["public"]["Tables"]["optimization_runs"]["Row"];

function makeId(): string {
  return typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sanitizeFileName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-") || "resume.txt";
}

function mapResume(row: ResumeRow): ResumeRecord {
  return {
    id: row.id,
    name: row.name,
    fileType: row.file_type,
    text: row.extracted_text,
    characterCount: row.character_count,
    uploadedAt: row.uploaded_at,
    usageCount: row.usage_count,
    isActive: row.is_active,
  };
}

function mapRun(row: RunRow): RunRecord {
  return {
    id: row.id,
    title: row.title,
    resumeId: row.resume_id,
    resumeName: row.resume_name,
    jobDescription: row.job_description,
    score: row.score,
    status: row.status,
    createdAt: row.created_at,
  };
}

function textUploadFor(input: NewResumeInput): Blob {
  return new Blob([input.text], { type: "text/plain" });
}

export class SupabaseStorageAdapter implements StorageAdapter {
  private async currentUserId(): Promise<string | null> {
    const { data, error } = await getSupabaseClient().auth.getUser();
    if (error) throw new Error(error.message);
    return data.user?.id ?? null;
  }

  private async requireUserId(): Promise<string> {
    const userId = await this.currentUserId();
    if (!userId) throw new Error("Sign in to sync resumes and run history.");
    return userId;
  }

  async listResumes(): Promise<ResumeRecord[]> {
    const userId = await this.currentUserId();
    if (!userId) return [];

    const { data, error } = await getSupabaseClient()
      .from("resumes")
      .select("*")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapResume);
  }

  async saveResume(input: NewResumeInput): Promise<ResumeRecord> {
    const userId = await this.requireUserId();
    const supabase = getSupabaseClient();
    const id = makeId();
    const safeName = sanitizeFileName(input.name);
    const storagePath = `${userId}/${id}/${safeName}`;

    const { count, error: countError } = await supabase
      .from("resumes")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    if (countError) throw new Error(countError.message);

    const uploadBody = input.file ?? textUploadFor(input);
    const uploadType = input.file?.type || "text/plain";

    const { error: uploadError } = await supabase.storage
      .from(SUPABASE_RESUME_BUCKET)
      .upload(storagePath, uploadBody, { contentType: uploadType, upsert: false });

    if (uploadError) throw new Error(uploadError.message);

    const { data, error } = await supabase
      .from("resumes")
      .insert({
        id,
        user_id: userId,
        name: input.name,
        file_type: input.fileType,
        storage_path: storagePath,
        extracted_text: input.text,
        character_count: input.characterCount,
        is_active: count === 0,
      })
      .select("*")
      .single();

    if (error) {
      await supabase.storage.from(SUPABASE_RESUME_BUCKET).remove([storagePath]);
      throw new Error(error.message);
    }

    return mapResume(data);
  }

  async setActiveResume(id: string): Promise<void> {
    const userId = await this.requireUserId();
    const supabase = getSupabaseClient();

    const { error: clearError } = await supabase
      .from("resumes")
      .update({ is_active: false })
      .eq("user_id", userId);

    if (clearError) throw new Error(clearError.message);

    const { error } = await supabase
      .from("resumes")
      .update({ is_active: true })
      .eq("user_id", userId)
      .eq("id", id);

    if (error) throw new Error(error.message);
  }

  async deleteResume(id: string): Promise<void> {
    const userId = await this.requireUserId();
    const supabase = getSupabaseClient();

    const { data: resume, error: fetchError } = await supabase
      .from("resumes")
      .select("storage_path")
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle();

    if (fetchError) throw new Error(fetchError.message);

    const { error } = await supabase.from("resumes").delete().eq("user_id", userId).eq("id", id);
    if (error) throw new Error(error.message);

    if (resume?.storage_path) {
      await supabase.storage.from(SUPABASE_RESUME_BUCKET).remove([resume.storage_path]);
    }
  }

  async incrementResumeUsage(id: string): Promise<void> {
    const userId = await this.requireUserId();
    const supabase = getSupabaseClient();

    const { data, error: fetchError } = await supabase
      .from("resumes")
      .select("usage_count")
      .eq("user_id", userId)
      .eq("id", id)
      .single();

    if (fetchError) throw new Error(fetchError.message);

    const { error } = await supabase
      .from("resumes")
      .update({ usage_count: data.usage_count + 1 })
      .eq("user_id", userId)
      .eq("id", id);

    if (error) throw new Error(error.message);
  }

  async listRuns(): Promise<RunRecord[]> {
    const userId = await this.currentUserId();
    if (!userId) return [];

    const { data, error } = await getSupabaseClient()
      .from("optimization_runs")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);
    return (data ?? []).map(mapRun);
  }

  async saveRun(input: NewRunInput): Promise<RunRecord> {
    const userId = await this.requireUserId();

    const { data, error } = await getSupabaseClient()
      .from("optimization_runs")
      .insert({
        user_id: userId,
        resume_id: input.resumeId,
        resume_name: input.resumeName,
        title: input.title,
        job_description: input.jobDescription,
        score: input.score,
        status: input.status,
      })
      .select("*")
      .single();

    if (error) throw new Error(error.message);
    return mapRun(data);
  }

  async updateRunStatus(id: string, status: RunStatus): Promise<void> {
    const userId = await this.requireUserId();

    const { error } = await getSupabaseClient()
      .from("optimization_runs")
      .update({ status })
      .eq("user_id", userId)
      .eq("id", id);

    if (error) throw new Error(error.message);
  }
}
