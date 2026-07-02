export type {
  ResumeDocument,
  ResumeSection,
  ResumeSectionContentKind,
  ResumeSectionType,
} from "../lib/resumeDocument";

export {
  RESUME_SECTION_CONTENT_KIND_OPTIONS,
  RESUME_SECTION_TYPE_OPTIONS,
  addResumeDocumentSection,
  inferResumeSectionContentKind,
  isBulletPrefixedRoleHeaderLine,
  moveResumeDocumentSection,
  parseResumeDocument,
  removeResumeDocumentSection,
  renameResumeDocumentSection,
  sectionTextareaRows,
  serializeResumeDocument,
  stripResumeBulletPrefix,
  structuredResumeToDocument,
  updateResumeDocumentSection,
  updateResumeDocumentSectionContentKind,
  withFallbackContactSection,
} from "../lib/resumeDocument";
