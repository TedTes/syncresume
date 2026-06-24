import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "split",
  name: "Split",
  description: "Balanced two-column layout with skills on the left and experience on the right.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-split",
  thumbnailClassName: "thumbnail-split",
  renderer: "split",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "projects",
    "skills",
    "education",
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
    accent: [37, 99, 235],
  },
} satisfies ResumeTemplateConfig;
