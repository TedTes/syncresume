import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "solar", name: "Solar",
  description: "Warm golden-amber accent — optimistic and energetic for sales and startup roles.",
  isAtsSafe: true, density: "balanced", className: "template-solar", thumbnailClassName: "thumbnail-solar", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [180, 83, 9] },
} satisfies ResumeTemplateConfig;
