import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "frost",
  name: "Frost",
  description: "Cool slate palette with a frosted glass header — polished and professional.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-frost",
  thumbnailClassName: "thumbnail-frost",
  renderer: "single-column",
  sectionOrder: [
    "contact",
    "summary",
    "experience",
    "projects",
    "education",
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
    sectionGap: 10,
    accent: [100, 116, 139],
  },
} satisfies ResumeTemplateConfig;
