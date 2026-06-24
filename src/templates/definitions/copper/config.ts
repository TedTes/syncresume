import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "copper", name: "Copper",
  description: "Vivid copper-orange accent with a bold left-border on each section.",
  isAtsSafe: true, density: "balanced", className: "template-copper", thumbnailClassName: "thumbnail-copper", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [194, 65, 12] },
} satisfies ResumeTemplateConfig;
