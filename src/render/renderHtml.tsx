import type { ReactElement } from "react";
import { ResumeTemplatePreview } from "../components/ResumeTemplatePreview";
import type { ResumeDocument } from "../resume/schema";
import type { ResumeTemplateId } from "../templates/registry";
import type { ResumeFontId } from "../templates/shared/fonts";

export function renderResumeHtmlElement(
  document: ResumeDocument,
  templateId: ResumeTemplateId,
  fontId?: ResumeFontId,
): ReactElement {
  return <ResumeTemplatePreview document={document} templateId={templateId} fontId={fontId} />;
}
