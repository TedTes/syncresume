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
  const otherSections = bodySections.filter((s) => s.type !== "summary");

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      <TemplateContact documentTitle={document.title} section={contactSection} />
      {summarySection && (
        <div className="layer-summary-card">
          {renderSectionContent ? (
            <div className="template-section-body">{renderSectionContent(summarySection)}</div>
          ) : (
            <SectionContent section={summarySection} />
          )}
        </div>
      )}
      {otherSections.map((s) => (
        <TemplateSection section={s} key={s.id} renderSectionContent={renderSectionContent} />
      ))}
    </article>
  );
}
