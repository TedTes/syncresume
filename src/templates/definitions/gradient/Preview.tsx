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
  const { name, details } = parseResumeContact(contactSection?.content ?? "", document.title);

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      {contactSection && renderContactSectionContent ? (
        <div className="gradient-head template-contact-editable">
          {renderContactSectionContent(contactSection)}
        </div>
      ) : (
        <div className="gradient-head">
          {name && <h1>{name}</h1>}
          <ContactDetailList details={details} />
        </div>
      )}
      <div className="gradient-body">
        {bodySections.map((s) => (
          <TemplateSection section={s} key={s.id} renderSectionContent={renderSectionContent} />
        ))}
      </div>
    </article>
  );
}
