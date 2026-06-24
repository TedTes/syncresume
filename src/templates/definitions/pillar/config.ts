import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "pillar",
  name: "Pillar",
  description: "Large faded section numbers create a striking editorial hierarchy.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-pillar",
  thumbnailClassName: "thumbnail-pillar",
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
    margin: 46,
    fontSize: 9.5,
    lineHeight: 13.5,
    headingSize: 10.5,
    sectionGap: 10,
    accent: [99, 102, 241],
  },
} satisfies ResumeTemplateConfig;
