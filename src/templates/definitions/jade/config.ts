import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "jade", name: "Jade",
  description: "Deep jade-green palette — calm authority for finance, law, and consulting.",
  isAtsSafe: true, density: "balanced", className: "template-jade", thumbnailClassName: "thumbnail-jade", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [6, 78, 59] },
} satisfies ResumeTemplateConfig;
