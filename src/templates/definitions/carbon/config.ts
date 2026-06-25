import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "carbon", name: "Carbon",
  description: "Dark carbon-black contact band above a clean white body — sharp contrast, executive presence.",
  isAtsSafe: true, density: "balanced", className: "template-carbon", thumbnailClassName: "thumbnail-carbon", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [24, 24, 27] },
} satisfies ResumeTemplateConfig;
