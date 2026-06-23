import { getResumeTemplate, type ResumeTemplateId } from "../templates/registry";
import type { ResumeDocument } from "../resume/schema";
import { DEFAULT_TEMPLATE_PREVIEW_DOCUMENT } from "../resume/sample";
import { ResumeTemplatePreview } from "./ResumeTemplatePreview";

type ResumeTemplateThumbnailProps = {
  templateId: ResumeTemplateId;
  document?: ResumeDocument | null;
};

export function ResumeTemplateThumbnail({ templateId, document = null }: ResumeTemplateThumbnailProps) {
  const template = getResumeTemplate(templateId);
  const previewDocument = document ?? DEFAULT_TEMPLATE_PREVIEW_DOCUMENT;

  return (
    <span className={`template-thumbnail template-thumbnail-live ${template.thumbnailClassName}`} aria-hidden="true">
      <ResumeTemplatePreview document={previewDocument} templateId={templateId} />
    </span>
  );
}
