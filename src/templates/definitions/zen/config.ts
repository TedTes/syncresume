import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "zen",
  name: "Zen",
  description: "Ultra-minimal with generous whitespace and subtle red accent marks.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-zen",
  thumbnailClassName: "thumbnail-zen",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "projects",
    "education",
    "skills",
    "languages",
    "certifications",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 52,
    fontSize: 9.5,
    lineHeight: 14,
    headingSize: 10,
    sectionGap: 11,
    accent: [220, 38, 38],
  },
} satisfies ResumeTemplateConfig;
