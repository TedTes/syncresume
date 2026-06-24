import type { ComponentType, ReactNode } from "react";
import type { ResumeDocument, ResumeSection, ResumeSectionType } from "../../resume/schema";

export type ResumeTemplateId =
  | "ats-simple"
  | "classic"
  | "modern"
  | "crisp"
  | "compact"
  | "minimal"
  | "executive"
  | "leadership"
  | "editorial"
  | "academic"
  | "sidebar"
  | "portfolio"
  | "timeline"
  | "metro"
  | "technical"
  | "product"
  | "startup"
  | "split"
  | "typewriter"
  | "gradient"
  | "nordic"
  | "zen"
  | "deco"
  | "impact"
  | "stripe"
  | "frost"
  | "terra"
  | "card"
  | "serif"
  | "ruled"
  | "pillar"
  | "retro"
  | "block"
  | "outline"
  | "navy"
  | "layer"
  | "arc"
  | "clean"
  | "spark"
  | "shore"
  | "grove"
  | "smoke"
  | "slate"
  | "ember"
  | "sage"
  | "rose"
  | "steel"
  | "teak"
  | "ink"
  | "pearl"
  | "cobalt"
  | "mint"
  | "bronze"
  | "shadow"
  | "dash"
  | "flow"
  | "anchor";

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
