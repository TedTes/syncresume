import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "classic",
  name: "Classic",
  description: "Traditional serif layout with restrained spacing and clear section hierarchy.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-classic",
  thumbnailClassName: "thumbnail-classic",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "education",
    "skills",
    "languages",
    "certifications",
    "projects",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 56,
    fontSize: 10.2,
    lineHeight: 14.5,
    headingSize: 11.5,
    sectionGap: 11,
    accent: [64, 55, 45],
  },
} satisfies ResumeTemplateConfig;
