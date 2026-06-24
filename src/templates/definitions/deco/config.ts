import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "deco",
  name: "Deco",
  description: "Art deco-inspired layout with warm gold accents and decorative section marks.",
  isAtsSafe: false,
  density: "balanced",
  className: "template-deco",
  thumbnailClassName: "thumbnail-deco",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "education",
    "projects",
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
    lineHeight: 13,
    headingSize: 10.5,
    sectionGap: 9,
    accent: [180, 83, 9],
  },
} satisfies ResumeTemplateConfig;
