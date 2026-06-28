import { parseResumeContact } from "../resume/contact";
import type { ResumeDocument, ResumeSection } from "./resumeDocument";

export type UserProfileDetails = {
  fullName: string;
  targetTitle: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  website: string;
};

export const emptyUserProfileDetails: UserProfileDetails = {
  fullName: "",
  targetTitle: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  github: "",
  website: "",
};

export function normalizeUserProfileDetails(input: unknown): UserProfileDetails {
  if (!input || typeof input !== "object") return emptyUserProfileDetails;

  const record = input as Record<string, unknown>;
  return {
    fullName: readText(record.fullName),
    targetTitle: readText(record.targetTitle),
    email: readText(record.email),
    phone: readText(record.phone),
    location: readText(record.location),
    linkedin: readText(record.linkedin),
    github: readText(record.github),
    website: readText(record.website),
  };
}

export function hasUserProfileDetails(profile: UserProfileDetails): boolean {
  const normalized = normalizeUserProfileDetails(profile);
  return Object.values(normalized).some((value) => value.trim());
}

export function userProfileToContactContent(profile: UserProfileDetails): string {
  const normalized = normalizeUserProfileDetails(profile);
  return contactLinesFromProfile(normalized).join("\n");
}

export function applyUserProfileContactFallback(
  document: ResumeDocument,
  profile: UserProfileDetails,
): ResumeDocument {
  const normalized = normalizeUserProfileDetails(profile);
  const profileLines = contactLinesFromProfile(normalized);
  if (profileLines.length === 0) return document;

  const contactSection = document.sections.find((section) => section.type === "contact");
  if (!contactSection) {
    return {
      ...document,
      sections: [
        {
          id: "contact-profile",
          type: "contact",
          title: "Contact",
          content: profileLines.join("\n"),
          contentKind: "paragraph",
          order: -1,
        },
        ...document.sections.map((section) => ({
          ...section,
          order: section.order + 1,
        })),
      ],
    };
  }

  const mergedContent = mergeContactContent(contactSection.content, normalized);
  if (mergedContent === contactSection.content) return document;

  return {
    ...document,
    sections: document.sections.map((section) =>
      section.id === contactSection.id ? { ...section, content: mergedContent } : section,
    ),
  };
}

function mergeContactContent(content: string, profile: UserProfileDetails): string {
  const existing = content.trim();
  if (!existing) return contactLinesFromProfile(profile).join("\n");

  const parsed = parseResumeContact(existing, "");
  const existingDetails = parsed.details.filter(Boolean);
  const existingCategories = new Set(existingDetails.map(contactCategory).filter(Boolean));
  const existingValues = new Set([parsed.name, ...existingDetails].map(normalizeComparable).filter(Boolean));
  const extraLines: string[] = [];

  const fullName = profile.fullName.trim();
  if (fullName && !parsed.name && !existingValues.has(normalizeComparable(fullName))) {
    extraLines.push(fullName);
  }

  for (const line of profileDetailLines(profile)) {
    const category = contactCategory(line);
    const comparable = normalizeComparable(line);
    if ((category && existingCategories.has(category)) || existingValues.has(comparable)) continue;
    extraLines.push(line);
  }

  if (extraLines.length === 0) return existing;
  return [existing, ...extraLines].join("\n");
}

function contactLinesFromProfile(profile: UserProfileDetails): string[] {
  return [profile.fullName, ...profileDetailLines(profile)]
    .map((line) => line.trim())
    .filter(Boolean);
}

function profileDetailLines(profile: UserProfileDetails): string[] {
  return [
    profile.location,
    profile.phone,
    profile.email,
    profile.website,
    profile.linkedin,
    profile.github,
  ]
    .map((line) => line.trim())
    .filter(Boolean);
}

function contactCategory(value: string): string {
  const normalized = value.toLowerCase();
  if (/@/.test(normalized)) return "email";
  if (/linkedin/.test(normalized)) return "linkedin";
  if (/github/.test(normalized)) return "github";
  if (/https?:|www\.|\.[a-z]{2,}/.test(normalized)) return "website";
  if (/\+?\d[\d\s().-]{6,}/.test(normalized)) return "phone";
  return "location";
}

function normalizeComparable(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readText(value: unknown): string {
  return typeof value === "string" ? value : "";
}
