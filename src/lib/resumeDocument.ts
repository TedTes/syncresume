import type { StructuredResume } from "./resume";

export type ResumeSectionType =
  | "contact"
  | "summary"
  | "skills"
  | "languages"
  | "experience"
  | "education"
  | "certifications"
  | "projects"
  | "awards"
  | "publications"
  | "volunteering"
  | "custom";

export type ResumeSection = {
  id: string;
  type: ResumeSectionType;
  title: string;
  content: string;
  order: number;
};

export type ResumeDocument = {
  id: string;
  title: string;
  sections: ResumeSection[];
};

export const RESUME_SECTION_TYPE_OPTIONS: Array<{
  type: ResumeSectionType;
  title: string;
}> = [
  { type: "contact", title: "Contact" },
  { type: "summary", title: "Summary" },
  { type: "skills", title: "Skills" },
  { type: "experience", title: "Experience" },
  { type: "projects", title: "Projects" },
  { type: "education", title: "Education" },
  { type: "certifications", title: "Certifications" },
  { type: "languages", title: "Languages" },
  { type: "awards", title: "Awards" },
  { type: "publications", title: "Publications" },
  { type: "volunteering", title: "Volunteering" },
  { type: "custom", title: "Custom Section" },
];

const KNOWN_RESUME_HEADINGS: { heading: string; type: ResumeSectionType }[] = [
  { heading: "CONTACT INFORMATION", type: "contact" },
  { heading: "CONTACT", type: "contact" },
  { heading: "PROFESSIONAL SUMMARY", type: "summary" },
  { heading: "EXECUTIVE SUMMARY", type: "summary" },
  { heading: "CAREER SUMMARY", type: "summary" },
  { heading: "PROFESSIONAL PROFILE", type: "summary" },
  { heading: "SUMMARY", type: "summary" },
  { heading: "PROFILE", type: "summary" },
  { heading: "OBJECTIVE", type: "summary" },
  { heading: "CORE COMPETENCIES", type: "skills" },
  { heading: "AREAS OF EXPERTISE", type: "skills" },
  { heading: "TECHNICAL SKILLS", type: "skills" },
  { heading: "TECHNICAL EXPERTISE", type: "skills" },
  { heading: "CORE SKILLS", type: "skills" },
  { heading: "KEY SKILLS", type: "skills" },
  { heading: "TECHNOLOGIES", type: "skills" },
  { heading: "TECH STACK", type: "skills" },
  { heading: "SKILLS", type: "skills" },
  { heading: "SPOKEN LANGUAGES", type: "languages" },
  { heading: "SPEAKING LANGUAGES", type: "languages" },
  { heading: "LANGUAGE PROFICIENCY", type: "languages" },
  { heading: "LANGUAGE SKILLS", type: "languages" },
  { heading: "LANGUAGES", type: "languages" },
  { heading: "LANGUAGE", type: "languages" },
  { heading: "PROFESSIONAL EXPERIENCE", type: "experience" },
  { heading: "RELEVANT EXPERIENCE", type: "experience" },
  { heading: "EMPLOYMENT EXPERIENCE", type: "experience" },
  { heading: "WORK EXPERIENCE", type: "experience" },
  { heading: "WORK HISTORY", type: "experience" },
  { heading: "CAREER HISTORY", type: "experience" },
  { heading: "EXPERIENCE", type: "experience" },
  { heading: "EMPLOYMENT HISTORY", type: "experience" },
  { heading: "PROJECT EXPERIENCE", type: "projects" },
  { heading: "PROJECTS", type: "projects" },
  { heading: "SELECTED PROJECTS", type: "projects" },
  { heading: "EDUCATION AND CERTIFICATIONS", type: "education" },
  { heading: "EDUCATION & CERTIFICATIONS", type: "education" },
  { heading: "EDUCATION AND TRAINING", type: "education" },
  { heading: "EDUCATION", type: "education" },
  { heading: "PROFESSIONAL CERTIFICATIONS", type: "certifications" },
  { heading: "CERTIFICATIONS AND TRAINING", type: "certifications" },
  { heading: "LICENSES AND CERTIFICATIONS", type: "certifications" },
  { heading: "LICENSES & CERTIFICATIONS", type: "certifications" },
  { heading: "CERTIFICATIONS", type: "certifications" },
  { heading: "CERTIFICATES", type: "certifications" },
  { heading: "TRAINING", type: "certifications" },
  { heading: "HONORS AND AWARDS", type: "awards" },
  { heading: "HONORS & AWARDS", type: "awards" },
  { heading: "AWARDS", type: "awards" },
  { heading: "PUBLICATIONS", type: "publications" },
  { heading: "COMMUNITY INVOLVEMENT", type: "volunteering" },
  { heading: "VOLUNTEER EXPERIENCE", type: "volunteering" },
  { heading: "VOLUNTEERING", type: "volunteering" },
];

KNOWN_RESUME_HEADINGS.sort((a, b) => b.heading.length - a.heading.length);

const INLINE_AMBIGUOUS_HEADINGS = new Set(["PROFILE"]);

export function inferResumeSectionTypeFromTitle(title: string): ResumeSectionType {
  const normalizedTitle = normalizeResumeSectionTitle(title);
  if (!normalizedTitle) return "custom";

  const matchedHeading = KNOWN_RESUME_HEADINGS.find(
    ({ heading, type }) => type !== "contact" && normalizeResumeSectionTitle(heading) === normalizedTitle,
  );

  return matchedHeading?.type ?? "custom";
}

function normalizeResumeSectionTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function parseResumeDocument(text: string, title = "Extracted resume"): ResumeDocument {
  const normalizedText = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  return {
    id: `document-${hashText(`${title}:${normalizedText}`)}`,
    title,
    sections: parseResumeSections(normalizedText),
  };
}

export function serializeResumeDocument(document: ResumeDocument): string {
  return document.sections
    .sort((a, b) => a.order - b.order)
    .map((section) => {
      const title = section.title.trim();
      const content = section.content.trim();
      if (!title) return content;
      if (!content) return title;
      return `${title}\n${content}`;
    })
    .filter(Boolean)
    .join("\n\n");
}

export function updateResumeDocumentSection(
  document: ResumeDocument,
  sectionId: string,
  content: string,
): ResumeDocument {
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId ? { ...section, content } : section,
    ),
  };
}

export function renameResumeDocumentSection(
  document: ResumeDocument,
  sectionId: string,
  title: string,
): ResumeDocument {
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId ? { ...section, title } : section,
    ),
  };
}

export function addResumeDocumentSection(
  document: ResumeDocument,
  sectionType: ResumeSectionType,
  afterSectionId?: string,
  sectionData: { title?: string; content?: string } = {},
): ResumeDocument {
  const fallbackTitle =
    RESUME_SECTION_TYPE_OPTIONS.find((option) => option.type === sectionType)?.title ??
    "Custom Section";
  const nextSection: ResumeSection = {
    id: `${sectionType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: sectionType,
    title: sectionData.title?.trim() || fallbackTitle,
    content: sectionData.content?.trim() ?? "",
    order: document.sections.length,
  };
  const sections = [...document.sections].sort((a, b) => a.order - b.order);
  const insertIndex = afterSectionId
    ? sections.findIndex((section) => section.id === afterSectionId) + 1
    : sections.length;

  if (insertIndex <= 0 || insertIndex > sections.length) {
    sections.push(nextSection);
  } else {
    sections.splice(insertIndex, 0, nextSection);
  }

  return normalizeResumeDocumentOrder({
    ...document,
    sections,
  });
}

export function removeResumeDocumentSection(
  document: ResumeDocument,
  sectionId: string,
): ResumeDocument {
  return normalizeResumeDocumentOrder({
    ...document,
    sections: document.sections.filter((section) => section.id !== sectionId),
  });
}

export function moveResumeDocumentSection(
  document: ResumeDocument,
  sectionId: string,
  direction: -1 | 1,
): ResumeDocument {
  const sections = [...document.sections].sort((a, b) => a.order - b.order);
  const currentIndex = sections.findIndex((section) => section.id === sectionId);
  const nextIndex = currentIndex + direction;

  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= sections.length) {
    return document;
  }

  const [section] = sections.splice(currentIndex, 1);
  sections.splice(nextIndex, 0, section);

  return normalizeResumeDocumentOrder({
    ...document,
    sections,
  });
}

export function withFallbackContactSection(
  document: ResumeDocument,
  fallbackDocument?: ResumeDocument | null,
): ResumeDocument {
  const hasContactContent = document.sections.some(
    (section) => section.type === "contact" && section.content.trim(),
  );
  if (hasContactContent || !fallbackDocument) return document;

  const fallbackContact = fallbackDocument.sections.find(
    (section) => section.type === "contact" && section.content.trim(),
  );
  if (!fallbackContact) return document;

  const sectionsWithoutEmptyContact = document.sections.filter(
    (section) => section.type !== "contact" || section.content.trim(),
  );

  return {
    ...document,
    sections: [
      {
        ...fallbackContact,
        id: "contact-0",
        order: -1,
      },
      ...sectionsWithoutEmptyContact.map((section) => ({
        ...section,
        order: section.order + 1,
      })),
    ],
  };
}

export function structuredResumeToDocument(
  resume: StructuredResume,
  title = "Optimized resume",
): ResumeDocument {
  if (resume.sections?.length) {
    return {
      id: `structured-${hashText(JSON.stringify(resume.sections))}`,
      title,
      sections: normalizeResumeDocumentOrder({
        id: "tmp",
        title,
        sections: resume.sections
          .map((section, index): ResumeSection => ({
            id: section.id || `${section.type || "custom"}-${index}`,
            type: normalizeSectionType(section.type),
            title: section.title || "Section",
            content: section.content || "",
            order: Number.isFinite(section.order) ? section.order : index,
          }))
          .filter((section) => section.title.trim() || section.content.trim()),
      }).sections,
    };
  }

  const sections: ResumeSection[] = [];

  if (resume.summary.trim()) {
    sections.push({
      id: "summary-0",
      type: "summary",
      title: "Summary",
      content: resume.summary.trim(),
      order: sections.length,
    });
  }

  if (resume.experience.length > 0) {
    sections.push({
      id: "experience-0",
      type: "experience",
      title: "Experience",
      content: resume.experience.map(experienceRoleToSectionText).filter(Boolean).join("\n\n"),
      order: sections.length,
    });
  }

  if (resume.skills.length > 0) {
    sections.push({
      id: "skills-0",
      type: "skills",
      title: "Skills",
      content: resume.skills.join(", "),
      order: sections.length,
    });
  }

  if (resume.education.length > 0) {
    sections.push({
      id: "education-0",
      type: "education",
      title: "Education",
      content: resume.education.join("\n"),
      order: sections.length,
    });
  }

  return {
    id: `structured-${hashText(serializeResumeDocument({ id: "tmp", title, sections }))}`,
    title,
    sections,
  };
}

function normalizeSectionType(value: string): ResumeSectionType {
  return RESUME_SECTION_TYPE_OPTIONS.some((option) => option.type === value)
    ? (value as ResumeSectionType)
    : "custom";
}

export function sectionTextareaRows(content: string): number {
  const lineCount = content.split("\n").length;
  const wrappedLineEstimate = Math.ceil(content.length / 95);
  return Math.min(16, Math.max(4, lineCount + wrappedLineEstimate));
}

function experienceRoleToSectionText(role: StructuredResume["experience"][number]): string {
  const heading = [role.title, role.company, role.location, role.dates]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" | ");
  const bullets = role.bullets
    .map((bullet) => bullet.trim())
    .filter(Boolean)
    .map((bullet) => `• ${bullet}`);
  return [heading, ...bullets].filter(Boolean).join("\n");
}

function normalizeResumeDocumentOrder(document: ResumeDocument): ResumeDocument {
  return {
    ...document,
    sections: document.sections.map((section, index) => ({
      ...section,
      order: index,
    })),
  };
}

function parseResumeSections(text: string): ResumeSection[] {
  if (!text) return [];

  const headingPattern = new RegExp(
    `\\b(${KNOWN_RESUME_HEADINGS.map(({ heading }) => escapeRegExp(heading)).join("|")})\\b:?`,
    "gi",
  );
  const matches = Array.from(text.matchAll(headingPattern)).filter((match) =>
    isLikelyResumeHeading(match, text),
  );

  if (matches.length === 0) {
    return [
      {
        id: "resume-0",
        type: "custom",
        title: "Extracted Resume",
        content: formatSectionContent(text),
        order: 0,
      },
    ];
  }

  const sections: ResumeSection[] = [];
  const firstHeadingStart = matches[0].index ?? 0;
  const contactText = text.slice(0, firstHeadingStart).trim();
  if (contactText) {
    sections.push({
      id: "contact-0",
      type: "contact",
      title: "Contact",
      content: formatSectionContent(contactText, "contact"),
      order: sections.length,
    });
  }

  matches.forEach((match) => {
    const headingStart = match.index ?? 0;
    const heading = (match[1] ?? "Section").toUpperCase();
    const headingEnd = headingStart + match[0].length;
    const nextHeadingStart = matches.find((candidate) => (candidate.index ?? 0) > headingStart)?.index ?? text.length;
    const metadata = KNOWN_RESUME_HEADINGS.find((item) => item.heading === heading);
    const content = formatSectionContent(text.slice(headingEnd, nextHeadingStart), metadata?.type);
    if (!content) return;

    sections.push({
      id: `${heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${sections.length}`,
      type: metadata?.type ?? "custom",
      title: headingLabel(heading),
      content,
      order: sections.length,
    });
  });

  return sections;
}

function isLikelyResumeHeading(match: RegExpMatchArray, text: string): boolean {
  const start = match.index ?? 0;
  const rawMatch = match[0] ?? "";
  const heading = match[1] ?? "";
  const before = text[start - 1] ?? "\n";
  const after = text.slice(start + heading.length, start + heading.length + 36);
  const sourceHeading = text.slice(start, start + heading.length);
  const startsLine = start === 0 || /[\n\r]/.test(before);
  const hasColon = rawMatch.endsWith(":");
  const isUppercaseHeading = sourceHeading === sourceHeading.toUpperCase();
  const normalizedHeading = heading.toUpperCase();

  if (/[A-Za-z0-9]/.test(before)) return false;
  if (isCompositeSkillLabel(normalizedHeading, after)) return false;
  if (!startsLine && !hasColon && INLINE_AMBIGUOUS_HEADINGS.has(normalizedHeading)) {
    return false;
  }

  return startsLine || hasColon || isUppercaseHeading;
}

function isCompositeSkillLabel(heading: string, afterHeading: string): boolean {
  if (heading !== "LANGUAGE" && heading !== "LANGUAGES") return false;

  return /^\s*(?:&|\/|\+|AND\s+(?:FRAMEWORKS|LIBRARIES|TOOLS|TECHNOLOGIES)|FRAMEWORKS|LIBRARIES|TOOLS|TECHNOLOGIES|PROGRAMMING)/i.test(
    afterHeading,
  );
}

function formatSectionContent(value: string, sectionType?: ResumeSectionType): string {
  const normalized = value
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*•\s*/g, "\n• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (sectionType === "projects") {
    return splitInlineProjectEntries(normalized);
  }

  if (sectionType === "skills" || sectionType === "languages" || sectionType === "certifications") {
    return splitInlineLabeledGroups(normalized);
  }

  return normalized;
}

const INLINE_GROUP_LABELS = [
  "AI & LLM Integration",
  "AI and LLM Integration",
  "Architecture & APIs",
  "Architecture and APIs",
  "Cloud & Infrastructure",
  "Cloud and Infrastructure",
  "Data & Persistence",
  "Data and Persistence",
  "DevOps & Tools",
  "DevOps and Tools",
  "Languages & Frameworks",
  "Languages and Frameworks",
  "Tools & Platforms",
  "Tools and Platforms",
].sort((a, b) => b.length - a.length);

function splitInlineLabeledGroups(value: string): string {
  if (!value) return value;

  const labelsPattern = new RegExp(
    `\\s+(${INLINE_GROUP_LABELS.map(escapeRegExp).join("|")}):\\s*`,
    "gi",
  );

  return value
    .replace(labelsPattern, "\n$1: ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitInlineProjectEntries(value: string): string {
  if (!value) return value;

  return value
    .replace(
      /\s+([A-Z][A-Za-z0-9][A-Za-z0-9 .&'()/-]{1,44}\s+[—-]\s+(?:https?:\/\/|www\.))/g,
      "\n$1",
    )
    .replace(
      /([.!?])\s+([A-Z][A-Za-z0-9][A-Za-z0-9 .&'()/-]{1,44}\s+[—-]\s+)/g,
      "$1\n$2",
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function headingLabel(value: string): string {
  const preserved = new Set(["AI", "API", "AWS", "CI/CD", "LLM", "PDF", "QA", "UI", "UX"]);
  return value
    .replace(/[:\s]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .split(" ")
    .map((word) => {
      const normalized = word.toUpperCase();
      if (preserved.has(normalized)) return normalized;
      if (word === "and") return word;
      return `${word.slice(0, 1).toUpperCase()}${word.slice(1)}`;
    })
    .join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hashText(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
