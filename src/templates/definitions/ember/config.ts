import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "ember",
  name: "Ember",
  description: "Warm orange-amber accents with a bold left-aligned name — vivid and confident.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-ember",
  thumbnailClassName: "thumbnail-ember",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [234, 88, 12] },
} satisfies ResumeTemplateConfig;
