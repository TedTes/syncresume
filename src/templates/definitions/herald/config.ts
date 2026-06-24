import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "herald", name: "Herald",
  description: "Extra-large bold name with a thick rule — makes a confident, commanding first impression.",
  isAtsSafe: true, density: "balanced", className: "template-herald", thumbnailClassName: "thumbnail-herald", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 11, sectionGap: 9, accent: [15, 23, 42] },
} satisfies ResumeTemplateConfig;
