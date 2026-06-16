import { errorResponse, handleCors, jsonResponse } from "../_shared/cors.ts";
import { reviseResumeSection } from "../_shared/openai.ts";
import { normalizeStructuredResume } from "../_shared/resume.ts";
import { requireUserId } from "../_shared/supabase.ts";

type ReviseRequestBody = {
  provider?: string;
  jobDescription?: string;
  resume?: unknown;
  sectionLabel?: string;
  sectionText?: string;
  instruction?: string;
};

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  if (req.method !== "POST") {
    return errorResponse("Method not allowed.", 405);
  }

  try {
    await requireUserId(req);

    const body = (await req.json().catch(() => ({}))) as ReviseRequestBody;
    const provider = body.provider ?? "openai";
    const jobDescription = body.jobDescription?.trim() ?? "";
    const instruction = body.instruction?.trim() ?? "";
    const sectionText = body.sectionText?.trim() ?? "";
    const sectionLabel = body.sectionLabel?.trim() || "Resume section";

    if (provider !== "openai") {
      return errorResponse(`${provider} section revision is not wired on the server yet.`, 400);
    }

    if (!instruction) {
      return errorResponse("Add a revision instruction before submitting.", 400);
    }

    if (jobDescription.length < 20 || sectionText.length < 5) {
      return errorResponse("Missing job description or section text.", 400);
    }

    const revisedText = await reviseResumeSection({
      jobDescription,
      resume: normalizeStructuredResume(body.resume),
      sectionLabel,
      sectionText,
      instruction,
    });

    return jsonResponse({ revisedText });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Revision failed.", 500);
  }
});
