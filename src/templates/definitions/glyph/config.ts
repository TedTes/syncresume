import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "glyph", name: "Glyph",
  description: "Large ghost-numeral behind each section heading — typographic depth and rhythm.",
  isAtsSafe: true, density: "balanced", className: "template-glyph", thumbnailClassName: "thumbnail-glyph", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [30, 30, 60] },
} satisfies ResumeTemplateConfig;
