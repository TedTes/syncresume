import type { ResumeTemplateConfig } from "../../shared/types";
export const config = {
  id: "ledger", name: "Ledger",
  description: "Double-rule section borders — structured and precise for finance and operations.",
  isAtsSafe: true, density: "balanced", className: "template-ledger", thumbnailClassName: "thumbnail-ledger", renderer: "single-column",
  sectionOrder: ["contact","summary","experience","projects","skills","education","languages","certifications","awards","publications","volunteering","custom"],
  pdf: { margin: 44, fontSize: 9.5, lineHeight: 13, headingSize: 10.5, sectionGap: 9, accent: [30, 58, 100] },
} satisfies ResumeTemplateConfig;
