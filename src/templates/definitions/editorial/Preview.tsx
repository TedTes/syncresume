import { SectionContent, TemplateContact, TemplateSection } from "../../shared/renderers";
import type { TemplatePreviewProps } from "../../shared/types";

export function Preview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const summarySection = bodySections.find((section) => section.type === "summary");
  const featureSections = bodySections.filter((section) =>
    ["experience", "projects"].includes(section.type),
  );
  const secondarySections = bodySections.filter(
    (section) => section.type !== "summary" && !["experience", "projects"].includes(section.type),
  );

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      <TemplateContact documentTitle={document.title} section={contactSection} />
      {summarySection && (
        <section className="template-section template-section-summary editorial-lede">
          <h2>{summarySection.title}</h2>
          {renderSectionContent ? (
            <div className="template-section-body">{renderSectionContent(summarySection)}</div>
          ) : (
            <SectionContent section={summarySection} />
          )}
        </section>
      )}
      <div className="editorial-body-grid">
        <div className="editorial-feature-column">
          {featureSections.map((section) => (
            <TemplateSection
              section={section}
              key={section.id}
              renderSectionContent={renderSectionContent}
            />
          ))}
        </div>
        <aside className="editorial-side-column">
          {secondarySections.map((section) => (
            <TemplateSection
              section={section}
              key={section.id}
              renderSectionContent={renderSectionContent}
            />
          ))}
        </aside>
      </div>
    </article>
  );
}
