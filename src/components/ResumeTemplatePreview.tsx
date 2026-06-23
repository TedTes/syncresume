import type { ResumeDocument } from "../resume/schema";
import {
  getResumeTemplateDefinition,
  orderSectionsForTemplate,
  type ResumeTemplateId,
} from "../templates/registry";

type ResumeTemplatePreviewProps = {
  document: ResumeDocument;
  templateId: ResumeTemplateId;
};

export function ResumeTemplatePreview({ document, templateId }: ResumeTemplatePreviewProps) {
  const template = getResumeTemplateDefinition(templateId);
  const sections = orderSectionsForTemplate(document, template);
  const contactSection = sections.find((section) => section.type === "contact");
  const bodySections = sections.filter((section) => section.type !== "contact");
  const Preview = template.Preview;

  return (
    <Preview
      document={document}
      template={template}
      sections={sections}
      contactSection={contactSection}
      bodySections={bodySections}
    />
  );
}
