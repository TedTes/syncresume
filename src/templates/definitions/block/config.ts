import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "block",
  name: "Block",
  description: "Section titles rendered as bold filled bars for maximum visual structure.",
  isAtsSafe: false,
  density: "balanced",
  className: "template-block",
  thumbnailClassName: "thumbnail-block",
  renderer: "single-column",
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
    accent: [30, 41, 59],
  },
} satisfies ResumeTemplateConfig;
