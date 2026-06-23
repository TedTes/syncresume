import type { ReactElement } from "react";
import { ResumeTemplatePreview } from "../components/ResumeTemplatePreview";
import type { ResumeDocument } from "../resume/schema";
import type { ResumeTemplateId } from "../templates/registry";

export function renderResumeHtmlElement(
  document: ResumeDocument,
  templateId: ResumeTemplateId,
): ReactElement {
  return <ResumeTemplatePreview document={document} templateId={templateId} />;
}
