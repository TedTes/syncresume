export type ExtractedFile = {
  name: string;
  text: string;
  characterCount: number;
};

type PdfTextItem = {
  str: string;
  transform?: number[];
  width?: number;
  height?: number;
};

type PositionedPdfTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export async function extractResumeText(file: File): Promise<ExtractedFile> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (file.type === "application/pdf" || extension === "pdf") {
    return extractPdfText(file);
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    extension === "docx"
  ) {
    return extractDocxText(file);
  }

  throw new Error("Upload a PDF or DOCX resume.");
}

async function extractPdfText(file: File): Promise<ExtractedFile> {
  const [pdfjs, worker] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = buildPdfPageText(textContent.items);

    if (pageText) {
      pages.push(pageText);
    }
  }

  return createExtractedFile(file.name, pages.join("\n\n"));
}

async function extractDocxText(file: File): Promise<ExtractedFile> {
  const mammoth = await import("mammoth");
  const result = await mammoth.default.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });

  return createExtractedFile(file.name, result.value);
}

function buildPdfPageText(items: unknown[]): string {
  const textItems = items.filter(isPdfTextItem);
  const fallbackText = normalizeExtractedWhitespace(textItems.map((item) => item.str).join(" "));
  const positionedItems = textItems.map(toPositionedPdfTextItem).filter(isPositionedPdfTextItem);

  if (positionedItems.length === 0) {
    return fallbackText;
  }

  const lineTolerance = lineToleranceFor(positionedItems);
  const sorted = [...positionedItems].sort((a, b) => {
    const yDifference = b.y - a.y;
    return Math.abs(yDifference) > lineTolerance ? yDifference : a.x - b.x;
  });
  const lines: Array<{ y: number; items: PositionedPdfTextItem[] }> = [];

  for (const item of sorted) {
    const line = lines.find((candidate) => Math.abs(candidate.y - item.y) <= lineTolerance);
    if (line) {
      line.items.push(item);
      line.y = (line.y * (line.items.length - 1) + item.y) / line.items.length;
    } else {
      lines.push({ y: item.y, items: [item] });
    }
  }

  const positionedText = lines
    .sort((a, b) => b.y - a.y)
    .map((line) => stringifyPdfLine(line.items))
    .filter(Boolean)
    .join("\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return positionedText.length >= fallbackText.length * 0.8 ? positionedText : fallbackText;
}

function isPdfTextItem(item: unknown): item is PdfTextItem {
  return typeof item === "object" && item !== null && "str" in item && typeof (item as PdfTextItem).str === "string";
}

function toPositionedPdfTextItem(item: PdfTextItem): PositionedPdfTextItem | null {
  const text = normalizeExtractedWhitespace(item.str);
  const transform = item.transform;
  if (!text || !Array.isArray(transform) || transform.length < 6) return null;

  return {
    text,
    x: Number(transform[4]) || 0,
    y: Number(transform[5]) || 0,
    width: Number(item.width) || 0,
    height: Number(item.height) || Math.abs(Number(transform[3])) || 10,
  };
}

function isPositionedPdfTextItem(item: PositionedPdfTextItem | null): item is PositionedPdfTextItem {
  return item !== null;
}

function stringifyPdfLine(items: PositionedPdfTextItem[]): string {
  const sorted = [...items].sort((a, b) => a.x - b.x);
  let cursorEnd: number | null = null;

  return sorted
    .map((item) => {
      const gap = cursorEnd === null ? 0 : item.x - cursorEnd;
      cursorEnd = Math.max(cursorEnd ?? item.x, item.x + item.width);
      return `${gap > Math.max(2, item.height * 0.35) ? " " : ""}${item.text}`;
    })
    .join("")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function lineToleranceFor(items: PositionedPdfTextItem[]): number {
  const heights = items
    .map((item) => item.height)
    .filter((height) => Number.isFinite(height) && height > 0)
    .sort((a, b) => a - b);
  const medianHeight = heights[Math.floor(heights.length / 2)] ?? 10;
  return Math.max(2, medianHeight * 0.45);
}

function createExtractedFile(name: string, text: string): ExtractedFile {
  const normalizedText = text.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalizedText) {
    throw new Error("No resume text could be extracted from that file.");
  }

  return {
    name,
    text: normalizedText,
    characterCount: normalizedText.length,
  };
}

function normalizeExtractedWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
