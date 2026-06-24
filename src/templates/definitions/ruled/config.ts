import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "ruled",
  name: "Ruled",
  description: "Horizontal ruled lines extend from each section title — ledger-inspired and precise.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-ruled",
  thumbnailClassName: "thumbnail-ruled",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "projects",
    "education",
    "skills",
    "languages",
    "certifications",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 44,
    fontSize: 9.5,
    lineHeight: 13,
    headingSize: 10.5,
    sectionGap: 9,
    accent: [51, 65, 85],
  },
} satisfies ResumeTemplateConfig;
