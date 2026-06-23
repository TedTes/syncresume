import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
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
    "languages",
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
} satisfies ResumeTemplateConfig;
