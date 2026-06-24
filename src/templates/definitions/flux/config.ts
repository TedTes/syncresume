import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "flux", name: "Flux",
  description: "Alternating light-tinted section bands create visual rhythm without heavy decoration.",
  isAtsSafe: true, density: "balanced", className: "template-flux", thumbnailClassName: "thumbnail-flux", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [99, 102, 241] },
} satisfies ResumeTemplateConfig;
