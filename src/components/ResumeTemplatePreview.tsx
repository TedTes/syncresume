import type { CSSProperties, ReactNode } from "react";
import type { ResumeDocument, ResumeSection } from "../resume/schema";
import {
  getResumeTemplateDefinition,
  orderSectionsForTemplate,
  type ResumeTemplateId,
} from "../templates/registry";
import { TemplateRenderProvider } from "../templates/shared/renderers";
import {
  DEFAULT_RESUME_FONT_ID,
  getResumeFontOption,
  type ResumeFontId,
} from "../templates/shared/fonts";

type ResumeTemplatePreviewProps = {
  document: ResumeDocument;
  templateId: ResumeTemplateId;
  fontId?: ResumeFontId;
  afterPreviewContent?: ReactNode;
  renderContactSectionContent?: (section: ResumeSection) => ReactNode;
  renderSectionContent?: (section: ResumeSection) => ReactNode;
};

export function ResumeTemplatePreview({
  document,
  templateId,
  fontId = DEFAULT_RESUME_FONT_ID,
  afterPreviewContent,
  renderContactSectionContent,
  renderSectionContent,
}: ResumeTemplatePreviewProps) {
  const template = getResumeTemplateDefinition(templateId);
  const font = getResumeFontOption(fontId);
  const sections = orderSectionsForTemplate(document, template);
  const contactSection = sections.find((section) => section.type === "contact");
  const bodySections = sections.filter((section) => section.type !== "contact");
  const Preview = template.Preview;
  const fontStyle =
    fontId === DEFAULT_RESUME_FONT_ID
      ? undefined
      : ({ "--resume-font-family": font.cssFamily } as CSSProperties);

  return (
    <TemplateRenderProvider renderContactSectionContent={renderContactSectionContent}>
      <div
        className={`resume-template-font-scope${
          fontId === DEFAULT_RESUME_FONT_ID ? "" : " has-custom-font"
        }`}
        data-resume-font={fontId}
        style={fontStyle}
      >
        <Preview
          document={document}
          template={template}
          font={font}
          fontId={fontId}
          sections={sections}
          contactSection={contactSection}
          bodySections={bodySections}
          renderSectionContent={renderSectionContent}
        />
        {afterPreviewContent}
      </div>
    </TemplateRenderProvider>
  );
}
