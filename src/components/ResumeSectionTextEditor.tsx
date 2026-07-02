import { AlignLeft, List } from "lucide-react";
import { type ReactNode, useLayoutEffect, useRef } from "react";
import type { ResumeSection, ResumeSectionContentKind } from "../resume/schema";

type ResumeSectionTextEditorProps = {
  section: ResumeSection;
  isSelected?: boolean;
  className?: string;
  textareaClassName?: string;
  onSelect?: () => void;
  onContentChange: (content: string) => void;
  onContentKindChange?: (contentKind: ResumeSectionContentKind) => void;
  onContentAndKindChange?: (content: string, contentKind: ResumeSectionContentKind) => void;
  toolbarAction?: ReactNode;
};

export function ResumeSectionTextEditor({
  section,
  isSelected = false,
  className = "",
  textareaClassName = "",
  onSelect,
  onContentChange,
  onContentKindChange,
  onContentAndKindChange,
  toolbarAction,
}: ResumeSectionTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const contentKind = section.contentKind ?? "paragraph";

  useLayoutEffect(() => {
    resizeTextarea(textareaRef.current);
  }, [section.content]);

  function applyContentKind(nextKind: ResumeSectionContentKind) {
    const textarea = textareaRef.current;
    const selectionStart = textarea?.selectionStart ?? section.content.length;
    const selectionEnd = textarea?.selectionEnd ?? selectionStart;
    const nextContent =
      nextKind === "bullets"
        ? withBulletMarkers(section.content, selectionStart, selectionEnd)
        : withoutBulletMarkers(section.content, selectionStart, selectionEnd);

    if (onContentAndKindChange) {
      onContentAndKindChange(nextContent, nextKind);
    } else {
      onContentKindChange?.(nextKind);
      if (nextContent !== section.content) {
        onContentChange(nextContent);
      }
    }

    requestAnimationFrame(() => {
      textarea?.focus();
      resizeTextarea(textarea);
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (contentKind !== "bullets" || event.key !== "Enter") return;

    const textarea = event.currentTarget;
    const value = textarea.value;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
    const lineEndIndex = value.indexOf("\n", selectionStart);
    const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;
    const currentLine = value.slice(lineStart, lineEnd);
    const indentation = currentLine.match(/^\s*/)?.[0] ?? "";

    if (/^\s*[-*•]\s*$/.test(currentLine)) {
      event.preventDefault();
      const nextValue = `${value.slice(0, lineStart)}${value.slice(selectionEnd)}`;
      onContentChange(nextValue);
      requestAnimationFrame(() => {
        textarea.selectionStart = lineStart;
        textarea.selectionEnd = lineStart;
        resizeTextarea(textarea);
      });
      return;
    }

    event.preventDefault();
    const insertion = `\n${indentation}• `;
    const nextValue = `${value.slice(0, selectionStart)}${insertion}${value.slice(selectionEnd)}`;
    const nextCaret = selectionStart + insertion.length;
    onContentChange(nextValue);
    requestAnimationFrame(() => {
      textarea.selectionStart = nextCaret;
      textarea.selectionEnd = nextCaret;
      resizeTextarea(textarea);
    });
  }

  return (
    <div
      className={`resume-section-text-editor ${isSelected ? "is-selected" : ""} ${
        toolbarAction ? "has-toolbar-action" : ""
      } ${className}`.trim()}
      data-content-kind={contentKind}
      onMouseDown={(event) => {
        if (event.target instanceof HTMLTextAreaElement || event.target instanceof HTMLButtonElement) {
          return;
        }
        textareaRef.current?.focus();
      }}
    >
      {(onContentKindChange || toolbarAction) && (
        <div className="resume-section-format-toolbar" role="group" aria-label={`${section.title} format`}>
          {onContentKindChange && (
            <>
              <button
                className={contentKind === "paragraph" ? "active" : ""}
                type="button"
                title="Paragraph"
                aria-label={`Format ${section.title} as paragraph`}
                aria-pressed={contentKind === "paragraph"}
                onClick={() => applyContentKind("paragraph")}
              >
                <AlignLeft aria-hidden="true" />
              </button>
              <button
                className={contentKind === "bullets" ? "active" : ""}
                type="button"
                title="Bullet list"
                aria-label={`Format ${section.title} as bullet list`}
                aria-pressed={contentKind === "bullets"}
                onClick={() => applyContentKind("bullets")}
              >
                <List aria-hidden="true" />
              </button>
            </>
          )}
          {toolbarAction}
        </div>
      )}
      <textarea
        ref={textareaRef}
        className={`document-section-textarea document-section-textarea-${section.type} ${textareaClassName} ${
          isSelected ? "is-selected" : ""
        }`.trim()}
        value={section.content}
        rows={1}
        aria-label={`Edit ${section.title}`}
        spellCheck
        onFocus={onSelect}
        onClick={onSelect}
        onKeyDown={handleKeyDown}
        onInput={(event) => resizeTextarea(event.currentTarget)}
        onChange={(event) => onContentChange(event.target.value)}
      />
    </div>
  );
}

function resizeTextarea(textarea: HTMLTextAreaElement | null) {
  if (!textarea) return;

  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function withBulletMarkers(value: string, selectionStart: number, selectionEnd: number) {
  if (!value.trim()) return "• ";

  return transformAffectedLines(value, selectionStart, selectionEnd, (line) => {
    if (!line.trim()) {
      const indentation = line.match(/^\s*/)?.[0] ?? "";
      return `${indentation}• `;
    }
    if (/^\s*[-*•]\s+/.test(line)) return line;
    const indentation = line.match(/^\s*/)?.[0] ?? "";
    return `${indentation}• ${line.trimStart()}`;
  });
}

function withoutBulletMarkers(value: string, selectionStart: number, selectionEnd: number) {
  return transformAffectedLines(value, selectionStart, selectionEnd, (line) =>
    line.replace(/^(\s*)[-*•]\s+/, "$1"),
  );
}

function transformAffectedLines(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  transformLine: (line: string) => string,
) {
  const start = value.lastIndexOf("\n", Math.max(0, selectionStart - 1)) + 1;
  const endLineBreak = value.indexOf("\n", selectionEnd);
  const end = endLineBreak === -1 ? value.length : endLineBreak;
  const before = value.slice(0, start);
  const selected = value.slice(start, end);
  const after = value.slice(end);
  const nextSelected = selected.split("\n").map(transformLine).join("\n");

  return `${before}${nextSelected}${after}`;
}
