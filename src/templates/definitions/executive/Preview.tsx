import { parseResumeContact } from "../../../resume/contact";
import { SectionContent, TemplateContact, TemplateSection } from "../../shared/renderers";
import type { TemplatePreviewProps } from "../../shared/types";

export function Preview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const summarySection = bodySections.find((s) => s.type === "summary");
  const remainingSections = bodySections.filter((s) => s.type !== "summary");
  const { name, details } = parseResumeContact(
    contactSection?.content ?? "",
    document.title,
  );

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      <header className="executive-header">
        {name && <h1>{name}</h1>}
        {details.length > 0 && (
          <div className="executive-header-contact">
            {details.map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
        )}
      </header>

      {summarySection && (
        <div className="executive-summary-block">
          {renderSectionContent ? (
            <div className="template-section-body">
              {renderSectionContent(summarySection)}
            </div>
          ) : (
            <SectionContent section={summarySection} />
          )}
        </div>
      )}

      {remainingSections.map((section) => (
        <TemplateSection
          section={section}
          key={section.id}
          renderSectionContent={renderSectionContent}
        />
      ))}
    </article>
  );
}
