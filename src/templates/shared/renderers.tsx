import { Github, Globe, Linkedin, Mail, MapPin, Phone } from "lucide-react";
import { createContext, useContext, type ReactNode } from "react";
import type { ResumeSection } from "../../resume/schema";
import { parseResumeContact } from "../../resume/contact";
import type { TemplatePreviewProps } from "./types";

type TemplateRenderContextValue = {
  renderContactSectionContent?: (section: ResumeSection) => ReactNode;
};

const TemplateRenderContext = createContext<TemplateRenderContextValue>({});

export function TemplateRenderProvider({
  children,
  renderContactSectionContent,
}: {
  children: ReactNode;
  renderContactSectionContent?: (section: ResumeSection) => ReactNode;
}) {
  return (
    <TemplateRenderContext.Provider value={{ renderContactSectionContent }}>
      {children}
    </TemplateRenderContext.Provider>
  );
}

// ─── Contact detail categorisation ──────────────────────────────────────────

type DetailCategory = "email" | "phone" | "linkedin" | "github" | "website" | "location";

function categorizeDetail(raw: string): { category: DetailCategory; display: string } {
  const lower = raw.toLowerCase();

  if (/\S+@\S+\.\S+/.test(raw) && !/https?:/.test(raw)) {
    return { category: "email", display: raw };
  }
  if (/linkedin\.com/i.test(lower)) {
    const slug = raw
      .replace(/https?:\/\/(?:www\.)?linkedin\.com\/in\//i, "")
      .replace(/^(?:www\.)?linkedin\.com\/in\//i, "")
      .replace(/\/$/, "");
    return { category: "linkedin", display: slug || raw };
  }
  if (/github\.com/i.test(lower)) {
    const slug = raw
      .replace(/https?:\/\/(?:www\.)?github\.com\//i, "")
      .replace(/^(?:www\.)?github\.com\//i, "")
      .replace(/\/$/, "");
    return { category: "github", display: slug || raw };
  }
  if (/https?:\/\/|www\./i.test(raw)) {
    const display = raw.replace(/https?:\/\/(?:www\.)?/i, "").replace(/\/$/, "");
    return { category: "website", display };
  }
  if (/\+?\d[\d\s().-]{5,}/.test(raw)) {
    return { category: "phone", display: raw };
  }
  return { category: "location", display: raw };
}

function DetailIcon({ category }: { category: DetailCategory }) {
  const props = { size: 10, "aria-hidden": true as const };
  switch (category) {
    case "email":    return <Mail     {...props} />;
    case "phone":    return <Phone    {...props} />;
    case "linkedin": return <Linkedin {...props} />;
    case "github":   return <Github   {...props} />;
    case "website":  return <Globe    {...props} />;
    case "location": return <MapPin   {...props} />;
  }
}

/** Renders contact details as icon + label chips. Inherits text-align from parent. */
export function ContactDetailList({ details }: { details: string[] }) {
  if (details.length === 0) return null;
  return (
    <p className="contact-detail-list">
      {details.map((raw, i) => {
        const { category, display } = categorizeDetail(raw);
        return (
          <span className="contact-detail-item" key={i}>
            <DetailIcon category={category} />
            <span>{display}</span>
          </span>
        );
      })}
    </p>
  );
}

// ─── Primitives ──────────────────────────────────────────────────────────────

export function TemplateContact({
  documentTitle,
  section,
  className = "template-contact",
}: {
  documentTitle: string;
  section?: ResumeSection;
  className?: string;
}) {
  const { renderContactSectionContent } = useContext(TemplateRenderContext);
  if (section && renderContactSectionContent) {
    return (
      <header className={`${className} template-contact-editable`}>
        <div className="template-section-body">{renderContactSectionContent(section)}</div>
      </header>
    );
  }

  const { name, details } = parseResumeContact(section?.content ?? "", documentTitle);
  if (!name && details.length === 0) return null;
  return (
    <header className={className}>
      {name && <h1>{name}</h1>}
      <ContactDetailList details={details} />
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

  if (section.contentKind === "bullets") {
    return (
      <div className="template-section-body">
        <ul>
          {lines.map((line) => (
            <li key={line}>{line.replace(/^[-•]\s*/, "")}</li>
          ))}
        </ul>
      </div>
    );
  }

  if (section.type === "projects") {
    const projectEntries = lines.flatMap(splitProjectEntries).filter(Boolean);
    if (projectEntries.length > 1) {
      return (
        <div className="template-section-body">
          <ul className="template-project-list">
            {projectEntries.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        </div>
      );
    }
  }

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
    groups.push(renderTemplateLine(line, groups.length));
  });

  flushBullets();
  return <div className="template-section-body">{groups}</div>;
}

function renderTemplateLine(line: string, index: number): ReactNode {
  const labeledLine = line.match(/^([^:]{2,42}):\s+(.+)$/);
  if (labeledLine?.[1] && labeledLine[2]) {
    return (
      <p className="template-labeled-line" key={`line-${index}`}>
        <strong>{labeledLine[1]}:</strong>
        <span>{labeledLine[2]}</span>
      </p>
    );
  }

  return <p key={`line-${index}`}>{line}</p>;
}

function splitProjectEntries(line: string): string[] {
  const withBreaks = line
    .replace(
      /\s+([A-Z][A-Za-z0-9][A-Za-z0-9 .&'()/-]{1,44}\s+[—-]\s+(?:https?:\/\/|www\.))/g,
      "\n$1",
    )
    .replace(
      /([.!?])\s+([A-Z][A-Za-z0-9][A-Za-z0-9 .&'()/-]{1,44}\s+[—-]\s+)/g,
      "$1\n$2",
    );

  return withBreaks
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean);
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
        <TemplateSection section={section} key={section.id} renderSectionContent={renderSectionContent} />
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
          <TemplateSection section={section} key={section.id} renderSectionContent={renderSectionContent} />
        ))}
      </aside>
      <div className="template-sidebar-main">
        {mainSections.map((section) => (
          <TemplateSection section={section} key={section.id} renderSectionContent={renderSectionContent} />
        ))}
      </div>
    </article>
  );
}

/** Two-column body (left: skills/education; right: experience/summary/projects). */
export function SplitPreview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const LEFT_TYPES = new Set(["skills", "languages", "education", "certifications", "awards"]);
  const leftSections = bodySections.filter((s) => LEFT_TYPES.has(s.type));
  const leftIds = new Set(leftSections.map((s) => s.id));
  const rightSections = bodySections.filter((s) => !leftIds.has(s.id));

  return (
    <article
      className={`resume-template-preview ${template.className}`}
      aria-label={`${template.name} preview`}
    >
      <TemplateContact documentTitle={document.title} section={contactSection} />
      <div className="split-body">
        <div className="split-left">
          {leftSections.map((s) => (
            <TemplateSection section={s} key={s.id} renderSectionContent={renderSectionContent} />
          ))}
        </div>
        <div className="split-right">
          {rightSections.map((s) => (
            <TemplateSection section={s} key={s.id} renderSectionContent={renderSectionContent} />
          ))}
        </div>
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
          <TemplateSection section={section} key={section.id} renderSectionContent={renderSectionContent} />
        ))}
      </div>
    </article>
  );
}

export function TimelinePreview({
  document,
  template,
  contactSection,
  bodySections,
  renderSectionContent,
}: TemplatePreviewProps) {
  const TRACK_TYPES = new Set(["experience", "projects", "education"]);
  const preSections = bodySections.filter((s) =>
    ["summary", "skills", "languages"].includes(s.type),
  );
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
