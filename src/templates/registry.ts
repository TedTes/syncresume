import { template as academic } from "./definitions/academic";
import { template as atsSimple } from "./definitions/ats-simple";
import { template as classic } from "./definitions/classic";
import { template as compact } from "./definitions/compact";
import { template as crisp } from "./definitions/crisp";
import { template as editorial } from "./definitions/editorial";
import { template as executive } from "./definitions/executive";
import { template as leadership } from "./definitions/leadership";
import { template as metro } from "./definitions/metro";
import { template as minimal } from "./definitions/minimal";
import { template as modern } from "./definitions/modern";
import { template as portfolio } from "./definitions/portfolio";
import { template as product } from "./definitions/product";
import { template as sidebar } from "./definitions/sidebar";
import { template as startup } from "./definitions/startup";
import { template as technical } from "./definitions/technical";
import { template as timeline } from "./definitions/timeline";
import { orderSectionsForTemplate } from "./shared/orderSections";
import type {
  ResumeTemplateConfig,
  ResumeTemplateDefinition,
  ResumeTemplateId,
} from "./shared/types";

export const DEFAULT_TEMPLATE_ID: ResumeTemplateId = "ats-simple";

export const RESUME_TEMPLATE_DEFINITIONS = [
  atsSimple,
  classic,
  modern,
  crisp,
  compact,
  minimal,
  executive,
  leadership,
  editorial,
  academic,
  sidebar,
  portfolio,
  timeline,
  metro,
  technical,
  product,
  startup,
] satisfies ResumeTemplateDefinition[];

export const RESUME_TEMPLATES = RESUME_TEMPLATE_DEFINITIONS.map(toTemplateConfig);

export function getResumeTemplateDefinition(templateId: string): ResumeTemplateDefinition {
  return (
    RESUME_TEMPLATE_DEFINITIONS.find((template) => template.id === templateId) ??
    RESUME_TEMPLATE_DEFINITIONS[0]
  );
}

export function getResumeTemplate(templateId: string): ResumeTemplateConfig {
  return toTemplateConfig(getResumeTemplateDefinition(templateId));
}

export function normalizeResumeTemplateId(templateId: string | null | undefined): ResumeTemplateId {
  return RESUME_TEMPLATE_DEFINITIONS.some((template) => template.id === templateId)
    ? (templateId as ResumeTemplateId)
    : DEFAULT_TEMPLATE_ID;
}

function toTemplateConfig(template: ResumeTemplateDefinition): ResumeTemplateConfig {
  return {
    id: template.id,
    name: template.name,
    description: template.description,
    isAtsSafe: template.isAtsSafe,
    density: template.density,
    className: template.className,
    thumbnailClassName: template.thumbnailClassName,
    renderer: template.renderer,
    sectionOrder: template.sectionOrder,
    pdf: template.pdf,
  };
}

export { orderSectionsForTemplate };
export type {
  ResumeTemplateConfig as ResumeTemplate,
  ResumeTemplateDefinition,
  ResumeTemplateId,
  ResumeTemplateRenderer,
} from "./shared/types";
