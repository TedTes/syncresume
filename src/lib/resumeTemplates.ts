export {
  DEFAULT_TEMPLATE_ID,
  RESUME_TEMPLATE_DEFINITIONS,
  RESUME_TEMPLATES,
  getResumeTemplate,
  getResumeTemplateDefinition,
  normalizeResumeTemplateId,
  orderSectionsForTemplate,
} from "../templates/registry";

export type {
  ResumeTemplate,
  ResumeTemplateDefinition,
  ResumeTemplateId,
  ResumeTemplateRenderer,
} from "../templates/registry";
