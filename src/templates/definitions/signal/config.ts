import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "signal", name: "Signal",
  description: "High-contrast black typography with vivid red signal-dot accents and crisp spacing.",
  isAtsSafe: true, density: "balanced", className: "template-signal", thumbnailClassName: "thumbnail-signal", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [239, 68, 68] },
} satisfies ResumeTemplateConfig;
