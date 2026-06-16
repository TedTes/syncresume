import { useState } from "react";
import { useSettings } from "../context/SettingsContext";
import { PROVIDERS } from "../lib/providers/types";

export default function SettingsPage() {
  const { provider, setProvider, apiKey, setApiKey, model, toggles, setToggle } = useSettings();
  const [keyInput, setKeyInput] = useState(apiKey);

  return (
    <>
      <header className="page-topbar">
        <span className="page-topbar-title">Settings</span>
      </header>

      <main className="page-content page-content-narrow">
        <div className="settings-page">
          <section className="settings-card">
            <p className="settings-card-title">LLM provider</p>

            <div className="settings-row">
              <div>
                <p className="settings-row-label">Provider</p>
                <p className="settings-row-desc">Anthropic and Gemini are coming soon.</p>
              </div>
              <div className="provider-pills">
                {PROVIDERS.map((info) => (
                  <button
                    key={info.id}
                    type="button"
                    className={`provider-pill ${provider === info.id ? "active" : ""}`}
                    onClick={() => setProvider(info.id)}
                  >
                    {info.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="settings-row">
              <div>
                <p className="settings-row-label">API key</p>
                <p className="settings-row-desc">Stored in session only, never persisted.</p>
              </div>
              <div className="api-key-input-row">
                <input
                  className="field-input"
                  type="password"
                  value={keyInput}
                  placeholder="sk-…"
                  autoComplete="off"
                  onChange={(e) => setKeyInput(e.target.value)}
                  onBlur={() => setApiKey(keyInput)}
                />
              </div>
            </div>

            <div className="settings-row">
              <div>
                <p className="settings-row-label">Model</p>
              </div>
              <span className="settings-readonly-value">{model}</span>
            </div>
          </section>

          <section className="settings-card">
            <p className="settings-card-title">Optimization behaviour</p>

            <ToggleRow
              label="Auto-detect requirements"
              desc="Pull keywords from the job description automatically."
              checked={toggles.autoDetectRequirements}
              onChange={(value) => setToggle("autoDetectRequirements", value)}
            />
            <ToggleRow
              label="Show keyword diff"
              desc="Highlight matched and missing keywords after optimizing."
              checked={toggles.showKeywordDiff}
              onChange={(value) => setToggle("showKeywordDiff", value)}
            />
            <ToggleRow
              label="Save run history"
              desc="Keep a record of past optimization runs on the Dashboard."
              checked={toggles.saveRunHistory}
              onChange={(value) => setToggle("saveRunHistory", value)}
            />
          </section>

          <section className="settings-card">
            <p className="settings-card-title">Account</p>
            <div className="settings-row">
              <p className="settings-row-label">Email</p>
              <span className="settings-readonly-value">you@example.com</span>
            </div>
            <div className="settings-row">
              <p className="settings-row-label">Plan</p>
              <span className="settings-readonly-value">Free</span>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}

function ToggleRow({
  label,
  desc,
  checked,
  onChange,
}: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="settings-row">
      <div>
        <p className="settings-row-label">{label}</p>
        <p className="settings-row-desc">{desc}</p>
      </div>
      <label className="toggle-switch">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle-switch-track" />
      </label>
    </div>
  );
}
