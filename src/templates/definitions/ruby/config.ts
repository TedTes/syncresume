import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "ruby", name: "Ruby",
  description: "Deep ruby red accent — rich, premium, and memorable for creative roles.",
  isAtsSafe: true, density: "balanced", className: "template-ruby", thumbnailClassName: "thumbnail-ruby", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [153, 27, 27] },
} satisfies ResumeTemplateConfig;
