import type { ReactNode } from "react";
import type { ResumeDocument, ResumeSection } from "../resume/schema";
import {
  getResumeTemplateDefinition,
  orderSectionsForTemplate,
  type ResumeTemplateId,
} from "../templates/registry";
import { TemplateRenderProvider } from "../templates/shared/renderers";

type ResumeTemplatePreviewProps = {
  document: ResumeDocument;
  templateId: ResumeTemplateId;
  renderContactSectionContent?: (section: ResumeSection) => ReactNode;
  renderSectionContent?: (section: ResumeSection) => ReactNode;
};

export function ResumeTemplatePreview({
  document,
  templateId,
  renderContactSectionContent,
  renderSectionContent,
}: ResumeTemplatePreviewProps) {
  const template = getResumeTemplateDefinition(templateId);
  const sections = orderSectionsForTemplate(document, template);
  const contactSection = sections.find((section) => section.type === "contact");
  const bodySections = sections.filter((section) => section.type !== "contact");
  const Preview = template.Preview;

  return (
    <TemplateRenderProvider renderContactSectionContent={renderContactSectionContent}>
      <Preview
        document={document}
        template={template}
        sections={sections}
        contactSection={contactSection}
        bodySections={bodySections}
        renderSectionContent={renderSectionContent}
      />
    </TemplateRenderProvider>
  );
}
