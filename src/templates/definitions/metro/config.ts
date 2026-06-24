import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "metro",
  name: "Metro",
  description: "Left-accent timeline rhythm for career-progressive resumes.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-metro",
  thumbnailClassName: "thumbnail-metro",
  renderer: "timeline",
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
    margin: 54,
    fontSize: 10,
    lineHeight: 14,
    headingSize: 11,
    sectionGap: 10,
    accent: [14, 116, 144],
  },
} satisfies ResumeTemplateConfig;
