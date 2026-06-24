import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "academic",
  name: "Academic",
  description: "Publication-friendly hierarchy for research, education, and technical CVs.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-academic",
  thumbnailClassName: "thumbnail-academic",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "education",
    "publications",
    "experience",
    "projects",
    "skills",
    "languages",
    "certifications",
    "awards",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 58,
    fontSize: 10.2,
    lineHeight: 14.8,
    headingSize: 11.2,
    sectionGap: 12,
    accent: [30, 64, 175],
  },
} satisfies ResumeTemplateConfig;
