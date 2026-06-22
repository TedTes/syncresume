import { CheckCircle2, LayoutTemplate, X } from "lucide-react";
import { useState } from "react";
import {
  RESUME_TEMPLATES,
  type ResumeTemplateId,
} from "../lib/resumeTemplates";

type ResumeTemplateSelectorProps = {
  selectedTemplateId: ResumeTemplateId;
  onSelect: (templateId: ResumeTemplateId) => void;
  triggerClassName?: string;
  triggerLabel?: string;
  showSelectedName?: boolean;
  isOpen?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  renderPanel?: boolean;
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
  className?: string;
};

export function ResumeTemplatePanel({
  selectedTemplateId,
  onSelect,
  onClose,
  className = "",
}: ResumeTemplatePanelProps) {
  return (
    <aside
      className={`template-drawer ${className}`.trim()}
      role="dialog"
      aria-modal="false"
      aria-label="Choose resume template"
    >
      <div className="template-drawer-header">
        <div>
          <h2>Templates</h2>
          <p>Choose the layout used for preview and export.</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon-only"
          aria-label="Close templates"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="template-drawer-list">
        {RESUME_TEMPLATES.map((template) => {
          const isSelected = selectedTemplateId === template.id;

          return (
            <button
              key={template.id}
              type="button"
              className={`template-drawer-option ${isSelected ? "selected" : ""}`}
              onClick={() => onSelect(template.id)}
            >
              <span className="template-drawer-option-main">
                <strong>{template.name}</strong>
                {template.isAtsSafe && <small>ATS-safe</small>}
              </span>
              <em>{template.description}</em>
              {isSelected && (
                <span className="template-drawer-selected" aria-hidden="true">
                  <CheckCircle2 />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
