import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "petal", name: "Petal",
  description: "Soft blush-pink accent — gentle and expressive for creative and education roles.",
  isAtsSafe: true, density: "balanced", className: "template-petal", thumbnailClassName: "thumbnail-petal", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [190, 24, 93] },
} satisfies ResumeTemplateConfig;
