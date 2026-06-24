import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "sage",
  name: "Sage",
  description: "Muted sage green with italic section titles — soft, organic, and refined.",
  isAtsSafe: true,
  density: "comfortable",
  className: "template-sage",
  thumbnailClassName: "thumbnail-sage",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 46, fontSize: 9.5, lineHeight: 13.5, headingSize: 10.5, sectionGap: 10, accent: [101, 130, 100] },
} satisfies ResumeTemplateConfig;
