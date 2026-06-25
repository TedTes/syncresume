import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "mist", name: "Mist",
  description: "Cool blue-gray haze — soft and refined for healthcare, research, and academia.",
  isAtsSafe: true, density: "comfortable", className: "template-mist", thumbnailClassName: "thumbnail-mist", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 48, fontSize: 9.5, lineHeight: 14, headingSize: 10, sectionGap: 11, accent: [59, 82, 128] },
} satisfies ResumeTemplateConfig;
