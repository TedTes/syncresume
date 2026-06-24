import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "shore",
  name: "Shore",
  description: "Ocean-blue palette with bottom borders on each section — calm, open, structured.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-shore",
  thumbnailClassName: "thumbnail-shore",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 46, fontSize: 9.5, lineHeight: 13.5, headingSize: 10.5, sectionGap: 10, accent: [29, 78, 216] },
} satisfies ResumeTemplateConfig;
