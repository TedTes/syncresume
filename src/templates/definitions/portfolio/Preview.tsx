import { TemplateContact, TemplateSection } from "../../shared/renderers";
import type { TemplatePreviewProps } from "../../shared/types";

const RAIL_TYPES = new Set(["skills", "languages", "certifications", "education"]);

export function Preview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const railSections = bodySections.filter((s) => RAIL_TYPES.has(s.type));
  const railIds = new Set(railSections.map((s) => s.id));
  const mainSections = bodySections.filter((s) => !railIds.has(s.id));

  // In the main column, projects lead before experience
  const projectSections = mainSections.filter((s) => s.type === "projects");
  const summarySections = mainSections.filter((s) => s.type === "summary");
  const otherMainSections = mainSections.filter(
    (s) => s.type !== "projects" && s.type !== "summary",
  );
  const orderedMain = [...summarySections, ...projectSections, ...otherMainSections];

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      <aside className="template-sidebar-rail">
        <TemplateContact documentTitle={document.title} section={contactSection} />
        {railSections.map((section) => (
          <TemplateSection
            section={section}
            key={section.id}
            renderSectionContent={renderSectionContent}
          />
        ))}
      </aside>
      <div className="template-sidebar-main">
        {orderedMain.map((section) => (
          <TemplateSection
            section={section}
            key={section.id}
            renderSectionContent={renderSectionContent}
          />
        ))}
      </div>
    </article>
  );
}
