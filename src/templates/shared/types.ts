import type { ComponentType } from "react";
import type { ResumeDocument, ResumeSection, ResumeSectionType } from "../../resume/schema";

export type ResumeTemplateId =
  | "ats-simple"
  | "modern"
  | "compact"
  | "executive"
  | "sidebar"
  | "timeline"
  | "technical";

export type ResumeTemplateRenderer = "single-column" | "sidebar" | "timeline" | "technical";
export type ResumeTemplateDensity = "comfortable" | "balanced" | "compact";

export type ResumeTemplatePdfConfig = {
  margin: number;
  fontSize: number;
  lineHeight: number;
  headingSize: number;
  sectionGap: number;
  accent: [number, number, number];
};

export type ResumeTemplateConfig = {
  id: ResumeTemplateId;
  name: string;
  description: string;
  isAtsSafe: boolean;
  density: ResumeTemplateDensity;
  className: string;
  thumbnailClassName: string;
  renderer: ResumeTemplateRenderer;
  sectionOrder: ResumeSectionType[];
  pdf: ResumeTemplatePdfConfig;
};

export type TemplatePreviewProps = {
  document: ResumeDocument;
  template: ResumeTemplateConfig;
  sections: ResumeSection[];
  contactSection?: ResumeSection;
  bodySections: ResumeSection[];
};

export type TemplateDocxBlock = {
  id: string;
  type: ResumeSectionType;
  title: string;
  lines: string[];
  isContact?: boolean;
};

export type ResumeTemplateDocxRenderer = (
  document: ResumeDocument,
  template: ResumeTemplateConfig,
) => TemplateDocxBlock[];

export type ResumeTemplateDefinition = ResumeTemplateConfig & {
  Preview: ComponentType<TemplatePreviewProps>;
  renderDocx: ResumeTemplateDocxRenderer;
};
