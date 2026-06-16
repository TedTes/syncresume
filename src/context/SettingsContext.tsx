import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { getProviderInfo, type LLMProvider } from "../lib/providers/types";
import { getSessionApiKey, setSessionApiKey } from "../lib/runtimeConfig";

type OptimizationToggles = {
  autoDetectRequirements: boolean;
  showKeywordDiff: boolean;
  saveRunHistory: boolean;
};

const TOGGLES_KEY = "syncresume.settings.toggles.v1";
const PROVIDER_KEY = "syncresume.settings.provider.v1";

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
  return raw === "anthropic" || raw === "openai" || raw === "gemini" ? raw : "openai";
}

type SettingsContextValue = {
  provider: LLMProvider;
  setProvider: (provider: LLMProvider) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  model: string;
  toggles: OptimizationToggles;
  setToggle: (key: keyof OptimizationToggles, value: boolean) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [provider, setProviderState] = useState<LLMProvider>(() => readProvider());
  // Seeded from runtimeConfig (memory-only) — never read from/written to localStorage.
  const [apiKey, setApiKeyState] = useState<string>(() => getSessionApiKey());
  const [toggles, setToggles] = useState<OptimizationToggles>(() => readToggles());

  useEffect(() => {
    window.localStorage.setItem(PROVIDER_KEY, provider);
  }, [provider]);

  useEffect(() => {
    window.localStorage.setItem(TOGGLES_KEY, JSON.stringify(toggles));
  }, [toggles]);

  function setApiKey(key: string) {
    setSessionApiKey(key);
    setApiKeyState(key.trim());
  }

  function setToggle(key: keyof OptimizationToggles, value: boolean) {
    setToggles((current) => ({ ...current, [key]: value }));
  }

  const value: SettingsContextValue = {
    provider,
    setProvider: setProviderState,
    apiKey,
    setApiKey,
    model: getProviderInfo(provider).model,
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
