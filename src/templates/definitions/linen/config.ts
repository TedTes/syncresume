import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "linen", name: "Linen",
  description: "Warm linen-cream background with soft brown tones — cozy and approachable.",
  isAtsSafe: true, density: "comfortable", className: "template-linen", thumbnailClassName: "thumbnail-linen", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 46, fontSize: 9.5, lineHeight: 13.5, headingSize: 10.5, sectionGap: 10, accent: [120, 53, 15] },
} satisfies ResumeTemplateConfig;
