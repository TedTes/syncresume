import type { ResumeDocument } from "../../resume/schema";
import { orderSectionsForTemplate } from "./orderSections";
import type { ResumeTemplateConfig, TemplateDocxBlock } from "./types";

export function renderSharedDocxBlocks(
  document: ResumeDocument,
  template: ResumeTemplateConfig,
): TemplateDocxBlock[] {
  return orderSectionsForTemplate(document, template).map((section) => ({
    id: section.id,
    type: section.type,
    title: section.title,
    lines: section.content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean),
    isContact: section.type === "contact",
  }));
}
