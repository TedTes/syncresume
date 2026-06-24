import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "card",
  name: "Card",
  description: "Each section floats in a clean bordered card for a structured, panel-style look.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-card",
  thumbnailClassName: "thumbnail-card",
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
    accent: [37, 99, 235],
  },
} satisfies ResumeTemplateConfig;
