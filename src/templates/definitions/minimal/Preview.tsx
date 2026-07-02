import type { ReactNode } from "react";
import type { ResumeSection } from "../../../resume/schema";
import { parseResumeContact } from "../../../resume/contact";
import { ContactDetailList, SectionContent, useTemplateContactRenderer } from "../../shared/renderers";
import type { TemplatePreviewProps } from "../../shared/types";

function MinimalSection({
  section,
  renderSectionContent,
}: {
  section: ResumeSection;
  renderSectionContent?: (section: ResumeSection) => ReactNode;
}) {
  return (
    <section className={`template-section template-section-${section.type}`}>
      <p className="minimal-section-label">{section.title}</p>
      {renderSectionContent ? (
        <div className="template-section-body">{renderSectionContent(section)}</div>
      ) : (
        <SectionContent section={section} />
      )}
    </section>
  );
}

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
        <header className="template-contact template-contact-editable">
          {renderContactSectionContent(contactSection)}
        </header>
      ) : (
        <header className="template-contact">
          {name && <h1>{name}</h1>}
          <ContactDetailList details={details} />
        </header>
      )}
      {bodySections.map((section) => (
        <MinimalSection
          section={section}
          key={section.id}
          renderSectionContent={renderSectionContent}
        />
      ))}
    </article>
  );
}
