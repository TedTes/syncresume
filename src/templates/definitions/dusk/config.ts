import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "dusk", name: "Dusk",
  description: "Deep violet gradient contact band fading to white — atmospheric and sophisticated.",
  isAtsSafe: true, density: "balanced", className: "template-dusk", thumbnailClassName: "thumbnail-dusk", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [109, 40, 217] },
} satisfies ResumeTemplateConfig;
