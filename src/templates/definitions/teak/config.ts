import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "teak",
  name: "Teak",
  description: "Warm wood-brown tones with name on the left and contact details on the right.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-teak",
  thumbnailClassName: "thumbnail-teak",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [160, 110, 70] },
} satisfies ResumeTemplateConfig;
