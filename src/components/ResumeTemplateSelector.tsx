import { CheckCircle2, Eye, Info, LayoutTemplate, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  RESUME_TEMPLATES,
  type ResumeTemplateId,
} from "../templates/registry";
import {
  DEFAULT_RESUME_FONT_ID,
  type ResumeFontId,
} from "../templates/shared/fonts";
import type { ResumeDocument } from "../resume/schema";
import { DEFAULT_TEMPLATE_PREVIEW_DOCUMENT } from "../resume/sample";
import { ResumeTemplatePreview } from "./ResumeTemplatePreview";
import { ResumeTemplateThumbnail } from "./ResumeTemplateThumbnail";

type ResumeTemplateSelectorProps = {
  selectedTemplateId: ResumeTemplateId;
  onSelect: (templateId: ResumeTemplateId) => void;
  triggerClassName?: string;
  triggerLabel?: string;
  showSelectedName?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  renderPanel?: boolean;
  previewDocument?: ResumeDocument | null;
  selectedFontId?: ResumeFontId;
};

export function ResumeTemplateSelector({
  selectedTemplateId,
  onSelect,
  triggerClassName = "btn btn-secondary btn-sm template-drawer-trigger",
  triggerLabel = "Templates",
  showSelectedName = true,
  isOpen,
  onOpenChange,
  renderPanel = true,
  previewDocument = null,
  selectedFontId = DEFAULT_RESUME_FONT_ID,
}: ResumeTemplateSelectorProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const controlled = typeof isOpen === "boolean";
  const open = controlled ? isOpen : internalIsOpen;
  const selectedTemplate = RESUME_TEMPLATES.find((template) => template.id === selectedTemplateId);

  function setOpen(nextIsOpen: boolean) {
    if (!controlled) setInternalIsOpen(nextIsOpen);
    onOpenChange?.(nextIsOpen);
  }

  return (
    <>
      <button
        type="button"
        className={triggerClassName}
        onClick={() => setOpen(!open)}
      >
        <LayoutTemplate aria-hidden="true" />
        <span className="template-trigger-label">{triggerLabel}</span>
        {showSelectedName && selectedTemplate && (
          <span className="template-trigger-current">{selectedTemplate.name}</span>
        )}
      </button>

      {renderPanel && open && (
        <div
          className="template-drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <ResumeTemplatePanel
            selectedTemplateId={selectedTemplateId}
            onSelect={onSelect}
            previewDocument={previewDocument}
            selectedFontId={selectedFontId}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </>
  );
}

type ResumeTemplatePanelProps = {
  selectedTemplateId: ResumeTemplateId;
  onSelect: (templateId: ResumeTemplateId) => void;
  onClose: () => void;
  previewDocument?: ResumeDocument | null;
  selectedFontId?: ResumeFontId;
  className?: string;
  isOpen?: boolean;
};

export function ResumeTemplatePanel({
  selectedTemplateId,
  onSelect,
  onClose,
  previewDocument = null,
  selectedFontId = DEFAULT_RESUME_FONT_ID,
  className = "",
  isOpen = true,
}: ResumeTemplatePanelProps) {
  const [reviewTemplateId, setReviewTemplateId] = useState<ResumeTemplateId | null>(null);
  const [openInfoId, setOpenInfoId] = useState<ResumeTemplateId | null>(null);
  const reviewTemplate = RESUME_TEMPLATES.find((template) => template.id === reviewTemplateId);
  const reviewDocument = previewDocument ?? DEFAULT_TEMPLATE_PREVIEW_DOCUMENT;

  function handleSelectTemplate(templateId: ResumeTemplateId) {
    onSelect(templateId);
    if (reviewTemplateId) {
      setReviewTemplateId(templateId);
    }
  }

  useEffect(() => {
    if (!reviewTemplateId) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setReviewTemplateId(null);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [reviewTemplateId]);

  useEffect(() => {
    if (!isOpen) {
      setReviewTemplateId(null);
    }
  }, [isOpen]);

  const reviewOverlay = reviewTemplate
    ? createPortal(
        <div
          className="template-review-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setReviewTemplateId(null);
            }
          }}
        >
          <section
            className="template-review-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${reviewTemplate.name} template preview`}
          >
            <header className="template-review-header">
              <div>
                <p>Template preview</p>
                <h3>{reviewTemplate.name}</h3>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon-only"
                aria-label="Close template preview"
                onClick={() => setReviewTemplateId(null)}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            <div className="template-review-canvas">
              <ResumeTemplatePreview
                key={reviewTemplate.id}
                document={reviewDocument}
                templateId={reviewTemplate.id}
                fontId={selectedFontId}
              />
            </div>
          </section>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
      <aside
        className={`template-drawer${className ? ` ${className}` : ""}`.trim()}
        role="dialog"
        aria-modal="false"
        aria-label="Choose resume template"
      >
        <div className="template-drawer-header">
          <div>
            <h2>Templates</h2>
            <p>Choose the layout used for preview and export.</p>
          </div>
          <div className="template-drawer-header-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              aria-label="Preview selected template"
              onClick={() => setReviewTemplateId(selectedTemplateId)}
            >
              <Eye aria-hidden="true" />
              Preview
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon-only"
              aria-label="Close templates"
              onClick={onClose}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="template-drawer-list">
          {RESUME_TEMPLATES.map((template) => {
            const isSelected = selectedTemplateId === template.id;

            return (
              <div
                key={template.id}
                className={`template-drawer-option${isSelected ? " selected" : ""}`}
              >
                <button
                  type="button"
                  className="template-drawer-select-hitbox"
                  aria-label={isSelected ? `${template.name} (selected)` : `Use ${template.name} template`}
                  onClick={() => {
                    handleSelectTemplate(template.id);
                    setOpenInfoId(null);
                  }}
                >
                  <ResumeTemplateThumbnail
                    templateId={template.id}
                    document={reviewDocument}
                    fontId={selectedFontId}
                  />
                  <span className="template-drawer-option-main" aria-hidden="true">
                    Use template
                  </span>
                  {isSelected && (
                    <span className="template-drawer-selected" aria-hidden="true">
                      <CheckCircle2 />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className={`template-card-info${openInfoId === template.id ? " is-open" : ""}`}
                  aria-label={`${template.name} info`}
                  aria-pressed={openInfoId === template.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpenInfoId(openInfoId === template.id ? null : template.id);
                  }}
                >
                  <Info aria-hidden="true" />
                </button>
                {openInfoId === template.id && (
                  <span className="template-card-name-overlay" aria-hidden="true">
                    {template.name}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </aside>
      {reviewOverlay}
    </>
  );
}
