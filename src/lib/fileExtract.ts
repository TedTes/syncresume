import mammoth from "mammoth";
import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.mjs?url";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type ExtractedFile = {
  name: string;
  text: string;
  characterCount: number;
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
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    if (pageText) {
      pages.push(pageText);
    }
  }

  return createExtractedFile(file.name, pages.join("\n\n"));
}

async function extractDocxText(file: File): Promise<ExtractedFile> {
  const result = await mammoth.extractRawText({
    arrayBuffer: await file.arrayBuffer(),
  });

  return createExtractedFile(file.name, result.value);
}

function createExtractedFile(name: string, text: string): ExtractedFile {
  const normalizedText = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalizedText) {
    throw new Error("No resume text could be extracted from that file.");
  }

  return {
    name,
    text: normalizedText,
    characterCount: normalizedText.length,
  };
}
