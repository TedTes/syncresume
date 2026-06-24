import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "impact",
  name: "Impact",
  description: "Oversized bold name with strong typographic hierarchy for maximum first impression.",
  isAtsSafe: true,
  density: "compact",
  className: "template-impact",
  thumbnailClassName: "thumbnail-impact",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "projects",
    "skills",
    "education",
    "languages",
    "certifications",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 44,
    fontSize: 9.4,
    lineHeight: 13,
    headingSize: 10.5,
    sectionGap: 8,
    accent: [159, 18, 57],
  },
} satisfies ResumeTemplateConfig;
