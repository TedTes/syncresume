import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "chalk", name: "Chalk",
  description: "Dark charcoal section headers with chalk-white text on a warm cream background.",
  isAtsSafe: true, density: "balanced", className: "template-chalk", thumbnailClassName: "thumbnail-chalk", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [28, 37, 55] },
} satisfies ResumeTemplateConfig;
