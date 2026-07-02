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
        <header className="modern-split-header template-contact-editable">
          {renderContactSectionContent(contactSection)}
        </header>
      ) : (
        <header className="modern-split-header">
          <div className="modern-split-name">
            {name && <h1>{name}</h1>}
          </div>
          {details.length > 0 && (
            <div className="modern-split-contact">
              <ContactDetailList details={details} />
            </div>
          )}
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
