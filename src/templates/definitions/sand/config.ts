import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "sand", name: "Sand",
  description: "Warm sandy palette with soft amber tones — understated and approachable.",
  isAtsSafe: true, density: "comfortable", className: "template-sand", thumbnailClassName: "thumbnail-sand", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 46, fontSize: 9.5, lineHeight: 13.5, headingSize: 10.5, sectionGap: 10, accent: [146, 64, 14] },
} satisfies ResumeTemplateConfig;
