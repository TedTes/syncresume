import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "beryl", name: "Beryl",
  description: "Bright teal-beryl accent — fresh and modern for tech, sustainability, and health.",
  isAtsSafe: true, density: "balanced", className: "template-beryl", thumbnailClassName: "thumbnail-beryl", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [13, 148, 136] },
} satisfies ResumeTemplateConfig;
