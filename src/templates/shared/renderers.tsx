import type { ReactNode } from "react";
import type { ResumeSection } from "../../resume/schema";
import type { TemplatePreviewProps } from "./types";

export function SingleColumnPreview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  return (
    <article className={`resume-template-preview ${template.className}`} aria-label={`${template.name} preview`}>
      <TemplateContact documentTitle={document.title} section={contactSection} />
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

export function SidebarPreview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const railSections = bodySections.filter((section) =>
    ["skills", "languages", "certifications", "education"].includes(section.type),
  );
  const railSectionIds = new Set(railSections.map((section) => section.id));
  const mainSections = bodySections.filter((section) => !railSectionIds.has(section.id));

  return (
    <article className={`resume-template-preview ${template.className}`} aria-label={`${template.name} preview`}>
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
        {mainSections.map((section) => (
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

export function TimelinePreview(props: TemplatePreviewProps) {
  return <SingleColumnPreview {...props} />;
}

export function TechnicalPreview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  return (
    <article className={`resume-template-preview ${template.className}`} aria-label={`${template.name} preview`}>
      <TemplateContact documentTitle={document.title} section={contactSection} />
      <div className="template-technical-grid">
        {bodySections.map((section) => (
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

function TemplateContact({
  documentTitle,
  section,
}: {
  documentTitle: string;
  section?: ResumeSection;
}) {
  if (!section) {
    const title = documentTitle.replace(/\.[^.]+$/, "").trim();
    if (!title) return null;

    return (
      <header className="template-contact">
        <h1>{title}</h1>
      </header>
    );
  }

  const { name, details } = splitContactContent(section.content);
  return (
    <header className="template-contact">
      <h1>{name || section.title}</h1>
      {details.length > 0 && <p>{details.join(" | ")}</p>}
    </header>
  );
}

function TemplateSection({
  section,
  renderSectionContent,
}: {
  section: ResumeSection;
  renderSectionContent?: (section: ResumeSection) => ReactNode;
}) {
  return (
    <section className={`template-section template-section-${section.type}`}>
      <h2>{section.title}</h2>
      {renderSectionContent ? (
        <div className="template-section-body">{renderSectionContent(section)}</div>
      ) : (
        <SectionContent section={section} />
      )}
    </section>
  );
}

function splitContactContent(content: string): { name: string; details: string[] } {
  const chunks = content
    .split(/\n|\s*\|\s*/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstChunk = chunks[0] ?? "";
  const nameMatch = firstChunk.match(/^([A-Z][A-Z.'-]+(?:\s+[A-Z][A-Z.'-]+){1,3})\b/);
  const name = nameMatch?.[1] ?? firstChunk;
  const leftover = firstChunk.slice(name.length).trim();
  return {
    name,
    details: [leftover, ...chunks.slice(1)].filter(Boolean),
  };
}

function SectionContent({ section }: { section: ResumeSection }) {
  const lines = section.content
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const groups: ReactNode[] = [];
  let bulletGroup: string[] = [];

  const flushBullets = () => {
    if (bulletGroup.length === 0) return;
    const currentBullets = bulletGroup;
    groups.push(
      <ul key={`bullets-${groups.length}`}>
        {currentBullets.map((line) => (
          <li key={line}>{line.replace(/^[-•]\s*/, "")}</li>
        ))}
      </ul>,
    );
    bulletGroup = [];
  };

  lines.forEach((line) => {
    if (/^[-•]\s+/.test(line)) {
      bulletGroup.push(line);
      return;
    }

    flushBullets();
    groups.push(<p key={`line-${groups.length}`}>{line}</p>);
  });

  flushBullets();
  return <div className="template-section-body">{groups}</div>;
}
