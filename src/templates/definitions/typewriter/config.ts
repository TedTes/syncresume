import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "typewriter",
  name: "Typewriter",
  description: "Monospaced developer aesthetic — clean, terminal-inspired, and ATS-friendly.",
  isAtsSafe: true,
  density: "compact",
  className: "template-typewriter",
  thumbnailClassName: "thumbnail-typewriter",
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
    margin: 46,
    fontSize: 9.4,
    lineHeight: 13.5,
    headingSize: 10,
    sectionGap: 8,
    accent: [30, 30, 30],
  },
} satisfies ResumeTemplateConfig;
