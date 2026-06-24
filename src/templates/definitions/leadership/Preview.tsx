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
  const leadershipSections = bodySections.filter((section) =>
    ["experience", "awards"].includes(section.type),
  );
  const supportingSections = bodySections.filter(
    (section) => section.type !== "summary" && !["experience", "awards"].includes(section.type),
  );

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      <TemplateContact documentTitle={document.title} section={contactSection} />
      {summarySection && (
        <section className="template-section template-section-summary leadership-summary-card">
          <h2>{summarySection.title}</h2>
          {renderSectionContent ? (
            <div className="template-section-body">{renderSectionContent(summarySection)}</div>
          ) : (
            <SectionContent section={summarySection} />
          )}
        </section>
      )}
      <div className="leadership-main-grid">
        <div>
          {leadershipSections.map((section) => (
            <TemplateSection
              section={section}
              key={section.id}
              renderSectionContent={renderSectionContent}
            />
          ))}
        </div>
        <aside>
          {supportingSections.map((section) => (
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
