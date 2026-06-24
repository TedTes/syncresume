import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "steel",
  name: "Steel",
  description: "Industrial steel palette with an extra-bold heavy name and strong section rules.",
  isAtsSafe: true,
  density: "compact",
  className: "template-steel",
  thumbnailClassName: "thumbnail-steel",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 44, fontSize: 9.4, lineHeight: 13, headingSize: 10.5, sectionGap: 8, accent: [28, 40, 55] },
} satisfies ResumeTemplateConfig;
