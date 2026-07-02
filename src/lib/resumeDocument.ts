import { structuredResumeSectionsWithCanonicalFallbacks, type StructuredResume } from "./resume";

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

export type ResumeSectionContentKind = "paragraph" | "bullets";

export type ResumeSection = {
  id: string;
  type: ResumeSectionType;
  title: string;
  content: string;
  contentKind?: ResumeSectionContentKind;
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

export const RESUME_SECTION_CONTENT_KIND_OPTIONS: Array<{
  kind: ResumeSectionContentKind;
  title: string;
}> = [
  { kind: "paragraph", title: "Paragraph" },
  { kind: "bullets", title: "Bullet list" },
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

type ResumeHeadingMatch = {
  index: number;
  heading: string;
  contentStart: number;
  metadata: { heading: string; type: ResumeSectionType };
};

export function inferResumeSectionTypeFromTitle(title: string): ResumeSectionType {
  const normalizedTitle = normalizeResumeSectionTitle(title);
  if (!normalizedTitle) return "custom";

  const matchedHeading = KNOWN_RESUME_HEADINGS.find(
    ({ heading, type }) => type !== "contact" && normalizeResumeSectionTitle(heading) === normalizedTitle,
  );

  return matchedHeading?.type ?? "custom";
}

export function inferResumeSectionContentKind(
  sectionType: ResumeSectionType,
  title = "",
  content = "",
): ResumeSectionContentKind {
  const inferredType = title ? inferResumeSectionTypeFromTitle(title) : sectionType;
  const effectiveType = inferredType === "custom" ? sectionType : inferredType;

  if (hasMixedTextAndBulletContent(content)) return "paragraph";
  if (effectiveType === "experience" && hasBulletPrefixedRoleHeaderContent(content)) {
    return "paragraph";
  }
  if (isBulletListContent(content)) return "bullets";

  if (
    effectiveType === "projects" ||
    effectiveType === "awards" ||
    effectiveType === "publications" ||
    effectiveType === "volunteering" ||
    effectiveType === "certifications"
  ) {
    return "bullets";
  }

  return "paragraph";
}

function normalizeResumeSectionTitle(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function stripDuplicateSectionHeading(title: string, content: string): string {
  if (!title.trim() || !content.trim()) return content.trim();

  const titleKey = canonicalSectionHeadingFamily(title);
  const lines = content.replace(/\r/g, "").split("\n");
  while (lines.length > 0 && isDuplicateSectionHeadingLine(titleKey, lines[0] ?? "")) {
    lines.shift();
  }

  return lines.join("\n").trim();
}

function isDuplicateSectionHeadingLine(titleKey: string, line: string): boolean {
  const lineKey = canonicalSectionHeadingFamily(line.replace(/^\s*[-*•]\s*/, ""));
  return Boolean(titleKey && lineKey && titleKey === lineKey);
}

function canonicalSectionHeadingFamily(value: string): string {
  const key = normalizeResumeSectionTitle(value);
  if (!key) return "";
  if (/\b(summary|profile|objective)\b/.test(key)) return "summary";
  if (/\b(experience|employment|work history|career history)\b/.test(key)) return "experience";
  if (/\b(skills|competencies|technologies|tech stack|expertise)\b/.test(key)) return "skills";
  if (/\b(education|degree|academic)\b/.test(key)) return "education";
  return key;
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
      const content = serializeSectionContent(section);
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

export function updateResumeDocumentSectionContentKind(
  document: ResumeDocument,
  sectionId: string,
  contentKind: ResumeSectionContentKind,
): ResumeDocument {
  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === sectionId ? { ...section, contentKind } : section,
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
  sectionData: { title?: string; content?: string; contentKind?: ResumeSectionContentKind } = {},
): ResumeDocument {
  const fallbackTitle =
    RESUME_SECTION_TYPE_OPTIONS.find((option) => option.type === sectionType)?.title ??
    "Custom Section";
  const title = sectionData.title?.trim() || fallbackTitle;
  const contentKind = sectionData.contentKind ?? inferResumeSectionContentKind(sectionType, title);
  const nextSection: ResumeSection = {
    id: `${sectionType}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: sectionType,
    title,
    content: normalizeSectionContentForKind(sectionData.content ?? "", contentKind),
    contentKind,
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
  const structuredSections = structuredResumeSectionsWithCanonicalFallbacks(resume);
  if (structuredSections.length) {
    return {
      id: `structured-${hashText(JSON.stringify(structuredSections))}`,
      title,
      sections: normalizeResumeDocumentOrder({
        id: "tmp",
        title,
        sections: structuredSections
          .map((section, index): ResumeSection => {
            const sectionType = normalizeSectionType(section.type);
            const title = section.title || "Section";
            const content = stripDuplicateSectionHeading(title, section.content || "");
            return {
              id: section.id || `${section.type || "custom"}-${index}`,
              type: sectionType,
              title,
              content,
              contentKind:
                normalizeSectionContentKind(section.contentKind) ??
                inferResumeSectionContentKind(sectionType, title, content),
              order: Number.isFinite(section.order) ? section.order : index,
            };
          })
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
      contentKind: "paragraph",
      order: sections.length,
    });
  }

  if (resume.experience.length > 0) {
    sections.push({
      id: "experience-0",
      type: "experience",
      title: "Experience",
      content: resume.experience.map(experienceRoleToSectionText).filter(Boolean).join("\n\n"),
      contentKind: "paragraph",
      order: sections.length,
    });
  }

  if (resume.skills.length > 0) {
    sections.push({
      id: "skills-0",
      type: "skills",
      title: "Skills",
      content: resume.skills.join(", "),
      contentKind: "paragraph",
      order: sections.length,
    });
  }

  if (resume.education.length > 0) {
    sections.push({
      id: "education-0",
      type: "education",
      title: "Education",
      content: resume.education.join("\n"),
      contentKind: "paragraph",
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

function normalizeSectionContentKind(value: unknown): ResumeSectionContentKind | undefined {
  return value === "paragraph" || value === "bullets" ? value : undefined;
}

function normalizeSectionContentForKind(value: string, kind: ResumeSectionContentKind): string {
  const trimmed = value.trim();
  if (kind !== "bullets") return trimmed;

  return trimmed
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean)
    .map((line) => `• ${line}`)
    .join("\n");
}

function serializeSectionContent(section: ResumeSection): string {
  if (section.contentKind !== "bullets") return section.content.trim();
  return normalizeSectionContentForKind(section.content, "bullets");
}

function hasMixedTextAndBulletContent(value: string): boolean {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;

  const bulletLines = lines.filter(isBulletLine).length;
  return bulletLines > 0 && bulletLines < lines.length;
}

function isBulletListContent(value: string): boolean {
  const lines = value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return false;

  return lines.every(isBulletLine);
}

function isBulletLine(line: string): boolean {
  return /^[-*•]\s+/.test(line);
}

export function stripResumeBulletPrefix(line: string): string {
  return line.replace(/^[-*•]\s+/, "").trim();
}

export function isBulletPrefixedRoleHeaderLine(line: string): boolean {
  if (!isBulletLine(line)) return false;

  const text = stripResumeBulletPrefix(line);
  if (text.length > 180) return false;

  const hasRoleWord =
    /\b(engineer|developer|manager|designer|analyst|architect|lead|director|consultant|specialist|administrator|coordinator|officer|associate|intern|scientist|technician|founder|principal)\b/i.test(
      text,
    );
  const hasDate =
    /\b(?:19|20)\d{2}\b/i.test(text) ||
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+(?:19|20)\d{2}\b/i.test(text);
  const hasRoleSeparator = /\s(?:\||—|–|-|at)\s/i.test(text);

  return hasRoleWord && hasDate && hasRoleSeparator;
}

function hasBulletPrefixedRoleHeaderContent(value: string): boolean {
  return value.split("\n").some((line) => isBulletPrefixedRoleHeaderLine(line.trim()));
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
  const sectionText = normalizeInlineSectionHeadingBoundaries(text);

  const matches = findResumeHeadingMatches(sectionText);

  if (matches.length === 0) {
    return [
      {
        id: "resume-0",
        type: "custom",
        title: "Extracted Resume",
        content: formatSectionContent(sectionText),
        contentKind: "paragraph",
        order: 0,
      },
    ];
  }

  const sections: ResumeSection[] = [];
  const firstHeadingStart = matches[0].index;
  const contactText = sectionText.slice(0, firstHeadingStart).trim();
  if (contactText) {
    sections.push({
      id: "contact-0",
      type: "contact",
      title: "Contact",
      content: formatSectionContent(contactText, "contact"),
      contentKind: "paragraph",
      order: sections.length,
    });
  }

  matches.forEach((match, index) => {
    const nextHeadingStart = matches[index + 1]?.index ?? sectionText.length;
    const rawContent = formatSectionContent(
      sectionText.slice(match.contentStart, nextHeadingStart),
      match.metadata.type,
    );
    const content = stripDuplicateSectionHeading(match.heading, rawContent);
    if (!content) return;

    sections.push({
      id: `${match.heading.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${sections.length}`,
      type: match.metadata.type,
      title: headingLabel(match.heading),
      content,
      contentKind: inferResumeSectionContentKind(match.metadata.type, match.heading, content),
      order: sections.length,
    });
  });

  return sections;
}

function findResumeHeadingMatches(text: string): ResumeHeadingMatch[] {
  const matches: ResumeHeadingMatch[] = [];
  let lineStart = 0;

  for (const line of text.split("\n")) {
    const match = findResumeHeadingInLine(line, lineStart);
    if (match) matches.push(match);
    lineStart += line.length + 1;
  }

  return matches;
}

function normalizeInlineSectionHeadingBoundaries(text: string): string {
  const headingPattern = new RegExp(
    `(\\s+)(${KNOWN_RESUME_HEADINGS.map(({ heading }) => escapeRegExp(heading)).join("|")})(:?)(?=\\s|$)`,
    "g",
  );

  return text.replace(headingPattern, (match, whitespace: string, heading: string, colon: string, offset: number) => {
    if (whitespace.includes("\n")) return match;

    const afterHeading = text.slice(
      offset + whitespace.length + heading.length + colon.length,
      offset + whitespace.length + heading.length + colon.length + 36,
    );
    if (isCompositeSkillLabel(heading, `${colon}${afterHeading}`)) return match;

    return `\n${heading}${colon}`;
  });
}

function findResumeHeadingInLine(line: string, lineStart: number): ResumeHeadingMatch | null {
  const leadingWhitespaceLength = line.match(/^\s*/)?.[0].length ?? 0;
  const trimmedLine = line.slice(leadingWhitespaceLength);
  if (!trimmedLine) return null;

  for (const metadata of KNOWN_RESUME_HEADINGS) {
    const heading = metadata.heading;
    const sourceHeading = trimmedLine.slice(0, heading.length);
    if (sourceHeading.toUpperCase() !== heading) continue;

    const afterHeading = trimmedLine.slice(heading.length);
    if (!isSectionHeadingBoundary(afterHeading)) continue;
    if (isCompositeSkillLabel(heading, afterHeading)) continue;

    const separator = afterHeading.match(/^\s*:?\s*/)?.[0] ?? "";
    const contentStart = lineStart + leadingWhitespaceLength + heading.length + separator.length;
    const inlineContent = line.slice(contentStart - lineStart).trim();
    const hasColon = /^\s*:/.test(afterHeading);
    const isUppercaseHeading = sourceHeading === sourceHeading.toUpperCase();
    const isStandaloneHeading = inlineContent.length === 0;

    if (!isStandaloneHeading && !hasColon && !isUppercaseHeading) continue;

    return {
      index: lineStart + leadingWhitespaceLength,
      heading,
      contentStart,
      metadata,
    };
  }

  return null;
}

function isSectionHeadingBoundary(afterHeading: string): boolean {
  return afterHeading.length === 0 || /^[\s:]/.test(afterHeading);
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
