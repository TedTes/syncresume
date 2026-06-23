import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "sidebar",
  name: "Sidebar",
  description: "Two-zone layout with contact and skills in a compact side rail.",
  isAtsSafe: false,
  density: "balanced",
  className: "template-sidebar",
  thumbnailClassName: "thumbnail-sidebar",
  renderer: "sidebar",
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
    margin: 50,
    fontSize: 9.8,
    lineHeight: 13.5,
    headingSize: 11,
    sectionGap: 9,
    accent: [16, 120, 88],
  },
} satisfies ResumeTemplateConfig;
