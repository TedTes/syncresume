import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "onyx", name: "Onyx",
  description: "Jet-black section bars with white labels — high contrast and commanding.",
  isAtsSafe: true, density: "balanced", className: "template-onyx", thumbnailClassName: "thumbnail-onyx", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10, sectionGap: 10, accent: [24, 24, 27] },
} satisfies ResumeTemplateConfig;
