import { parseResumeContact } from "../../../resume/contact";
import { ContactDetailList, TemplateSection, useTemplateContactRenderer } from "../../shared/renderers";
import type { TemplatePreviewProps } from "../../shared/types";

export function Preview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const renderContactSectionContent = useTemplateContactRenderer();
  const { name, details } = parseResumeContact(
    contactSection?.content ?? "",
    document.title,
  );

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      {contactSection && renderContactSectionContent ? (
        <header className="compact-header template-contact-editable">
          {renderContactSectionContent(contactSection)}
        </header>
      ) : (
        <header className="compact-header">
          {name && <h1>{name}</h1>}
          <ContactDetailList details={details} />
        </header>
      )}
      {bodySections.map((section) => (
        <TemplateSection
          section={section}
          key={section.id}
          renderSectionContent={renderSectionContent}
        />
      ))}
    </article>
  );
}
