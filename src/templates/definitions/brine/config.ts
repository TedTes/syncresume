import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "brine", name: "Brine",
  description: "Salt-white background with deep sea-navy accents — clean and coastal.",
  isAtsSafe: true, density: "balanced", className: "template-brine", thumbnailClassName: "thumbnail-brine", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [30, 58, 95] },
} satisfies ResumeTemplateConfig;
