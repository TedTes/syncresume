import type { ReactNode } from "react";
import type { ResumeSection } from "../../resume/schema";
import { parseResumeContact } from "../../resume/contact";
import type { TemplatePreviewProps } from "./types";

// ─── Primitives (exported for custom Preview.tsx files) ─────────────────────

export function TemplateContact({
  documentTitle,
  section,
  className = "template-contact",
}: {
  documentTitle: string;
  section?: ResumeSection;
  className?: string;
}) {
  if (!section) {
    const { name } = parseResumeContact("", documentTitle);
    if (!name) return null;
    return (
      <header className={className}>
        <h1>{name}</h1>
      </header>
    );
  }

  const { name, details } = parseResumeContact(section.content, documentTitle);
  return (
    <header className={className}>
      {name && <h1>{name}</h1>}
      {details.length > 0 && <p>{details.join(" | ")}</p>}
    </header>
  );
}

export function TemplateSection({
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

export function SectionContent({ section }: { section: ResumeSection }) {
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

// ─── Shared Layout Renderers ─────────────────────────────────────────────────

export function SingleColumnPreview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
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

export function TechnicalPreview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
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

// Real timeline: career/education sections get a connected dot-and-stem track.
export function TimelinePreview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const TRACK_TYPES = new Set(["experience", "projects", "education"]);
  const preSections = bodySections.filter((s) => ["summary", "skills", "languages"].includes(s.type));
  const trackSections = bodySections.filter((s) => TRACK_TYPES.has(s.type));
  const postSections = bodySections.filter(
    (s) => !TRACK_TYPES.has(s.type) && !["summary", "skills", "languages"].includes(s.type),
  );

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      <TemplateContact documentTitle={document.title} section={contactSection} />
      {preSections.map((s) => (
        <TemplateSection section={s} key={s.id} renderSectionContent={renderSectionContent} />
      ))}
      {trackSections.length > 0 && (
        <div className="template-timeline-track">
          {trackSections.map((section) => (
            <div
              key={section.id}
              className={`template-timeline-entry template-section-${section.type}`}
            >
              <h2>{section.title}</h2>
              {renderSectionContent ? (
                <div className="template-section-body">{renderSectionContent(section)}</div>
              ) : (
                <SectionContent section={section} />
              )}
            </div>
          ))}
        </div>
      )}
      {postSections.map((s) => (
        <TemplateSection section={s} key={s.id} renderSectionContent={renderSectionContent} />
      ))}
    </article>
  );
}
