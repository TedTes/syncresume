const GENERIC_CONTACT_LABELS = new Set([
  "contact",
  "contact information",
  "personal information",
  "personal details",
]);

const GENERIC_TITLE_WORDS = /\b(?:resume|cv|curriculum vitae|updated|final|copy|optimized|tailored)\b/gi;

export type ParsedResumeContact = {
  name: string;
  details: string[];
};

export function parseResumeContact(
  content: string,
  fallbackTitle = "",
): ParsedResumeContact {
  const chunks = content
    .split(/\n|\s*\|\s*/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !GENERIC_CONTACT_LABELS.has(line.toLowerCase()));

  if (chunks.length === 0) {
    return {
      name: cleanFallbackName(fallbackTitle),
      details: [],
    };
  }

  const firstChunk = chunks[0] ?? "";
  const firstChunkName = extractNameFromContactChunk(firstChunk);
  if (firstChunkName) {
    const leftover = firstChunk.slice(firstChunkName.length).trim();
    return {
      name: firstChunkName,
      details: [leftover, ...chunks.slice(1)].filter(Boolean),
    };
  }

  const nameIndex = chunks.findIndex(isLikelyNameLine);
  if (nameIndex >= 0) {
    return {
      name: chunks[nameIndex],
      details: chunks.filter((_, index) => index !== nameIndex),
    };
  }

  return {
    name: cleanFallbackName(fallbackTitle),
    details: chunks,
  };
}

function extractNameFromContactChunk(value: string): string {
  const upperNameMatch = value.match(/^([A-Z][A-Z.'-]+(?:\s+[A-Z][A-Z.'-]+){1,3})\b/);
  if (upperNameMatch?.[1]) return upperNameMatch[1].trim();

  const titleCaseNameMatch = value.match(
    /^([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+){1,3})(?=\s+(?:[A-Z][a-z]+,|[A-Z]{2}\b|\+?\d|[A-Za-z0-9._%+-]+@|https?:|linkedin|github)\b|$)/,
  );
  return titleCaseNameMatch?.[1]?.trim() ?? "";
}

function isLikelyNameLine(value: string): boolean {
  if (isLikelyContactDetail(value)) return false;
  if (GENERIC_CONTACT_LABELS.has(value.toLowerCase())) return false;

  const words = value.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 4) return false;

  return words.every((word) => /^[A-Z][a-zA-Z.'-]*$|^[A-Z][A-Z.'-]*$/.test(word));
}

function isLikelyContactDetail(value: string): boolean {
  return /@|https?:|www\.|linkedin|github|\+?\d[\d\s().-]{6,}|,\s*[A-Z]{2}\b/i.test(value);
}

function cleanFallbackName(value: string): string {
  return value
    .replace(/\.[^.]+$/, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[_-]+/g, " ")
    .replace(GENERIC_TITLE_WORDS, " ")
    .replace(/\s+/g, " ")
    .trim();
}
