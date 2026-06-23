import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "technical",
  name: "Technical",
  description: "Skills-first layout for engineering and systems-heavy resumes.",
  isAtsSafe: true,
  density: "compact",
  className: "template-technical",
  thumbnailClassName: "thumbnail-technical",
  renderer: "technical",
  sectionOrder: [
    "contact",
    "skills",
    "languages",
    "summary",
    "experience",
    "projects",
    "education",
    "certifications",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 46,
    fontSize: 9.4,
    lineHeight: 12.8,
    headingSize: 10.5,
    sectionGap: 8,
    accent: [16, 120, 88],
  },
} satisfies ResumeTemplateConfig;
