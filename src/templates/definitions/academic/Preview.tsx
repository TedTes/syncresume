import { TemplateContact, TemplateSection } from "../../shared/renderers";
import type { TemplatePreviewProps } from "../../shared/types";

const PRIORITY_TYPES = new Set(["education", "publications", "awards"]);

export function Preview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const summarySections = bodySections.filter((section) => section.type === "summary");
  const prioritySections = bodySections.filter((section) => PRIORITY_TYPES.has(section.type));
  const remainingSections = bodySections.filter(
    (section) => section.type !== "summary" && !PRIORITY_TYPES.has(section.type),
  );

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      <TemplateContact documentTitle={document.title} section={contactSection} />
      {summarySections.map((section) => (
        <TemplateSection
          section={section}
          key={section.id}
          renderSectionContent={renderSectionContent}
        />
      ))}
      {prioritySections.length > 0 && (
        <div className="academic-priority-block">
          {prioritySections.map((section) => (
            <TemplateSection
              section={section}
              key={section.id}
              renderSectionContent={renderSectionContent}
            />
          ))}
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
