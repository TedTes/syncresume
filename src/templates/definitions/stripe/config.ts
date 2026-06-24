import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "stripe",
  name: "Stripe",
  description: "Distinctive indigo bookmark stripe down the left edge for a sleek modern look.",
  isAtsSafe: false,
  density: "balanced",
  className: "template-stripe",
  thumbnailClassName: "thumbnail-stripe",
  renderer: "single-column",
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
    accent: [79, 70, 229],
  },
} satisfies ResumeTemplateConfig;
