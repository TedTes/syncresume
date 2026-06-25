import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "arctic", name: "Arctic",
  description: "Ice-blue tinted background with deep blue accent — cool, focused, and technical.",
  isAtsSafe: true, density: "balanced", className: "template-arctic", thumbnailClassName: "thumbnail-arctic", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [3, 105, 161] },
} satisfies ResumeTemplateConfig;
