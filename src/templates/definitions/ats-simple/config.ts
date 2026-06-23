import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "ats-simple",
  name: "ATS Simple",
  description: "Single-column, conservative spacing, safest for applicant tracking systems.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-ats-simple",
  thumbnailClassName: "thumbnail-single",
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
    margin: 54,
    fontSize: 10,
    lineHeight: 14,
    headingSize: 11,
    sectionGap: 10,
    accent: [17, 17, 18],
  },
} satisfies ResumeTemplateConfig;
