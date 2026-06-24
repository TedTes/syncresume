import { TemplateContact, TemplateSection } from "../../shared/renderers";
import type { TemplatePreviewProps } from "../../shared/types";

export function Preview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const summarySection = bodySections.find((section) => section.type === "summary");
  const skillsSection = bodySections.find((section) => section.type === "skills");
  const remainingSections = bodySections.filter(
    (section) => section.type !== "summary" && section.type !== "skills",
  );

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      <div className="crisp-header-row">
        <TemplateContact documentTitle={document.title} section={contactSection} />
      </div>
      <div className="crisp-top-grid">
        {summarySection && (
          <TemplateSection
            section={summarySection}
            renderSectionContent={renderSectionContent}
          />
        )}
        {skillsSection && (
          <TemplateSection
            section={skillsSection}
            renderSectionContent={renderSectionContent}
          />
        )}
      </div>
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
