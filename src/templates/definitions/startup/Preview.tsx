import { SectionContent, TemplateContact, TemplateSection } from "../../shared/renderers";
import type { TemplatePreviewProps } from "../../shared/types";

export function Preview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const projectsSections = bodySections.filter((s) => s.type === "projects");
  const otherSections = bodySections.filter((s) => s.type !== "projects");

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      <TemplateContact documentTitle={document.title} section={contactSection} />

      {projectsSections.map((section) => (
        <section
          key={section.id}
          className={`template-section template-section-${section.type} startup-projects-feature`}
        >
          <h2>{section.title}</h2>
          {renderSectionContent ? (
            <div className="template-section-body">{renderSectionContent(section)}</div>
          ) : (
            <SectionContent section={section} />
          )}
        </section>
      ))}

      {otherSections.map((section) => (
        <TemplateSection
          section={section}
          key={section.id}
          renderSectionContent={renderSectionContent}
        />
      ))}
    </article>
  );
}
