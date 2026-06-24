import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "layer",
  name: "Layer",
  description: "Professional summary floats in a prominent highlighted card above the rest.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-layer",
  thumbnailClassName: "thumbnail-layer",
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
    accent: [5, 150, 105],
  },
} satisfies ResumeTemplateConfig;
