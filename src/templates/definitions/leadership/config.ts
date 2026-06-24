import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "leadership",
  name: "Leadership",
  description: "Bold top band and spacious sections for management and director resumes.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-leadership",
  thumbnailClassName: "thumbnail-leadership",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "awards",
    "skills",
    "projects",
    "education",
    "languages",
    "certifications",
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
    accent: [79, 70, 229],
  },
} satisfies ResumeTemplateConfig;
