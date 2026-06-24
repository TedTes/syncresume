import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "startup",
  name: "Startup",
  description: "Energetic compact layout for builders, founders, and early-stage teams.",
  isAtsSafe: true,
  density: "compact",
  className: "template-startup",
  thumbnailClassName: "thumbnail-startup",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "projects",
    "experience",
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
    fontSize: 9.4,
    lineHeight: 13,
    headingSize: 10.4,
    sectionGap: 8,
    accent: [225, 29, 72],
  },
} satisfies ResumeTemplateConfig;
