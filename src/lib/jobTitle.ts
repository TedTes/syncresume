const TITLE_PREFIXES = [
  /^(job\s*title|title|position|role)\s*[:\-]\s*(.+)$/i,
  /^(.+?)\s+[-|]\s+job\s+description$/i,
];

const SKIP_PREFIXES = [
  "about ",
  "benefits",
  "company",
  "compensation",
  "department",
  "employment type",
  "equal opportunity",
  "location",
  "qualifications",
  "reports to",
  "requirements",
  "responsibilities",
  "salary",
  "the role",
  "what you",
  "who you",
];

const RESPONSIBILITY_PREFIXES = [
  "build ",
  "champion ",
  "collaborate ",
  "create ",
  "deliver ",
  "design ",
  "develop ",
  "drive ",
  "ensure ",
  "implement ",
  "improve ",
  "own ",
  "partner ",
  "provide ",
  "refactor ",
  "support ",
  "work ",
];

const LOW_QUALITY_TITLE_PATTERNS = [
  /^\d+\+?\s*(years?|yrs?)\b/i,
  /^\d+\s*[-–]\s*\d+\s*(years?|yrs?)\b/i,
  /\b(years?|yrs?)\s+of\s+experience\b/i,
  /\bexperience\s+(in|with|required)\b/i,
  /\bmust\s+have\b/i,
  /\breports?\s+to\b/i,
];

const TITLE_WORDS = [
  "analyst",
  "architect",
  "consultant",
  "designer",
  "developer",
  "director",
  "engineer",
  "lead",
  "manager",
  "product",
  "scientist",
  "specialist",
  "strategist",
];

export function extractJobTitle(jobDescription: string): string {
  const lines = jobDescription
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  for (const line of lines.slice(0, 20)) {
    for (const pattern of TITLE_PREFIXES) {
      const match = line.match(pattern);
      const candidate = cleanJobTitle(match?.[2] ?? match?.[1] ?? "");
      if (candidate) return candidate;
    }

    const headerTitle = extractHeaderJobTitle(line);
    if (headerTitle) return headerTitle;
  }

  const candidate = lines.slice(0, 12).find(isLikelyTitleLine);
  return cleanJobTitle(candidate ?? "") || "Untitled role";
}

export function deriveTailoredResumeName(jobDescription: string, date = new Date()): string {
  const title = extractJobTitle(jobDescription);
  const formattedDate = date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `Resume - ${title} - ${formattedDate}`;
}

function isLikelyTitleLine(line: string): boolean {
  const normalized = line.toLowerCase();
  if (line.length > 86) return false;
  if (/[.!?]$/.test(line)) return false;
  if (SKIP_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (RESPONSIBILITY_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (LOW_QUALITY_TITLE_PATTERNS.some((pattern) => pattern.test(line))) return false;
  return TITLE_WORDS.some((word) => normalized.includes(word));
}

function extractHeaderJobTitle(line: string): string {
  const normalized = line.toLowerCase();
  if (line.length > 110 || /[.!?]$/.test(line)) return "";
  if (SKIP_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return "";
  if (RESPONSIBILITY_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return "";
  if (LOW_QUALITY_TITLE_PATTERNS.some((pattern) => pattern.test(line))) return "";
  if (!TITLE_WORDS.some((word) => normalized.includes(word))) return "";

  const firstSegment = line.split(/\s+(?:[-–—|]|at)\s+/i)[0] ?? "";
  return cleanJobTitle(firstSegment) || cleanJobTitle(line);
}

function cleanJobTitle(value: string): string {
  const cleaned = value
    .replace(/^\W+|\W+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 3) return "";
  if (cleaned.toLowerCase() === "untitled role") return "";
  if (SKIP_PREFIXES.some((prefix) => cleaned.toLowerCase().startsWith(prefix))) return "";
  if (LOW_QUALITY_TITLE_PATTERNS.some((pattern) => pattern.test(cleaned))) return "";
  return cleaned.length > 70 ? `${cleaned.slice(0, 67)}...` : cleaned;
}
