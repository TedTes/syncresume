import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "vapor", name: "Vapor",
  description: "Ultra-light 300-weight type, maximum whitespace — airy and minimal.",
  isAtsSafe: true, density: "comfortable", className: "template-vapor", thumbnailClassName: "thumbnail-vapor", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 50, fontSize: 9.5, lineHeight: 14, headingSize: 10, sectionGap: 12, accent: [100, 116, 139] },
} satisfies ResumeTemplateConfig;
