export type ExperienceRole = {
  id: string;
  title: string;
  company: string;
  location: string;
  dates: string;
  bullets: string[];
};

export type StructuredResumeSection = {
  id: string;
  type: string;
  title: string;
  content: string;
  order: number;
};

export type StructuredResume = {
  summary: string;
  experience: ExperienceRole[];
  skills: string[];
  education: string[];
  sections?: StructuredResumeSection[];
};

export type KeywordScore = {
  matched: string[];
  missing: string[];
  total: number;
  ratio: number;
};

export type ResumeReviewSnapshot = {
  optimizedResumeText: string;
  beforeScore: number;
  score: number;
  matchedKeywords: string[];
  partialKeywords: string[];
  missingKeywords: string[];
};

export const emptyResume: StructuredResume = {
  summary: "",
  experience: [],
  skills: [],
  education: [],
};

const STOP_WORDS = new Set([
  "about",
  "above",
  "after",
  "again",
  "against",
  "also",
  "because",
  "been",
  "being",
  "between",
  "both",
  "cannot",
  "could",
  "each",
  "from",
  "have",
  "into",
  "more",
  "most",
  "other",
  "over",
  "same",
  "such",
  "than",
  "that",
  "their",
  "then",
  "there",
  "these",
  "they",
  "this",
  "through",
  "under",
  "very",
  "were",
  "what",
  "when",
  "where",
  "which",
  "while",
  "with",
  "work",
  "will",
  "your",
  "you",
  "our",
  "and",
  "for",
  "the",
  "are",
  "job",
  "role",
  "team",
  "candidate",
]);

export function normalizeStructuredResume(input: unknown): StructuredResume {
  if (!isRecord(input)) return emptyResume;

  return {
    summary: asText(input.summary),
    experience: normalizeExperience(input.experience),
    skills: normalizeStringList(input.skills),
    education: normalizeStringList(input.education),
    sections: normalizeStructuredResumeSections(input.sections),
  };
}

export function parseResumeJson(raw: string): StructuredResume {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] ?? trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error("The model did not return a JSON object.");
  }

  const jsonText = candidate.slice(firstBrace, lastBrace + 1);
  return normalizeStructuredResume(JSON.parse(jsonText));
}

export function resumeToPlainText(resume: StructuredResume): string {
  if (resume.sections?.length) {
    return resume.sections
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((section) => {
        const title = section.title.trim();
        const content = section.content.trim();
        if (!title) return content;
        if (!content) return title;
        return `${title}\n${content}`;
      })
      .filter(Boolean)
      .join("\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  const lines: string[] = [];

  if (resume.summary.trim()) {
    lines.push("SUMMARY", resume.summary.trim(), "");
  }

  if (resume.experience.length > 0) {
    lines.push("EXPERIENCE");
    for (const role of resume.experience) {
      const heading = [role.title, role.company, role.location, role.dates]
        .map((part) => part.trim())
        .filter(Boolean)
        .join(" | ");
      if (heading) lines.push(heading);
      for (const bullet of role.bullets) {
        if (bullet.trim()) lines.push(`- ${bullet.trim()}`);
      }
      lines.push("");
    }
  }

  if (resume.skills.length > 0) {
    lines.push("SKILLS", resume.skills.join(", "), "");
  }

  if (resume.education.length > 0) {
    lines.push("EDUCATION", ...resume.education, "");
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildResumeReviewSnapshot({
  jobDescription,
  originalResumeText,
  optimizedResume,
}: {
  jobDescription: string;
  originalResumeText: string;
  optimizedResume: StructuredResume;
}): ResumeReviewSnapshot {
  const optimizedResumeText = resumeToPlainText(optimizedResume);
  const originalScore = scoreKeywordDetails(jobDescription, originalResumeText);
  const optimizedScore = scoreKeywordDetails(jobDescription, optimizedResumeText);
  const partialKeywords = getPartialKeywords(optimizedScore.missing, optimizedResumeText);
  const missingKeywords = optimizedScore.missing.filter((keyword) => !partialKeywords.includes(keyword));

  return {
    optimizedResumeText,
    beforeScore: Math.round(originalScore.ratio * 100),
    score: Math.round(optimizedScore.ratio * 100),
    matchedKeywords: optimizedScore.matched,
    partialKeywords,
    missingKeywords,
  };
}

export function scoreKeywords(jobDescription: string, resumeText: string): number {
  return Math.round(scoreKeywordDetails(jobDescription, resumeText).ratio * 100);
}

export function scoreKeywordDetails(jobDescription: string, resumeText: string): KeywordScore {
  const keywords = extractKeywords(jobDescription);
  const haystack = normalizeComparableText(resumeText);
  const matched = keywords.filter((keyword) =>
    haystack.includes(normalizeComparableText(keyword)),
  );
  const missing = keywords.filter((keyword) => !matched.includes(keyword));

  return {
    matched,
    missing,
    total: keywords.length,
    ratio: keywords.length === 0 ? 0 : matched.length / keywords.length,
  };
}

export function getPartialKeywords(keywords: string[], resumeText: string): string[] {
  const haystack = normalizeComparableText(resumeText);
  return keywords.filter((keyword) => {
    const parts = keyword.split(/\s+/).filter((part) => part.length > 3);
    return parts.length > 1 && parts.some((part) => haystack.includes(normalizeComparableText(part)));
  });
}

function extractKeywords(text: string, limit = 36): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized
    .split(" ")
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter((word) => word.length >= 4 && !STOP_WORDS.has(word));

  const phrases = extractFrequentPhrases(words);
  const counts = new Map<string, number>();

  for (const word of words) counts.set(word, (counts.get(word) ?? 0) + 1);
  for (const phrase of phrases) counts.set(phrase, (counts.get(phrase) ?? 0) + 2);

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

function extractFrequentPhrases(words: string[]): string[] {
  const phrases = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i += 1) {
    const pair = `${words[i]} ${words[i + 1]}`;
    if (STOP_WORDS.has(words[i]) || STOP_WORDS.has(words[i + 1])) continue;
    phrases.set(pair, (phrases.get(pair) ?? 0) + 1);
  }
  return [...phrases.entries()]
    .filter(([, count]) => count > 1)
    .map(([phrase]) => phrase);
}

function normalizeComparableText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9+#.\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeExperience(value: unknown): ExperienceRole[] {
  if (!Array.isArray(value)) return [];

  return value.map((item, index) => {
    const record = isRecord(item) ? item : {};
    return {
      id: asText(record.id) || `role-${index + 1}`,
      title: asText(record.title),
      company: asText(record.company),
      location: asText(record.location),
      dates: asText(record.dates),
      bullets: normalizeStringList(record.bullets),
    };
  });
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(asText).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeStructuredResumeSections(value: unknown): StructuredResumeSection[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const sections = value
    .map((item, index): StructuredResumeSection | null => {
      if (!isRecord(item)) return null;
      const title = asText(item.title) || "Section";
      const content = asText(item.content);
      if (!title && !content) return null;

      return {
        id: asText(item.id) || `section-${index}`,
        type: asText(item.type) || "custom",
        title,
        content,
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
      };
    })
    .filter((section): section is StructuredResumeSection => Boolean(section))
    .sort((left, right) => left.order - right.order)
    .map((section, index) => ({ ...section, order: index }));

  return sections.length > 0 ? sections : undefined;
}

function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
