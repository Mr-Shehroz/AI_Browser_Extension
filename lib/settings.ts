import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { PROVIDERS } from "./providers";
import type { Settings } from "./types";

const KEY = "settings";

export const DEFAULT_SETTINGS: Settings = {
  setupDone: false,
  userName: "",
  replyLanguage: "en",
  approvalMode: "standard",
  quickMode: true,
  brain: { kind: "gemini", apiKey: "", baseUrl: PROVIDERS.gemini.baseUrl, model: "" },
  chatSameAsBrain: true,
  chat: { kind: "gemini", apiKey: "", baseUrl: PROVIDERS.gemini.baseUrl, model: "" },
  voice: { speakReplies: true, listenLang: "en-US", englishVoice: "", urduVoice: "" },
  trustedInput: false,
  fallbackEnabled: false,
  fallback: { kind: "ollama", apiKey: "", baseUrl: PROVIDERS.ollama.baseUrl, model: "" },
};

/** Settings, including API keys, stay in this Chrome profile on this computer. They are never synced. */
export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.local.get(KEY);
  const saved = (stored[KEY] as Partial<Settings> | undefined) ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...saved,
    voice: { ...DEFAULT_SETTINGS.voice, ...(saved.voice ?? {}) },
    fallback: { ...DEFAULT_SETTINGS.fallback, ...(saved.fallback ?? {}) },
  };
}

export async function saveSettings(s: Settings): Promise<void> {
  await browser.storage.local.set({ [KEY]: s });
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    void loadSettings().then(setSettings);
  }, []);

  const update = useCallback(async (next: Settings) => {
    setSettings(next);
    await saveSettings(next);
  }, []);

  return { settings, update };
}