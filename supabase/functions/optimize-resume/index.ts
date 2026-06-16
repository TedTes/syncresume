import { errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";
import { optimizeResume } from "../_shared/openai.ts";
import { resumeToPlainText, scoreKeywords } from "../_shared/resume.ts";
import { requireUserId } from "../_shared/supabase.ts";

type OptimizeRequestBody = {
  provider?: string;
  resumeId?: string;
  resumeText?: string;
  resumeName?: string;
  jobDescription?: string;
  saveRunHistory?: boolean;
  title?: string;
};

type ResumeRow = {
  id: string;
  name: string;
  extracted_text: string;
  usage_count: number;
};

function deriveRunTitle(jobDescription: string): string {
  const firstLine = jobDescription
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!firstLine) return "Untitled role";
  return firstLine.length > 70 ? `${firstLine.slice(0, 67)}...` : firstLine;
}

function mapRun(row: Record<string, unknown> | null) {
  if (!row) return null;
  return {
    id: String(row.id),
    title: String(row.title),
    resumeId: String(row.resume_id),
    resumeName: String(row.resume_name),
    jobDescription: String(row.job_description),
    score: Number(row.score ?? 0),
    status: row.status === "exported" ? "exported" : "draft",
    createdAt: String(row.created_at),
  };
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  try {
    const body = (await req.json().catch(() => ({}))) as OptimizeRequestBody;
    const provider = body.provider ?? "openai";
    const jobDescription = body.jobDescription?.trim() ?? "";

    if (provider !== "openai") {
      return errorResponse(`${provider} optimization is not wired on the server yet.`, 400);
    }

    if (jobDescription.length < 20) {
      return errorResponse("Paste a complete job description before optimizing.", 400);
    }

    const { supabase, userId } = await requireUserId(req);
    let resumeRow: ResumeRow | null = null;
    let resumeText = body.resumeText?.trim() ?? "";
    let resumeName = body.resumeName?.trim() || "Resume";

    if (body.resumeId) {
      const { data, error } = await supabase
        .from("resumes")
        .select("id, name, extracted_text, usage_count")
        .eq("id", body.resumeId)
        .single();

      if (error) throw new Error(error.message);

      resumeRow = data as ResumeRow;
      resumeText = resumeRow.extracted_text.trim();
      resumeName = resumeRow.name;
    }

    if (resumeText.length < 50) {
      return errorResponse("Upload or paste a readable resume before optimizing.", 400);
    }

    const optimizedResume = await optimizeResume({ jobDescription, resumeText });
    const score = scoreKeywords(jobDescription, resumeToPlainText(optimizedResume));

    if (resumeRow) {
      const { error } = await supabase
        .from("resumes")
        .update({ usage_count: resumeRow.usage_count + 1 })
        .eq("id", resumeRow.id);

      if (error) throw new Error(error.message);
    }

    let run = null;
    if (body.saveRunHistory !== false && resumeRow) {
      const { data, error } = await supabase
        .from("optimization_runs")
        .insert({
          user_id: userId,
          resume_id: resumeRow.id,
          resume_name: resumeName,
          title: body.title?.trim() || deriveRunTitle(jobDescription),
          job_description: jobDescription,
          optimized_resume: optimizedResume,
          score,
          status: "draft",
        })
        .select("*")
        .single();

      if (error) throw new Error(error.message);
      run = mapRun(data);
    }

    return jsonResponse({
      resume: optimizedResume,
      score,
      run,
    });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Optimization failed.", 500);
  }
});
