import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "crisp",
  name: "Crisp",
  description: "Sharp blue accents with compact headings for product and operations resumes.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-crisp",
  thumbnailClassName: "thumbnail-crisp",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "skills",
    "experience",
    "projects",
    "education",
    "languages",
    "certifications",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 52,
    fontSize: 9.9,
    lineHeight: 13.8,
    headingSize: 11,
    sectionGap: 9,
    accent: [37, 99, 235],
  },
} satisfies ResumeTemplateConfig;
