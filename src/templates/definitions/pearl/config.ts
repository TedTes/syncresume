import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "pearl",
  name: "Pearl",
  description: "Warm ivory background with a centered name and thin gold horizontal rule.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-pearl",
  thumbnailClassName: "thumbnail-pearl",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 48, fontSize: 9.5, lineHeight: 13.5, headingSize: 10.5, sectionGap: 10, accent: [180, 140, 100] },
} satisfies ResumeTemplateConfig;
