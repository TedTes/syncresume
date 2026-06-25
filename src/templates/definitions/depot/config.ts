import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "depot", name: "Depot",
  description: "Industrial-weight horizontal dividers between sections — bold, structured, no-nonsense.",
  isAtsSafe: true, density: "balanced", className: "template-depot", thumbnailClassName: "thumbnail-depot", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 10, accent: [30, 30, 40] },
} satisfies ResumeTemplateConfig;
