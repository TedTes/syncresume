import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "executive",
  name: "Executive",
  description: "More whitespace and stronger hierarchy for leadership profiles.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-executive",
  thumbnailClassName: "thumbnail-executive",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "skills",
    "languages",
    "education",
    "certifications",
    "projects",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 62,
    fontSize: 10.5,
    lineHeight: 15.5,
    headingSize: 12,
    sectionGap: 14,
    accent: [83, 72, 56],
  },
} satisfies ResumeTemplateConfig;
