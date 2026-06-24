import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "clean",
  name: "Clean",
  description: "Pure black-and-white with zero decoration — the gold standard for ATS parsing.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-clean",
  thumbnailClassName: "thumbnail-clean",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 46, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [0, 0, 0] },
} satisfies ResumeTemplateConfig;
