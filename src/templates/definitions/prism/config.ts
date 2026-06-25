import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "prism", name: "Prism",
  description: "Each section header cycles through a spectrum of accent colors — vivid and distinctive.",
  isAtsSafe: true, density: "balanced", className: "template-prism", thumbnailClassName: "thumbnail-prism", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [37, 99, 235] },
} satisfies ResumeTemplateConfig;
