import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "scout", name: "Scout",
  description: "Bold filled-circle markers before section titles — decisive and energetic.",
  isAtsSafe: true, density: "balanced", className: "template-scout", thumbnailClassName: "thumbnail-scout", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [220, 38, 38] },
} satisfies ResumeTemplateConfig;
