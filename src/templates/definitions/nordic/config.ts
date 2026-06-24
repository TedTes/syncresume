import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "nordic",
  name: "Nordic",
  description: "Crisp Scandinavian design with indigo accents and clean typographic hierarchy.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-nordic",
  thumbnailClassName: "thumbnail-nordic",
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
    sectionGap: 10,
    accent: [59, 130, 246],
  },
} satisfies ResumeTemplateConfig;
