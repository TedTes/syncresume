import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "terra",
  name: "Terra",
  description: "Warm earthy sidebar with terracotta accents — inviting, grounded, and warm.",
  isAtsSafe: false,
  density: "balanced",
  className: "template-terra",
  thumbnailClassName: "thumbnail-terra",
  renderer: "sidebar",
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
    margin: 44,
    fontSize: 9.5,
    lineHeight: 13,
    headingSize: 10.5,
    sectionGap: 9,
    accent: [161, 89, 56],
  },
} satisfies ResumeTemplateConfig;
