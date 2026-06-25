import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "tropic", name: "Tropic",
  description: "Vivid coral-orange accent — energetic and memorable for marketing and design roles.",
  isAtsSafe: true, density: "balanced", className: "template-tropic", thumbnailClassName: "thumbnail-tropic", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [234, 88, 12] },
} satisfies ResumeTemplateConfig;
