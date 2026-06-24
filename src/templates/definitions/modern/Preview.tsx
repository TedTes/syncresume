import { parseResumeContact } from "../../../resume/contact";
import { TemplateSection } from "../../shared/renderers";
import type { TemplatePreviewProps } from "../../shared/types";

export function Preview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const { name, details } = parseResumeContact(
    contactSection?.content ?? "",
    document.title,
  );

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      <header className="modern-split-header">
        <div className="modern-split-name">
          {name && <h1>{name}</h1>}
        </div>
        {details.length > 0 && (
          <div className="modern-split-contact">
            {details.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
        )}
      </header>
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
