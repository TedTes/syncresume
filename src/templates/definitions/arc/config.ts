import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "arc",
  name: "Arc",
  description: "Curved arch bottom on the contact header gives a soft, modern, distinctive shape.",
  isAtsSafe: false,
  density: "comfortable",
  className: "template-arc",
  thumbnailClassName: "thumbnail-arc",
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
    margin: 46,
    fontSize: 9.5,
    lineHeight: 13.5,
    headingSize: 10.5,
    sectionGap: 9,
    accent: [124, 58, 237],
  },
} satisfies ResumeTemplateConfig;
