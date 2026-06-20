import { cloudflareBlobRequest, cloudflareRequest } from "../cloudflare/client";
import type {
  ExportType,
  NewResumeInput,
  NewRunInput,
  ResumeRecord,
  RunRecord,
  RunStatus,
  StorageAdapter,
} from "./types";

export class CloudflareStorageAdapter implements StorageAdapter {
  async listResumes(): Promise<ResumeRecord[]> {
    const data = await cloudflareRequest<{ resumes?: ResumeRecord[] }>("/api/resumes");
    return data.resumes ?? [];
  }

  async saveResume(input: NewResumeInput): Promise<ResumeRecord> {
    const formData = new FormData();
    formData.set("name", input.name);
    formData.set("fileType", input.fileType);
    formData.set("text", input.text);
    formData.set("characterCount", String(input.characterCount));
    if (input.templateId) {
      formData.set("templateId", input.templateId);
    }
    if (input.versionType) {
      formData.set("versionType", input.versionType);
    }
    if (input.sourceResumeId) {
      formData.set("sourceResumeId", input.sourceResumeId);
    }
    if (input.sourceRunId) {
      formData.set("sourceRunId", input.sourceRunId);
    }
    if (input.tailoredFor) {
      formData.set("tailoredFor", input.tailoredFor);
    }
    if (typeof input.matchScore === "number") {
      formData.set("matchScore", String(input.matchScore));
    }
    if (input.file) {
      formData.set("file", input.file);
    }

    const data = await cloudflareRequest<{ resume?: ResumeRecord }>("/api/resumes", {
      method: "POST",
      formData,
    });

    if (!data.resume) throw new Error("The backend did not return the saved resume.");
    return data.resume;
  }

  async setActiveResume(id: string): Promise<void> {
    await cloudflareRequest(`/api/resumes/${encodeURIComponent(id)}/active`, {
      method: "PATCH",
    });
  }

  async updateResumeText(id: string, text: string): Promise<ResumeRecord> {
    const data = await cloudflareRequest<{ resume?: ResumeRecord }>(
      `/api/resumes/${encodeURIComponent(id)}/text`,
      {
        method: "PATCH",
        body: { text },
      },
    );

    if (!data.resume) throw new Error("The backend did not return the updated resume.");
    return data.resume;
  }

  async updateResumeTemplate(id: string, templateId: string): Promise<ResumeRecord> {
    const data = await cloudflareRequest<{ resume?: ResumeRecord }>(
      `/api/resumes/${encodeURIComponent(id)}/template`,
      {
        method: "PATCH",
        body: { templateId },
      },
    );

    if (!data.resume) throw new Error("The backend did not return the updated resume.");
    return data.resume;
  }

  async getResumeFile(id: string): Promise<Blob> {
    return cloudflareBlobRequest(`/api/resumes/${encodeURIComponent(id)}/file`);
  }

  async deleteResume(id: string): Promise<void> {
    await cloudflareRequest(`/api/resumes/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  }

  async incrementResumeUsage(id: string): Promise<void> {
    await cloudflareRequest(`/api/resumes/${encodeURIComponent(id)}/usage`, {
      method: "PATCH",
    });
  }

  async listRuns(): Promise<RunRecord[]> {
    const data = await cloudflareRequest<{ runs?: RunRecord[] }>("/api/runs");
    return data.runs ?? [];
  }

  async saveRun(input: NewRunInput): Promise<RunRecord> {
    const data = await cloudflareRequest<{ run?: RunRecord }>("/api/runs", {
      method: "POST",
      body: input,
    });

    if (!data.run) throw new Error("The backend did not return the saved run.");
    return data.run;
  }

  async updateRunStatus(id: string, status: RunStatus): Promise<void> {
    await cloudflareRequest(`/api/runs/${encodeURIComponent(id)}/status`, {
      method: "PATCH",
      body: { status },
    });
  }

  async recordExport(runId: string, exportType: ExportType): Promise<void> {
    await cloudflareRequest("/api/exports", {
      method: "POST",
      body: { runId, exportType },
    });
  }
}
