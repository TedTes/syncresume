import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { getProviderInfo, PROVIDERS, type LLMProvider } from "../lib/providers/types";
import {
  DEFAULT_TEMPLATE_ID,
  normalizeResumeTemplateId,
  type ResumeTemplateId,
} from "../lib/resumeTemplates";

type OptimizationToggles = {
  autoDetectRequirements: boolean;
  showKeywordDiff: boolean;
  saveRunHistory: boolean;
};

const TOGGLES_KEY = "syncresume.settings.toggles.v1";
const PROVIDER_KEY = "syncresume.settings.provider.v1";
const TEMPLATE_KEY = "syncresume.settings.template.v1";

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

function readProvider(): LLMProvider {
  const raw = window.localStorage.getItem(PROVIDER_KEY);
  const provider = PROVIDERS.find((item) => item.id === raw);
  return provider?.enabled ? provider.id : "openai";
}

function readTemplate(): ResumeTemplateId {
  const raw = window.localStorage.getItem(TEMPLATE_KEY);
  return normalizeResumeTemplateId(raw);
}

type SettingsContextValue = {
  provider: LLMProvider;
  setProvider: (provider: LLMProvider) => void;
  model: string;
  selectedTemplateId: ResumeTemplateId;
  setSelectedTemplateId: (templateId: ResumeTemplateId) => void;
  toggles: OptimizationToggles;
  setToggle: (key: keyof OptimizationToggles, value: boolean) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [provider, setProviderState] = useState<LLMProvider>(() => readProvider());
  const [selectedTemplateId, setSelectedTemplateIdState] = useState<ResumeTemplateId>(() =>
    readTemplate(),
  );
  const [toggles, setToggles] = useState<OptimizationToggles>(() => readToggles());

  useEffect(() => {
    window.localStorage.setItem(PROVIDER_KEY, provider);
  }, [provider]);

  useEffect(() => {
    window.localStorage.setItem(TEMPLATE_KEY, selectedTemplateId);
  }, [selectedTemplateId]);

  useEffect(() => {
    window.localStorage.setItem(TOGGLES_KEY, JSON.stringify(toggles));
  }, [toggles]);

  function setToggle(key: keyof OptimizationToggles, value: boolean) {
    setToggles((current) => ({ ...current, [key]: value }));
  }

  const setSelectedTemplateId = useCallback((templateId: ResumeTemplateId) => {
    setSelectedTemplateIdState(normalizeResumeTemplateId(templateId) || DEFAULT_TEMPLATE_ID);
  }, []);

  const value: SettingsContextValue = {
    provider,
    setProvider: (nextProvider) => {
      if (getProviderInfo(nextProvider).enabled) {
        setProviderState(nextProvider);
      }
    },
    model: getProviderInfo(provider).model,
    selectedTemplateId,
    setSelectedTemplateId,
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
