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
  contentKind?: "paragraph" | "bullets";
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

export type DiffToken = {
  value: string;
  type: "same" | "added" | "removed";
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
  if (!isRecord(input)) {
    return emptyResume;
  }

  return {
    summary: asText(input.summary),
    experience: normalizeExperience(input.experience),
    skills: normalizeStringList(input.skills),
    education: normalizeStringList(input.education),
    sections: normalizeStructuredResumeSections(input.sections),
  };
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
      if (heading) {
        lines.push(heading);
      }
      for (const bullet of role.bullets) {
        if (bullet.trim()) {
          lines.push(`- ${bullet.trim()}`);
        }
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

export function extractKeywords(text: string, limit = 36): string[] {
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

  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  for (const phrase of phrases) {
    counts.set(phrase, (counts.get(phrase) ?? 0) + 2);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([keyword]) => keyword);
}

export function scoreKeywords(jobDescription: string, resumeText: string): KeywordScore {
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

export function diffWords(before: string, after: string): DiffToken[] {
  const left = tokenizeForDiff(before);
  const right = tokenizeForDiff(after);
  const table = buildLcsTable(left, right);
  const tokens: DiffToken[] = [];
  let i = left.length;
  let j = right.length;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && left[i - 1] === right[j - 1]) {
      tokens.unshift({ value: left[i - 1], type: "same" });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || table[i][j - 1] >= table[i - 1][j])) {
      tokens.unshift({ value: right[j - 1], type: "added" });
      j -= 1;
    } else if (i > 0) {
      tokens.unshift({ value: left[i - 1], type: "removed" });
      i -= 1;
    }
  }

  return coalesceDiffTokens(tokens);
}

export function replaceSection(
  resume: StructuredResume,
  sectionId: string,
  value: string,
): StructuredResume {
  if (resume.sections?.some((section) => section.id === sectionId)) {
    return {
      ...resume,
      sections: resume.sections.map((section) =>
        section.id === sectionId ? { ...section, content: value } : section,
      ),
    };
  }

  if (sectionId === "summary") {
    return { ...resume, summary: value };
  }
  if (sectionId === "skills") {
    return {
      ...resume,
      skills: value
        .split(/,|\n/)
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }
  if (sectionId === "education") {
    return {
      ...resume,
      education: value
        .split("\n")
        .map((item) => item.trim())
        .filter(Boolean),
    };
  }
  if (sectionId === "experience") {
    return {
      ...resume,
      experience: parseExperienceSectionText(value, resume.experience),
    };
  }
  if (sectionId.startsWith("experience:")) {
    const roleId = sectionId.replace("experience:", "");
    return {
      ...resume,
      experience: resume.experience.map((role) =>
        role.id === roleId ? parseExperienceRoleText(value, role) : role,
      ),
    };
  }

  return resume;
}

export function sectionText(resume: StructuredResume, sectionId: string): string {
  const documentSection = resume.sections?.find((section) => section.id === sectionId);
  if (documentSection) {
    return documentSection.content;
  }

  if (sectionId === "summary") {
    return resume.summary;
  }
  if (sectionId === "skills") {
    return resume.skills.join(", ");
  }
  if (sectionId === "education") {
    return resume.education.join("\n");
  }
  if (sectionId.startsWith("experience:")) {
    const roleId = sectionId.replace("experience:", "");
    const role = resume.experience.find((item) => item.id === roleId);
    return role ? experienceRoleToText(role) : "";
  }
  if (sectionId === "experience") {
    return resume.experience.map(experienceRoleToText).filter(Boolean).join("\n\n");
  }
  return "";
}

export function experienceRoleToText(role: ExperienceRole): string {
  return [
    `Title: ${role.title}`,
    `Company: ${role.company}`,
    `Location: ${role.location}`,
    `Dates: ${role.dates}`,
    ...role.bullets.map((bullet) => `- ${bullet}`),
  ]
    .filter((line) => line.replace(/^[A-Za-z]+:\s*/, "").trim())
    .join("\n");
}

function normalizeExperience(value: unknown): ExperienceRole[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item, index) => {
    if (!isRecord(item)) {
      return {
        id: `role-${index + 1}`,
        title: asText(item),
        company: "",
        location: "",
        dates: "",
        bullets: [],
      };
    }

    return {
      id: asText(item.id) || `role-${index + 1}`,
      title: asText(item.title),
      company: asText(item.company),
      location: asText(item.location),
      dates: asText(item.dates),
      bullets: normalizeStringList(item.bullets),
    };
  });
}

function normalizeStructuredResumeSections(value: unknown): StructuredResumeSection[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const sections = value
    .map((item, index): StructuredResumeSection | null => {
      if (!isRecord(item)) return null;
      const content = asText(item.content);
      const title = asText(item.title) || "Section";
      if (!content && !title) return null;
      return {
        id: asText(item.id) || `section-${index}`,
        type: asText(item.type) || "custom",
        title,
        content,
        contentKind: normalizeSectionContentKind(item.contentKind),
        order: Number.isFinite(Number(item.order)) ? Number(item.order) : index,
      };
    })
    .filter((section): section is StructuredResumeSection => Boolean(section))
    .sort((left, right) => left.order - right.order)
    .map((section, index) => ({ ...section, order: index }));

  return sections.length > 0 ? sections : undefined;
}

function normalizeSectionContentKind(value: unknown): "paragraph" | "bullets" | undefined {
  return value === "paragraph" || value === "bullets" ? value : undefined;
}

function normalizeStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(asText).map((item) => item.trim()).filter(Boolean);
  }
  const text = asText(value);
  if (!text) {
    return [];
  }
  return text
    .split(/\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function linesToBullets(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function parseExperienceRoleText(value: string, fallback: ExperienceRole): ExperienceRole {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const nextRole = { ...fallback, bullets: [] as string[] };
  const bulletLines: string[] = [];

  for (const line of lines) {
    const fieldMatch = line.match(/^(title|company|location|dates):\s*(.*)$/i);
    if (fieldMatch) {
      const [, field, fieldValue] = fieldMatch;
      if (field.toLowerCase() === "title") {
        nextRole.title = fieldValue.trim();
      }
      if (field.toLowerCase() === "company") {
        nextRole.company = fieldValue.trim();
      }
      if (field.toLowerCase() === "location") {
        nextRole.location = fieldValue.trim();
      }
      if (field.toLowerCase() === "dates") {
        nextRole.dates = fieldValue.trim();
      }
    } else {
      bulletLines.push(line);
    }
  }

  nextRole.bullets = bulletLines.length > 0 ? linesToBullets(bulletLines.join("\n")) : fallback.bullets;
  return nextRole;
}

function parseExperienceSectionText(value: string, fallbackRoles: ExperienceRole[]): ExperienceRole[] {
  const blocks = value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  if (blocks.length === 0) return [];

  return blocks.map((block, index) => {
    const fallback =
      fallbackRoles[index] ?? {
        id: `role-${index + 1}`,
        title: "",
        company: "",
        location: "",
        dates: "",
        bullets: [],
      };

    return {
      ...parseExperienceRoleText(block, fallback),
      id: fallback.id || `role-${index + 1}`,
    };
  });
}

function asText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeComparableText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFrequentPhrases(words: string[]): string[] {
  const phrases = new Map<string, number>();
  for (let i = 0; i < words.length - 1; i += 1) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    if (words[i].length >= 4 && words[i + 1].length >= 4) {
      phrases.set(phrase, (phrases.get(phrase) ?? 0) + 1);
    }
  }

  return [...phrases.entries()]
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([phrase]) => phrase);
}

function tokenizeForDiff(value: string): string[] {
  return value.match(/\S+\s*/g) ?? [];
}

function buildLcsTable(left: string[], right: string[]): number[][] {
  const table = Array.from({ length: left.length + 1 }, () =>
    Array.from({ length: right.length + 1 }, () => 0),
  );

  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      table[i][j] =
        left[i - 1] === right[j - 1]
          ? table[i - 1][j - 1] + 1
          : Math.max(table[i - 1][j], table[i][j - 1]);
    }
  }

  return table;
}

function coalesceDiffTokens(tokens: DiffToken[]): DiffToken[] {
  return tokens.reduce<DiffToken[]>((merged, token) => {
    const last = merged.at(-1);
    if (last?.type === token.type) {
      last.value += token.value;
    } else {
      merged.push({ ...token });
    }
    return merged;
  }, []);
}
