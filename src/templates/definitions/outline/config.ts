import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "outline",
  name: "Outline",
  description: "Deconstructed border-only design — every section framed in a clean inked box.",
  isAtsSafe: false,
  density: "balanced",
  className: "template-outline",
  thumbnailClassName: "thumbnail-outline",
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
    margin: 40,
    fontSize: 9.5,
    lineHeight: 13,
    headingSize: 10.5,
    sectionGap: 9,
    accent: [17, 24, 39],
  },
} satisfies ResumeTemplateConfig;
