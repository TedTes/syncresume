import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "minimal",
  name: "Minimal",
  description: "Quiet single-column format with low visual weight and generous whitespace.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-minimal",
  thumbnailClassName: "thumbnail-minimal",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "skills",
    "projects",
    "education",
    "languages",
    "certifications",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 64,
    fontSize: 10.1,
    lineHeight: 15.4,
    headingSize: 10.8,
    sectionGap: 15,
    accent: [82, 82, 91],
  },
} satisfies ResumeTemplateConfig;
