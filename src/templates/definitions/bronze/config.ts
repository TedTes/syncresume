import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "bronze",
  name: "Bronze",
  description: "Warm bronze-copper tones with an em-dash accent before section headings.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-bronze",
  thumbnailClassName: "thumbnail-bronze",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [180, 90, 30] },
} satisfies ResumeTemplateConfig;
