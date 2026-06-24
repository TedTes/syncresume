import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "cobalt",
  name: "Cobalt",
  description: "Bold cobalt blue with thick bottom borders on section headings — strong and clear.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-cobalt",
  thumbnailClassName: "thumbnail-cobalt",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [37, 99, 235] },
} satisfies ResumeTemplateConfig;
