export type ResumeFontId = "template" | "system" | "serif" | "humanist" | "geometric" | "mono";

export type ResumeFontOption = {
  id: ResumeFontId;
  label: string;
  cssFamily: string;
  docxFamily?: string;
};

export const RESUME_FONT_OPTIONS: ResumeFontOption[] = [
  {
    id: "template",
    label: "Template default",
    cssFamily: "",
  },
  {
    id: "system",
    label: "System sans",
    cssFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    docxFamily: "Arial",
  },
  {
    id: "serif",
    label: "Classic serif",
    cssFamily: 'Georgia, "Times New Roman", Times, serif',
    docxFamily: "Georgia",
  },
  {
    id: "humanist",
    label: "Humanist",
    cssFamily: '"Aptos", "Segoe UI", Calibri, Arial, sans-serif',
    docxFamily: "Aptos",
  },
  {
    id: "geometric",
    label: "Geometric",
    cssFamily: '"Avenir Next", Avenir, Montserrat, Arial, sans-serif',
    docxFamily: "Aptos",
  },
  {
    id: "mono",
    label: "Mono",
    cssFamily: '"SFMono-Regular", Consolas, "Liberation Mono", monospace',
    docxFamily: "Courier New",
  },
];

export const DEFAULT_RESUME_FONT_ID: ResumeFontId = "template";

export function normalizeResumeFontId(value: unknown): ResumeFontId {
  return RESUME_FONT_OPTIONS.find((option) => option.id === value)?.id ?? DEFAULT_RESUME_FONT_ID;
}

export function getResumeFontOption(fontId: ResumeFontId): ResumeFontOption {
  return RESUME_FONT_OPTIONS.find((option) => option.id === fontId) ?? RESUME_FONT_OPTIONS[0];
}
