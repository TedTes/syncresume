import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import type { LLMProvider } from "../lib/providers/types";
import {
  emptyUserProfileDetails,
  normalizeUserProfileDetails,
  type UserProfileDetails,
} from "../lib/userProfile";
import type { ResumeDocument } from "../resume/schema";
import {
  DEFAULT_TEMPLATE_ID,
  normalizeResumeTemplateId,
  type ResumeTemplateId,
} from "../templates/registry";
import {
  DEFAULT_RESUME_FONT_ID,
  normalizeResumeFontId,
  type ResumeFontId,
} from "../templates/shared/fonts";

type OptimizationToggles = {
  autoDetectRequirements: boolean;
  showKeywordDiff: boolean;
  saveRunHistory: boolean;
};

const TOGGLES_KEY = "syncresume.settings.toggles.v1";
const TEMPLATE_KEY = "syncresume.settings.template.v1";
const FONT_KEY = "syncresume.settings.font.v1";
const USER_PROFILE_KEY = "syncresume.settings.userProfile.v1";

const defaultToggles: OptimizationToggles = {
  autoDetectRequirements: true,
  showKeywordDiff: true,
  saveRunHistory: true,
};

function readToggles(): OptimizationToggles {
  try {
    const raw = window.localStorage.getItem(TOGGLES_KEY);
    if (!raw) return defaultToggles;
    return { ...defaultToggles, ...JSON.parse(raw) };
  } catch {
    return defaultToggles;
  }
}

function readTemplate(): ResumeTemplateId {
  const raw = window.localStorage.getItem(TEMPLATE_KEY);
  return normalizeResumeTemplateId(raw);
}

function readFont(): ResumeFontId {
  return normalizeResumeFontId(window.localStorage.getItem(FONT_KEY));
}

function readUserProfileDetails(): UserProfileDetails {
  try {
    const raw = window.localStorage.getItem(USER_PROFILE_KEY);
    if (!raw) return emptyUserProfileDetails;
    return normalizeUserProfileDetails(JSON.parse(raw));
  } catch {
    return emptyUserProfileDetails;
  }
}

function readProvider(): LLMProvider {
  const provider = String(import.meta.env.VITE_LLM_PROVIDER || "").toLowerCase();
  if (provider === "anthropic" || provider === "gemini" || provider === "openai") {
    return provider;
  }
  return "openai";
}

type SettingsContextValue = {
  provider: LLMProvider;
  userProfileDetails: UserProfileDetails;
  setUserProfileDetails: (details: UserProfileDetails) => void;
  setUserProfileField: (key: keyof UserProfileDetails, value: string) => void;
  selectedTemplateId: ResumeTemplateId;
  setSelectedTemplateId: (templateId: ResumeTemplateId) => void;
  selectedFontId: ResumeFontId;
  setSelectedFontId: (fontId: ResumeFontId) => void;
  templatePreviewDocument: ResumeDocument | null;
  setTemplatePreviewDocument: (document: ResumeDocument | null) => void;
  toggles: OptimizationToggles;
  setToggle: (key: keyof OptimizationToggles, value: boolean) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [selectedTemplateId, setSelectedTemplateIdState] = useState<ResumeTemplateId>(() =>
    readTemplate(),
  );
  const [selectedFontId, setSelectedFontIdState] = useState<ResumeFontId>(() => readFont());
  const [templatePreviewDocument, setTemplatePreviewDocument] = useState<ResumeDocument | null>(null);
  const [toggles, setToggles] = useState<OptimizationToggles>(() => readToggles());
  const [userProfileDetails, setUserProfileDetailsState] = useState<UserProfileDetails>(() =>
    readUserProfileDetails(),
  );

  useEffect(() => {
    window.localStorage.setItem(TEMPLATE_KEY, selectedTemplateId);
  }, [selectedTemplateId]);

  useEffect(() => {
    window.localStorage.setItem(FONT_KEY, selectedFontId);
  }, [selectedFontId]);

  useEffect(() => {
    window.localStorage.setItem(TOGGLES_KEY, JSON.stringify(toggles));
  }, [toggles]);

  useEffect(() => {
    window.localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(userProfileDetails));
  }, [userProfileDetails]);

  function setToggle(key: keyof OptimizationToggles, value: boolean) {
    setToggles((current) => ({ ...current, [key]: value }));
  }

  const setSelectedTemplateId = useCallback((templateId: ResumeTemplateId) => {
    setSelectedTemplateIdState(normalizeResumeTemplateId(templateId) || DEFAULT_TEMPLATE_ID);
  }, []);

  const setSelectedFontId = useCallback((fontId: ResumeFontId) => {
    setSelectedFontIdState(normalizeResumeFontId(fontId) || DEFAULT_RESUME_FONT_ID);
  }, []);

  const setUserProfileDetails = useCallback((details: UserProfileDetails) => {
    setUserProfileDetailsState(normalizeUserProfileDetails(details));
  }, []);

  const setUserProfileField = useCallback((key: keyof UserProfileDetails, value: string) => {
    setUserProfileDetailsState((current) =>
      normalizeUserProfileDetails({ ...current, [key]: value }),
    );
  }, []);

  const value: SettingsContextValue = {
    provider: readProvider(),
    userProfileDetails,
    setUserProfileDetails,
    setUserProfileField,
    selectedTemplateId,
    setSelectedTemplateId,
    selectedFontId,
    setSelectedFontId,
    templatePreviewDocument,
    setTemplatePreviewDocument,
    toggles,
    setToggle,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within a SettingsProvider");
  return ctx;
}
