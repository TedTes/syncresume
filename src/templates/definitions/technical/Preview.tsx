import { TemplateContact, TemplateSection } from "../../shared/renderers";
import type { TemplatePreviewProps } from "../../shared/types";

function parseSkillTags(content: string): string[] {
  const tags: string[] = [];
  for (const line of content.split("\n")) {
    const trimmed = line.replace(/^[-•]\s*/, "").trim();
    if (!trimmed) continue;
    if (trimmed.includes(",")) {
      tags.push(...trimmed.split(",").map((s) => s.trim()).filter(Boolean));
    } else {
      tags.push(trimmed);
    }
  }
  return tags;
}

export function Preview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const skillsSection = bodySections.find((s) => s.type === "skills");
  const otherSections = bodySections.filter((s) => s.type !== "skills");
  const skillTags = skillsSection ? parseSkillTags(skillsSection.content) : [];

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      <TemplateContact documentTitle={document.title} section={contactSection} />

      {skillsSection && (
        <section className="template-section template-section-skills technical-skills-section">
          <h2>{skillsSection.title}</h2>
          {renderSectionContent ? (
            <div className="template-section-body">{renderSectionContent(skillsSection)}</div>
          ) : skillTags.length > 0 ? (
            <div className="technical-skill-tags">
              {skillTags.map((tag, i) => (
                <span className="technical-skill-tag" key={i}>
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </section>
      )}

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
