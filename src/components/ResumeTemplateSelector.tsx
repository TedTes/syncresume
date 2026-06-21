import { CheckCircle2, LayoutTemplate, X } from "lucide-react";
import { useState } from "react";
import {
  RESUME_TEMPLATES,
  type ResumeTemplateId,
} from "../lib/resumeTemplates";

type ResumeTemplateSelectorProps = {
  selectedTemplateId: ResumeTemplateId;
  onSelect: (templateId: ResumeTemplateId) => void;
};

export function ResumeTemplateSelector({
  selectedTemplateId,
  onSelect,
}: ResumeTemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const selectedTemplate = RESUME_TEMPLATES.find((template) => template.id === selectedTemplateId);

  return (
    <>
      <button
        type="button"
        className="btn btn-secondary btn-sm template-drawer-trigger"
        onClick={() => setIsOpen(true)}
      >
        <LayoutTemplate aria-hidden="true" />
        Templates
        {selectedTemplate && <span>{selectedTemplate.name}</span>}
      </button>

      {isOpen && (
        <div
          className="template-drawer-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <aside
            className="template-drawer"
            role="dialog"
            aria-modal="true"
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
                onClick={() => setIsOpen(false)}
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
        </div>
      )}
    </>
  );
}
