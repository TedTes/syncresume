import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "dash",
  name: "Dash",
  description: "Dashed bottom border on every section — precise, technical, and well-organized.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-dash",
  thumbnailClassName: "thumbnail-dash",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [51, 65, 85] },
} satisfies ResumeTemplateConfig;
