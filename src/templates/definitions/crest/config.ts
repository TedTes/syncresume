import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "crest", name: "Crest",
  description: "Centered large-cap name between two thin gold rules — symmetrical and distinguished.",
  isAtsSafe: true, density: "comfortable", className: "template-crest", thumbnailClassName: "thumbnail-crest", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 46, fontSize: 9.5, lineHeight: 13.5, headingSize: 10.5, sectionGap: 10, accent: [161, 98, 7] },
} satisfies ResumeTemplateConfig;
