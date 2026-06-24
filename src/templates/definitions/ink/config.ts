import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "ink",
  name: "Ink",
  description: "Deep charcoal ink tones with top-border accents on each section.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-ink",
  thumbnailClassName: "thumbnail-ink",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [30, 30, 35] },
} satisfies ResumeTemplateConfig;
