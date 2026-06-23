import { getResumeTemplate } from "../lib/resumeTemplates";
import type { ResumeTemplateId } from "../lib/resumeTemplates";

type ResumeTemplateThumbnailProps = {
  templateId: ResumeTemplateId;
};

export function ResumeTemplateThumbnail({ templateId }: ResumeTemplateThumbnailProps) {
  const template = getResumeTemplate(templateId);

  return (
    <span className={`template-thumbnail ${template.thumbnailClassName}`} aria-hidden="true">
      <span className="template-thumbnail-header" />
      <span className="template-thumbnail-body">
        <span />
        <span />
        <span />
        <span />
      </span>
      <span className="template-thumbnail-footer" />
    </span>
  );
}
