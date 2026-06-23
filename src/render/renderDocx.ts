import type { ResumeDocument } from "../resume/schema";
import {
  getResumeTemplateDefinition,
  type ResumeTemplateId,
} from "../templates/registry";
import type { TemplateDocxBlock } from "../templates/shared/types";

export function getTemplateDocxBlocks(
  document: ResumeDocument,
  templateId: ResumeTemplateId,
): TemplateDocxBlock[] {
  const template = getResumeTemplateDefinition(templateId);
  return template.renderDocx(document, template);
}
