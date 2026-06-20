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
  return TITLE_WORDS.some((word) => normalized.includes(word));
}

function cleanJobTitle(value: string): string {
  const cleaned = value
    .replace(/^\W+|\W+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned || cleaned.length < 3) return "";
  if (SKIP_PREFIXES.some((prefix) => cleaned.toLowerCase().startsWith(prefix))) return "";
  return cleaned.length > 70 ? `${cleaned.slice(0, 67)}...` : cleaned;
}
