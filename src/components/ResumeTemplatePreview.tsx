import type { ReactNode } from "react";
import type { ResumeDocument, ResumeSection } from "../lib/resumeDocument";
import { getResumeTemplate, orderSectionsForTemplate } from "../lib/resumeTemplates";
import type { ResumeTemplateId } from "../lib/resumeTemplates";

type ResumeTemplatePreviewProps = {
  document: ResumeDocument;
  templateId: ResumeTemplateId;
};

export function ResumeTemplatePreview({ document, templateId }: ResumeTemplatePreviewProps) {
  const template = getResumeTemplate(templateId);
  const sections = orderSectionsForTemplate(document, template);
  const contactSection = sections.find((section) => section.type === "contact");
  const bodySections = sections.filter((section) => section.type !== "contact");

  return (
    <article className={`resume-template-preview ${template.className}`} aria-label={`${template.name} preview`}>
      {contactSection ? (
        <header className="template-contact">
          {renderContact(contactSection)}
        </header>
      ) : (
        <header className="template-contact">
          <h1>{document.title.replace(/\.[^.]+$/, "")}</h1>
        </header>
      )}

      {bodySections.map((section) => (
        <section className="template-section" key={section.id}>
          <h2>{section.title}</h2>
          <SectionContent section={section} />
        </section>
      ))}
    </article>
  );
}

function renderContact(section: ResumeSection) {
  const { name, details } = splitContactContent(section.content);

  return (
    <>
      <h1>{name || section.title}</h1>
      {details.length > 0 && <p>{details.join(" | ")}</p>}
    </>
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
