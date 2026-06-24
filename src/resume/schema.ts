export type {
  ResumeDocument,
  ResumeSection,
  ResumeSectionType,
} from "../lib/resumeDocument";

export {
  parseResumeDocument,
  sectionTextareaRows,
  serializeResumeDocument,
  structuredResumeToDocument,
  updateResumeDocumentSection,
  withFallbackContactSection,
} from "../lib/resumeDocument";
