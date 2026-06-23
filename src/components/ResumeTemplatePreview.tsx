import type { ReactNode } from "react";
import type { ResumeDocument, ResumeSection } from "../resume/schema";
import {
  getResumeTemplateDefinition,
  orderSectionsForTemplate,
  type ResumeTemplateId,
} from "../templates/registry";

type ResumeTemplatePreviewProps = {
  document: ResumeDocument;
  templateId: ResumeTemplateId;
  renderSectionContent?: (section: ResumeSection) => ReactNode;
};

export function ResumeTemplatePreview({
  document,
  templateId,
  renderSectionContent,
}: ResumeTemplatePreviewProps) {
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
      renderSectionContent={renderSectionContent}
    />
  );
}
