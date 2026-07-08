import type { ReviseSectionResult } from "./types";

export const revisionBoundaryInstruction = [
  "You are an inline resume section revision tool.",
  "Only revise the currently selected resume section according to the user's instruction.",
  "Do not answer general questions, product support questions, UI/UX feedback, coding questions, career coaching questions, or unrelated requests.",
  "If the request is not an instruction to revise the selected resume section, return {\"type\":\"out_of_scope\",\"text\":\"\"}.",
  "If valid, return {\"type\":\"revision\",\"text\":\"REVISED_SECTION_TEXT\"}.",
  "Do not fabricate employers, titles, dates, degrees, certifications, tools, metrics, responsibilities, or achievements.",
  "Return valid JSON only. Do not wrap it in Markdown.",
].join(" ");

export function isLikelyOutOfScopeRevisionInstruction(instruction: string): boolean {
  const value = instruction.trim().toLowerCase();
  if (!value) return false;

  const resumeSignals = [
    "resume",
    "section",
    "summary",
    "skill",
    "skills",
    "experience",
    "education",
    "project",
    "projects",
    "award",
    "awards",
    "certification",
    "certifications",
    "bullet",
    "bullets",
    "ats",
    "keyword",
    "keywords",
  ];
  const editSignals = [
    "rewrite",
    "revise",
    "improve",
    "shorten",
    "expand",
    "condense",
    "make",
    "turn",
    "convert",
    "format",
    "categorize",
    "category",
    "tailor",
    "tone",
    "grammar",
    "professional",
    "concise",
    "add",
    "remove",
    "replace",
    "emphasize",
    "quantify",
    "summarize",
    "fix",
    "polish",
  ];
  const appSupportSignals = [
    "ui",
    "ux",
    "user interface",
    "button",
    "layout",
    "pricing",
    "price",
    "subscription",
    "credit",
    "credits",
    "account",
    "login",
    "sign in",
    "bug",
    "app",
    "website",
    "code",
    "react",
    "javascript",
    "typescript",
    "clerk",
    "stripe",
    "cloudflare",
    "download",
    "export",
  ];

  const hasResumeSignal = resumeSignals.some((signal) => value.includes(signal));
  const hasEditSignal = editSignals.some((signal) => value.includes(signal));
  const hasAppSupportSignal = appSupportSignals.some((signal) => value.includes(signal));
  const looksLikeQuestion = /^(what|why|how|where|when|who|can|could|should|do|does|is|are)\b/.test(
    value,
  );
  const words = value
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (hasAppSupportSignal && !hasResumeSignal) return true;
  if (looksLikeQuestion && !hasEditSignal && !hasResumeSignal) return true;
  if (!hasEditSignal && !hasResumeSignal) return true;
  if (words.some(isLikelyGarbageWord)) return true;

  return false;
}

export function parseReviseSectionResult(rawText: string): ReviseSectionResult {
  const text = rawText.trim();
  if (!text) throw new Error("The model returned an empty revision response.");
  if (text === "OUT_OF_SCOPE") return { type: "out_of_scope" };

  const jsonText = stripJsonFence(text);
  const parsed = JSON.parse(jsonText) as Partial<ReviseSectionResult> & { text?: unknown };

  if (parsed.type === "out_of_scope") {
    return { type: "out_of_scope" };
  }

  if (parsed.type === "revision" && typeof parsed.text === "string" && parsed.text.trim()) {
    return {
      type: "revision",
      text: parsed.text.trim(),
    };
  }

  throw new Error("The model returned an invalid revision response.");
}

function stripJsonFence(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match?.[1]?.trim() ?? trimmed;
}

function isLikelyGarbageWord(word: string): boolean {
  const letters = word.replace(/[^a-z]/g, "");
  if (letters.length < 8) return false;

  const vowelCount = (letters.match(/[aeiou]/g) ?? []).length;
  const vowelRatio = vowelCount / letters.length;
  const uniqueLetters = new Set(letters).size;

  return vowelRatio < 0.12 || uniqueLetters <= 4;
}
