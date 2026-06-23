import type { ResumeDocument, ResumeSection } from "../../resume/schema";
import type { ResumeTemplateConfig } from "./types";

export function orderSectionsForTemplate(
  document: ResumeDocument,
  template: ResumeTemplateConfig,
): ResumeSection[] {
  const orderRank = new Map(template.sectionOrder.map((type, index) => [type, index]));
  return [...document.sections]
    .filter((section) => section.content.trim() || section.title.trim())
    .sort((left, right) => {
      const leftRank = orderRank.get(left.type) ?? orderRank.get("custom") ?? 999;
      const rightRank = orderRank.get(right.type) ?? orderRank.get("custom") ?? 999;
      return leftRank - rightRank || left.order - right.order;
    });
}
