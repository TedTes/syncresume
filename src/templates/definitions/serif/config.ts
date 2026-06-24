import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "serif",
  name: "Serif",
  description: "Full Georgia serif typography throughout — polished, literary, and timeless.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-serif",
  thumbnailClassName: "thumbnail-serif",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "education",
    "projects",
    "skills",
    "languages",
    "certifications",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 48,
    fontSize: 9.5,
    lineHeight: 13.5,
    headingSize: 10.5,
    sectionGap: 10,
    accent: [120, 53, 15],
  },
} satisfies ResumeTemplateConfig;
