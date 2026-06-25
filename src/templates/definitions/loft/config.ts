import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "loft", name: "Loft",
  description: "Rust-orange accent on warm off-white — industrial warmth for engineering and product.",
  isAtsSafe: true, density: "balanced", className: "template-loft", thumbnailClassName: "thumbnail-loft", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [194, 65, 12] },
} satisfies ResumeTemplateConfig;
