import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "gradient",
  name: "Gradient",
  description: "Bold gradient header that makes your name stand out immediately.",
  isAtsSafe: false,
  density: "comfortable",
  className: "template-gradient",
  thumbnailClassName: "thumbnail-gradient",
  renderer: "gradient",
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
    fontSize: 9.5,
    lineHeight: 13,
    headingSize: 10.5,
    sectionGap: 9,
    accent: [16, 120, 88],
  },
} satisfies ResumeTemplateConfig;
