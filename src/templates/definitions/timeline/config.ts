import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "timeline",
  name: "Timeline",
  description: "Experience-forward rhythm for resumes with strong career progression.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-timeline",
  thumbnailClassName: "thumbnail-timeline",
  renderer: "timeline",
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
    margin: 56,
    fontSize: 10,
    lineHeight: 14,
    headingSize: 11.5,
    sectionGap: 11,
    accent: [74, 95, 122],
  },
} satisfies ResumeTemplateConfig;
