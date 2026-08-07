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

export function formatContactDetailDisplay(raw: string): string {
  const lower = raw.toLowerCase();
  if (/^(?:linked\s?in)$/i.test(raw.trim())) return "LinkedIn";
  if (/^(?:git\s?hub)$/i.test(raw.trim())) return "GitHub";
  if (/linkedin\.com/i.test(lower)) return "LinkedIn";
  if (/github\.com/i.test(lower)) return "GitHub";
  if (/https?:\/\/|www\./i.test(raw)) return "Website";
  return raw;
}

export function parseResumeContact(
  content: string,
  fallbackTitle = "",
): ParsedResumeContact {
  const chunks = repairMergedNameLocationBoundary(
    splitContactContent(content)
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !GENERIC_CONTACT_LABELS.has(line.toLowerCase())),
  );

  if (chunks.length === 0) {
    return {
      name: cleanFallbackName(fallbackTitle),
      details: [],
    };
  }

  const firstChunk = chunks[0] ?? "";
  if (chunks.length > 1 && isLikelyLeadingNameFragment(firstChunk)) {
    return {
      name: firstChunk,
      details: chunks.slice(1),
    };
  }

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

function splitContactContent(content: string): string[] {
  return content
    .replace(/\b(?:email|e-mail|phone|mobile|tel|website|portfolio|github|linkedin)\s*:/gi, (label) => `\n${label}`)
    .split(/\n|\s*[|•·]\s*/)
    .flatMap(splitCombinedContactDetails)
    .map(cleanContactDetail)
    .filter(Boolean);
}

function splitCombinedContactDetails(value: string): string[] {
  const markers = contactDetailMarkers(value);
  if (markers.length === 0) return [value];

  const parts: string[] = [];
  let cursor = 0;
  for (const marker of markers) {
    const before = value.slice(cursor, marker.index).trim();
    if (before) parts.push(before);
    parts.push(marker.value.trim());
    cursor = marker.end;
  }

  const after = value.slice(cursor).trim();
  if (after) parts.push(after);
  return parts.filter(Boolean);
}

type ContactDetailMarker = {
  index: number;
  end: number;
  value: string;
  priority: number;
};

function contactDetailMarkers(value: string): ContactDetailMarker[] {
  const markerPatterns: Array<{ pattern: RegExp; priority: number }> = [
    { pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, priority: 0 },
    { pattern: /(?:https?:\/\/|www\.)[^\s|•·]+|(?:linkedin\.com|github\.com)\/?[^\s|•·]*/gi, priority: 1 },
    { pattern: /\+?\d[\d\s().-]{5,}\d/g, priority: 2 },
    { pattern: /(?:^|[^a-z])([A-Z][a-z][a-zA-Z]*(?:[\s.-]+[A-Z][a-z][a-zA-Z]*){0,3},\s*[A-Z]{2}\b)/g, priority: 3 },
    { pattern: /\b(?:git\s?hub|linked\s?in)\b/gi, priority: 4 },
  ];

  const candidates = markerPatterns.flatMap(({ pattern, priority }) => {
    pattern.lastIndex = 0;
    return Array.from(value.matchAll(pattern)).map((match) => {
      const markerValue = match[1] ?? match[0];
      const markerOffset = match[0].indexOf(markerValue);
      return {
        index: (match.index ?? 0) + markerOffset,
        end: (match.index ?? 0) + markerOffset + markerValue.length,
        value: priority === 3 ? normalizeLocationMarker(markerValue) : markerValue,
        priority,
      };
    });
  });

  return candidates
    .sort((left, right) => {
      if (left.index !== right.index) return left.index - right.index;
      if (left.priority !== right.priority) return left.priority - right.priority;
      return right.end - left.end;
    })
    .reduce<ContactDetailMarker[]>((markers, candidate) => {
      if (markers.some((marker) => rangesOverlap(marker, candidate))) return markers;
      markers.push(candidate);
      return markers;
    }, []);
}

function rangesOverlap(
  left: Pick<ContactDetailMarker, "index" | "end">,
  right: Pick<ContactDetailMarker, "index" | "end">,
): boolean {
  return left.index < right.end && right.index < left.end;
}

function normalizeLocationMarker(value: string): string {
  const [city = "", region = ""] = value.split(/,\s*/, 2);
  const normalizedCity = city
    .split(/([\s.-]+)/)
    .map((part) => (/^[A-Z]{2,}[a-z]/.test(part) ? `${part[0]}${part.slice(1).toLowerCase()}` : part))
    .join("");

  return [normalizedCity, region].filter(Boolean).join(", ");
}

type ParsedLocationDetail = {
  city: string;
  region: string;
  trailing: string;
};

function repairMergedNameLocationBoundary(chunks: string[]): string[] {
  if (chunks.length < 2) return chunks;

  const [nameCandidate = "", locationCandidate = "", ...rest] = chunks;
  if (/\s/.test(nameCandidate)) return chunks;

  const normalizedName = nameCandidate.replace(/[.'\s-]/g, "");
  if (!/^[A-Z]{5,32}$/.test(normalizedName)) return chunks;

  const location = parseLocationDetail(locationCandidate);
  if (!location) return chunks;

  const repair = inferMergedLocationPrefixRepair(nameCandidate, location);
  if (!repair) return chunks;

  return [
    repair.name,
    `${repair.city}, ${location.region}${location.trailing}`,
    ...rest,
  ];
}

function parseLocationDetail(value: string): ParsedLocationDetail | null {
  const match = value.match(/^([A-Za-z][A-Za-z .'-]{1,44}),\s*([A-Z]{2})(\b.*)?$/);
  if (!match?.[1] || !match[2]) return null;

  return {
    city: match[1].trim(),
    region: match[2].trim().toUpperCase(),
    trailing: match[3] ?? "",
  };
}

function isLikelyCompleteTitleCaseCity(value: string): boolean {
  return value.length >= 6 && /^[A-Z][a-z]+(?:[\s.-]+[A-Z][a-z]+)*$/.test(value);
}

type LocationPrefixRepair = {
  name: string;
  city: string;
  score: number;
};

function inferMergedLocationPrefixRepair(
  nameCandidate: string,
  location: ParsedLocationDetail,
): LocationPrefixRepair | null {
  const maxLocationPrefixLength = isLikelyCompleteTitleCaseCity(location.city) ? 1 : 3;
  const maxSuffixLength = Math.min(maxLocationPrefixLength, nameCandidate.length - 2);
  const candidates: LocationPrefixRepair[] = [];

  for (let length = 1; length <= maxSuffixLength; length += 1) {
    const suffix = nameCandidate.slice(-length);
    if (!/^[A-Z]+$/.test(suffix)) continue;

    const rawCity = `${suffix}${location.city}`;
    const city = normalizeLocationMarker(`${rawCity}, ${location.region}`).split(",")[0]?.trim() ?? "";
    const score = scoreMergedLocationPrefix(rawCity, city, location.city);
    if (score < 4) continue;

    const name = nameCandidate.slice(0, -length).trim();
    if (name.length < 2) continue;

    candidates.push({ name, city, score });
  }

  return candidates.sort(
    (left, right) => right.score - left.score || right.city.length - left.city.length,
  )[0] ?? null;
}

function scoreMergedLocationPrefix(rawCity: string, normalizedCity: string, originalCity: string): number {
  if (normalizedCity.length <= originalCity.length || normalizedCity.length < 4) return 0;

  const leadingUppercase = rawCity.match(/^[A-Z]+(?=[a-z])/)?.[0] ?? "";
  if (leadingUppercase.length < 2 || leadingUppercase.length > 3) return 0;

  let score = leadingUppercase.length;
  if (originalCity.length <= 5) score += 3;
  if (/^[B-DF-HJ-NP-TV-Z][AEIOU]/i.test(normalizedCity)) score += 2;
  if (/^[AEIOU]{2}/i.test(normalizedCity)) score -= 3;

  return score;
}

function cleanContactDetail(value: string): string {
  return value
    .replace(/^(?:email|e-mail|phone|mobile|tel|website|portfolio|github|linkedin)\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
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

function isLikelyLeadingNameFragment(value: string): boolean {
  if (!value || isLikelyContactDetail(value)) return false;
  if (GENERIC_CONTACT_LABELS.has(value.toLowerCase())) return false;
  if (isLikelyNameLine(value)) return true;

  const compact = value.replace(/[.'-]/g, "");
  return /^[A-Z]{5,32}$/.test(compact);
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
