import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "retro",
  name: "Retro",
  description: "Warm vintage styling with an inverted header, serif type, and earthy tones.",
  isAtsSafe: false,
  density: "balanced",
  className: "template-retro",
  thumbnailClassName: "thumbnail-retro",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "education",
    "projects",
    "skills",
    "languages",
    "certifications",
    "awards",
    "publications",
    "volunteering",
    "custom",
  ],
  pdf: {
    margin: 46,
    fontSize: 9.5,
    lineHeight: 13.5,
    headingSize: 10.5,
    sectionGap: 9,
    accent: [139, 69, 19],
  },
} satisfies ResumeTemplateConfig;
