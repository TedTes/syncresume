import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "peak", name: "Peak",
  description: "Teal chevron › before each section title — clean directional energy.",
  isAtsSafe: true, density: "balanced", className: "template-peak", thumbnailClassName: "thumbnail-peak", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [8, 145, 178] },
} satisfies ResumeTemplateConfig;
