import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "compact",
  name: "Compact",
  description: "Tighter spacing for senior resumes that need to fit more content.",
  isAtsSafe: true,
  density: "compact",
  className: "template-compact",
  thumbnailClassName: "thumbnail-compact",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "skills",
    "languages",
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
    margin: 44,
    fontSize: 9.2,
    lineHeight: 12.5,
    headingSize: 10.2,
    sectionGap: 7,
    accent: [17, 17, 18],
  },
} satisfies ResumeTemplateConfig;
