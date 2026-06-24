import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "rose",
  name: "Rose",
  description: "Dusty rose palette with centered contact and a double-rule under the name.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-rose",
  thumbnailClassName: "thumbnail-rose",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 46, fontSize: 9.5, lineHeight: 13.5, headingSize: 10.5, sectionGap: 10, accent: [157, 95, 114] },
} satisfies ResumeTemplateConfig;
