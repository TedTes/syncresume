import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "navy",
  name: "Navy",
  description: "Deep navy header block with white text — authoritative, sharp, and polished.",
  isAtsSafe: false,
  density: "balanced",
  className: "template-navy",
  thumbnailClassName: "thumbnail-navy",
  renderer: "gradient",
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
    accent: [15, 23, 42],
  },
} satisfies ResumeTemplateConfig;
