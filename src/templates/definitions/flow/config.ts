import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "flow",
  name: "Flow",
  description: "Cyan left-border accent runs the full height of each section — fluid and guided.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-flow",
  thumbnailClassName: "thumbnail-flow",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [6, 182, 212] },
} satisfies ResumeTemplateConfig;
