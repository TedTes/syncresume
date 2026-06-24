import type { ResumeTemplateConfig } from "../../shared/types";

export const config = {
  id: "spark",
  name: "Spark",
  description: "A bright green triangle arrow before each section title adds energetic direction.",
  isAtsSafe: true,
  density: "balanced",
  className: "template-spark",
  thumbnailClassName: "thumbnail-spark",
  renderer: "single-column",
  sectionOrder: [
    "contact", "summary", "experience", "projects", "skills",
    "education", "languages", "certifications", "awards",
    "publications", "volunteering", "custom",
  ],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [22, 163, 74] },
} satisfies ResumeTemplateConfig;
