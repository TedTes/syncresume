import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "anchor",
  name: "Anchor",
  description: "Centered section headings flanked by extending lines — symmetrical and editorial.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-anchor",
  thumbnailClassName: "thumbnail-anchor",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 46, fontSize: 9.5, lineHeight: 13.5, headingSize: 10.5, sectionGap: 10, accent: [99, 102, 241] },
} satisfies ResumeTemplateConfig;
