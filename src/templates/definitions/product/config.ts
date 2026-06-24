import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "product",
  name: "Product",
  description: "Impact-first layout with a highlighted capabilities block.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-product",
  thumbnailClassName: "thumbnail-product",
  renderer: "technical",
  sectionOrder: [
    "contact",
    "summary",
    "skills",
    "experience",
    "projects",
    "education",
    "languages",
    "certifications",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 50,
    fontSize: 9.8,
    lineHeight: 13.8,
    headingSize: 11,
    sectionGap: 9,
    accent: [5, 150, 105],
  },
} satisfies ResumeTemplateConfig;
