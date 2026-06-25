import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "quartz", name: "Quartz",
  description: "Crystal-clean layout — hairline rules, maximum whitespace, refined and editorial.",
  isAtsSafe: true, density: "comfortable", className: "template-quartz", thumbnailClassName: "thumbnail-quartz", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 52, fontSize: 9.5, lineHeight: 14, headingSize: 10, sectionGap: 12, accent: [100, 116, 139] },
} satisfies ResumeTemplateConfig;
