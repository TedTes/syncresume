import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "grain", name: "Grain",
  description: "Warm gray palette with soft texture — neutral and versatile for any industry.",
  isAtsSafe: true, density: "balanced", className: "template-grain", thumbnailClassName: "thumbnail-grain", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [71, 85, 105] },
} satisfies ResumeTemplateConfig;
