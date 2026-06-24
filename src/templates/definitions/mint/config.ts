import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "mint",
  name: "Mint",
  description: "Fresh teal-mint with a small filled square marker before each section heading.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-mint",
  thumbnailClassName: "thumbnail-mint",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [8, 145, 178] },
} satisfies ResumeTemplateConfig;
