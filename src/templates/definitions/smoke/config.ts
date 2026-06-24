import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "smoke",
  name: "Smoke",
  description: "Charcoal contact header on a soft gray background — dramatic yet professional.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-smoke",
  thumbnailClassName: "thumbnail-smoke",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [45, 45, 45] },
} satisfies ResumeTemplateConfig;
