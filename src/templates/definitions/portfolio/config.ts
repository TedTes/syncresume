import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "portfolio",
  name: "Portfolio",
  description: "Side-rail presentation for project-heavy profiles and creative technologists.",
  isAtsSafe: false,
  density: "balanced",
  className: "template-portfolio",
  thumbnailClassName: "thumbnail-portfolio",
  renderer: "sidebar",
  sectionOrder: [
    "contact",
    "summary",
    "skills",
    "projects",
    "experience",
    "education",
    "languages",
    "certifications",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 48,
    fontSize: 9.7,
    lineHeight: 13.4,
    headingSize: 10.8,
    sectionGap: 9,
    accent: [180, 83, 9],
  },
} satisfies ResumeTemplateConfig;
