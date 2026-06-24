import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "river", name: "River",
  description: "Each section flows from a gradient vertical line — calm, flowing visual rhythm.",
  isAtsSafe: true, density: "balanced", className: "template-river", thumbnailClassName: "thumbnail-river", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [2, 132, 199] },
} satisfies ResumeTemplateConfig;
