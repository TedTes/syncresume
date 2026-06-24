import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "plum", name: "Plum",
  description: "Rich purple palette with a centered contact header and plum section underlines.",
  isAtsSafe: true, density: "comfortable", className: "template-plum", thumbnailClassName: "thumbnail-plum", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 46, fontSize: 9.5, lineHeight: 13.5, headingSize: 10.5, sectionGap: 10, accent: [126, 34, 206] },
} satisfies ResumeTemplateConfig;
