import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "forest", name: "Forest",
  description: "Dark emerald-green accent with a bold contact header and forest-tone typography.",
  isAtsSafe: true, density: "balanced", className: "template-forest", thumbnailClassName: "thumbnail-forest", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [20, 83, 45] },
} satisfies ResumeTemplateConfig;
