export type {
  ResumeDocument,
  ResumeSection,
  ResumeSectionType,
} from "../lib/resumeDocument";

export {
  RESUME_SECTION_TYPE_OPTIONS,
  addResumeDocumentSection,
  moveResumeDocumentSection,
  parseResumeDocument,
  removeResumeDocumentSection,
  renameResumeDocumentSection,
  sectionTextareaRows,
  serializeResumeDocument,
  structuredResumeToDocument,
  updateResumeDocumentSection,
  withFallbackContactSection,
} from "../lib/resumeDocument";
