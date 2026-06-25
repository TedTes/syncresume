import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "cedar", name: "Cedar",
  description: "Warm cedar brown with an off-white tint — earthy and grounded for any industry.",
  isAtsSafe: true, density: "balanced", className: "template-cedar", thumbnailClassName: "thumbnail-cedar", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [124, 52, 32] },
} satisfies ResumeTemplateConfig;
