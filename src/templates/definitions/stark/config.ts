import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "stark", name: "Stark",
  description: "Zero decoration — pure typographic weight contrast with generous breathing room.",
  isAtsSafe: true, density: "comfortable", className: "template-stark", thumbnailClassName: "thumbnail-stark", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 52, fontSize: 9.5, lineHeight: 14, headingSize: 11, sectionGap: 13, accent: [15, 15, 20] },
} satisfies ResumeTemplateConfig;
