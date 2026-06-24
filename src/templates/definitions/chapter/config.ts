import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "chapter", name: "Chapter",
  description: "Roman numeral section markers (I · II · III) give each section a book-chapter feel.",
  isAtsSafe: true, density: "comfortable", className: "template-chapter", thumbnailClassName: "thumbnail-chapter", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 46, fontSize: 9.5, lineHeight: 13.5, headingSize: 10.5, sectionGap: 10, accent: [124, 58, 237] },
} satisfies ResumeTemplateConfig;
