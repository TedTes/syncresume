import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "alto", name: "Alto",
  description: "Gold luxury accent with elegant thin lines — refined and premium.",
  isAtsSafe: true, density: "comfortable", className: "template-alto", thumbnailClassName: "thumbnail-alto", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 46, fontSize: 9.5, lineHeight: 13.5, headingSize: 10.5, sectionGap: 10, accent: [202, 138, 4] },
} satisfies ResumeTemplateConfig;
