import { getResumeTemplate, type ResumeTemplateId } from "../templates/registry";
import type { ResumeFontId } from "../templates/shared/fonts";
import type { ResumeDocument } from "../resume/schema";
import { DEFAULT_TEMPLATE_PREVIEW_DOCUMENT } from "../resume/sample";
import { ResumeTemplatePreview } from "./ResumeTemplatePreview";

type ResumeTemplateThumbnailProps = {
  templateId: ResumeTemplateId;
  document?: ResumeDocument | null;
  fontId?: ResumeFontId;
};

export function ResumeTemplateThumbnail({
  templateId,
  document = null,
  fontId,
}: ResumeTemplateThumbnailProps) {
  const template = getResumeTemplate(templateId);
  const previewDocument = document ?? DEFAULT_TEMPLATE_PREVIEW_DOCUMENT;

  return (
    <span className={`template-thumbnail template-thumbnail-normalized ${template.thumbnailClassName}`} aria-hidden="true">
      <span className="template-thumbnail-page">
        <ResumeTemplatePreview document={previewDocument} templateId={templateId} fontId={fontId} />
      </span>
    </span>
  );
}
