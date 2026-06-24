import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "editorial",
  name: "Editorial",
  description: "Magazine-like header treatment for strong summary-led resumes.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-editorial",
  thumbnailClassName: "thumbnail-editorial",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "projects",
    "skills",
    "languages",
    "education",
    "certifications",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 60,
    fontSize: 10.4,
    lineHeight: 15.2,
    headingSize: 12,
    sectionGap: 13,
    accent: [126, 34, 206],
  },
} satisfies ResumeTemplateConfig;
