import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "grove",
  name: "Grove",
  description: "Olive-green left-border accent on section titles — grounded and natural.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-grove",
  thumbnailClassName: "thumbnail-grove",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 46, fontSize: 9.5, lineHeight: 13.5, headingSize: 10.5, sectionGap: 10, accent: [77, 124, 15] },
} satisfies ResumeTemplateConfig;
