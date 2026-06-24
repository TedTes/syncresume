import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "ocean", name: "Ocean",
  description: "Deep ocean teal palette with a left-aligned contact and teal section borders.",
  isAtsSafe: true, density: "balanced", className: "template-ocean", thumbnailClassName: "thumbnail-ocean", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [14, 116, 144] },
} satisfies ResumeTemplateConfig;
