import type { ResumeDocument, ResumeSection, ResumeSectionType } from "./resumeDocument";

export type ResumeTemplateId =
  | "ats-simple"
  | "modern"
  | "compact"
  | "executive"
  | "sidebar"
  | "timeline"
  | "technical";

export type ResumeTemplateRenderer = "single-column" | "sidebar" | "timeline" | "technical";

export type ResumeTemplate = {
  id: ResumeTemplateId;
  name: string;
  description: string;
  isAtsSafe: boolean;
  density: "comfortable" | "balanced" | "compact";
  className: string;
  thumbnailClassName: string;
  renderer: ResumeTemplateRenderer;
  sectionOrder: ResumeSectionType[];
  pdf: {
    margin: number;
    fontSize: number;
    lineHeight: number;
    headingSize: number;
    sectionGap: number;
    accent: [number, number, number];
  };
};

export const DEFAULT_TEMPLATE_ID: ResumeTemplateId = "ats-simple";

export const RESUME_TEMPLATES: ResumeTemplate[] = [
  {
    id: "ats-simple",
    name: "ATS Simple",
    description: "Single-column, conservative spacing, safest for applicant tracking systems.",
    isAtsSafe: true,
    density: "balanced",
    className: "template-ats-simple",
    thumbnailClassName: "thumbnail-single",
    renderer: "single-column",
    sectionOrder: [
      "contact",
      "summary",
      "skills",
      "experience",
      "projects",
      "education",
      "certifications",
      "awards",
      "publications",
      "volunteering",
      "custom",
    ],
    pdf: {
      margin: 54,
      fontSize: 10,
      lineHeight: 14,
      headingSize: 11,
      sectionGap: 10,
      accent: [17, 17, 18],
    },
  },
  {
    id: "modern",
    name: "Modern",
    description: "Sharper headings and breathing room while staying single-column and ATS-safe.",
    isAtsSafe: true,
    density: "comfortable",
    className: "template-modern",
    thumbnailClassName: "thumbnail-modern",
    renderer: "single-column",
    sectionOrder: [
      "contact",
      "summary",
      "experience",
      "skills",
      "projects",
      "education",
      "certifications",
      "awards",
      "publications",
      "volunteering",
      "custom",
    ],
    pdf: {
      margin: 58,
      fontSize: 10.3,
      lineHeight: 15,
      headingSize: 11.5,
      sectionGap: 12,
      accent: [16, 120, 88],
    },
  },
  {
    id: "compact",
    name: "Compact",
    description: "Tighter spacing for senior resumes that need to fit more content.",
    isAtsSafe: true,
    density: "compact",
    className: "template-compact",
    thumbnailClassName: "thumbnail-compact",
    renderer: "single-column",
    sectionOrder: [
      "contact",
      "summary",
      "skills",
      "experience",
      "projects",
      "education",
      "certifications",
      "awards",
      "publications",
      "volunteering",
      "custom",
    ],
    pdf: {
      margin: 44,
      fontSize: 9.2,
      lineHeight: 12.5,
      headingSize: 10.2,
      sectionGap: 7,
      accent: [17, 17, 18],
    },
  },
  {
    id: "executive",
    name: "Executive",
    description: "More whitespace and stronger hierarchy for leadership profiles.",
    isAtsSafe: true,
    density: "comfortable",
    className: "template-executive",
    thumbnailClassName: "thumbnail-executive",
    renderer: "single-column",
    sectionOrder: [
      "contact",
      "summary",
      "experience",
      "skills",
      "education",
      "certifications",
      "projects",
      "awards",
      "publications",
      "volunteering",
      "custom",
    ],
    pdf: {
      margin: 62,
      fontSize: 10.5,
      lineHeight: 15.5,
      headingSize: 12,
      sectionGap: 14,
      accent: [83, 72, 56],
    },
  },
  {
    id: "sidebar",
    name: "Sidebar",
    description: "Two-zone layout with contact and skills in a compact side rail.",
    isAtsSafe: false,
    density: "balanced",
    className: "template-sidebar",
    thumbnailClassName: "thumbnail-sidebar",
    renderer: "sidebar",
    sectionOrder: [
      "contact",
      "summary",
      "skills",
      "experience",
      "projects",
      "education",
      "certifications",
      "awards",
      "publications",
      "volunteering",
      "custom",
    ],
    pdf: {
      margin: 50,
      fontSize: 9.8,
      lineHeight: 13.5,
      headingSize: 11,
      sectionGap: 9,
      accent: [16, 120, 88],
    },
  },
  {
    id: "timeline",
    name: "Timeline",
    description: "Experience-forward rhythm for resumes with strong career progression.",
    isAtsSafe: true,
    density: "balanced",
    className: "template-timeline",
    thumbnailClassName: "thumbnail-timeline",
    renderer: "timeline",
    sectionOrder: [
      "contact",
      "summary",
      "experience",
      "projects",
      "skills",
      "education",
      "certifications",
      "awards",
      "publications",
      "volunteering",
      "custom",
    ],
    pdf: {
      margin: 56,
      fontSize: 10,
      lineHeight: 14,
      headingSize: 11.5,
      sectionGap: 11,
      accent: [74, 95, 122],
    },
  },
  {
    id: "technical",
    name: "Technical",
    description: "Skills-first layout for engineering and systems-heavy resumes.",
    isAtsSafe: true,
    density: "compact",
    className: "template-technical",
    thumbnailClassName: "thumbnail-technical",
    renderer: "technical",
    sectionOrder: [
      "contact",
      "skills",
      "summary",
      "experience",
      "projects",
      "education",
      "certifications",
      "awards",
      "publications",
      "volunteering",
      "custom",
    ],
    pdf: {
      margin: 46,
      fontSize: 9.4,
      lineHeight: 12.8,
      headingSize: 10.5,
      sectionGap: 8,
      accent: [16, 120, 88],
    },
  },
];

export function getResumeTemplate(templateId: string): ResumeTemplate {
  return RESUME_TEMPLATES.find((template) => template.id === templateId) ?? RESUME_TEMPLATES[0];
}

export function normalizeResumeTemplateId(templateId: string | null | undefined): ResumeTemplateId {
  return RESUME_TEMPLATES.some((template) => template.id === templateId)
    ? (templateId as ResumeTemplateId)
    : DEFAULT_TEMPLATE_ID;
}

export function orderSectionsForTemplate(
  document: ResumeDocument,
  template: ResumeTemplate,
): ResumeSection[] {
  const orderRank = new Map(template.sectionOrder.map((type, index) => [type, index]));
  return [...document.sections]
    .filter((section) => section.content.trim() || section.title.trim())
    .sort((left, right) => {
      const leftRank = orderRank.get(left.type) ?? orderRank.get("custom") ?? 999;
      const rightRank = orderRank.get(right.type) ?? orderRank.get("custom") ?? 999;
      return leftRank - rightRank || left.order - right.order;
    });
}
