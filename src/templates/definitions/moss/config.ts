import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "moss", name: "Moss",
  description: "Deep olive-moss green palette — earthy, grounded, and quietly confident.",
  isAtsSafe: true, density: "balanced", className: "template-moss", thumbnailClassName: "thumbnail-moss", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [54, 83, 20] },
} satisfies ResumeTemplateConfig;
