import type { ComponentType, ReactNode } from "react";
import type { ResumeDocument, ResumeSection, ResumeSectionType } from "../../resume/schema";
import type { ResumeFontId, ResumeFontOption } from "./fonts";
import type { ResumeTemplateId } from "../ids";

export type { ResumeTemplateId };

export type ResumeTemplateRenderer = "single-column" | "sidebar" | "timeline" | "technical" | "split" | "gradient";
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
  font: ResumeFontOption;
  fontId: ResumeFontId;
  sections: ResumeSection[];
  contactSection?: ResumeSection;
  bodySections: ResumeSection[];
  renderSectionContent?: (section: ResumeSection) => ReactNode;
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
