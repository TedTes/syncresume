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
      <header className="compact-header">
        {name && <h1>{name}</h1>}
        {details.length > 0 && <p>{details.join(" · ")}</p>}
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
