import { useState } from "react";
import { audit } from "@/lib/audit";
import { openMicPermission } from "@/lib/permissions";
import { detachAll } from "@/lib/trustedInput";
import { useSpeechOutput } from "@/lib/useSpeechOutput";
import type { ApprovalMode, ListenLanguage, ReplyLanguage, Settings, VoiceSettings } from "@/lib/types";
import { ProviderForm } from "./ProviderForm";
import { btn, btnPrimary, input, label, panel, panelTitle } from "./ui";

const voiceLabel = (name: string) => name.replace(/^Microsoft\s+/, "").replace(/\s+-\s+.*$/, "");

export function SettingsView({ settings, onSave }: { settings: Settings; onSave: (s: Settings) => Promise<void> }) {
  const [draft, setDraft] = useState<Settings>(settings);
  const [saved, setSaved] = useState(false);
  const speech = useSpeechOutput(draft.voice);

  const set = (patch: Partial<Settings>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setSaved(false);
  };
  const setVoice = (patch: Partial<VoiceSettings>) => set({ voice: { ...draft.voice, ...patch } });

  const save = async () => {
    const next = { ...draft, chat: draft.chatSameAsBrain ? draft.brain : draft.chat };
    await onSave(next);
    if (!next.trustedInput) await detachAll();
    void audit("settings_changed", {
      brain: `${next.brain.kind}:${next.brain.model}`,
      chat: `${next.chat.kind}:${next.chat.model}`,
      fallback: next.fallbackEnabled ? `${next.fallback.kind}:${next.fallback.model}` : "off",
      replyLanguage: next.replyLanguage,
      approvalMode: next.approvalMode,
      quickMode: next.quickMode,
      trustedInput: next.trustedInput,
      listenLang: next.voice.listenLang,
      speakReplies: next.voice.speakReplies,
    });
    setSaved(true);
  };

  const testVoice = () => {
    const name = draft.userName.trim();
    speech.speak(
      draft.replyLanguage === "ur"
        ? `ہائے${name ? ` ${name}` : ""}! میری آواز کیسی لگی؟`
        : `Hi${name ? ` ${name}` : ""}! How do I sound?`,
    );
  };

  return (
    <div className="space-y-4">
      <section className={`${panel} space-y-3`}>
        <h2 className={panelTitle}>You</h2>
        <label className={label}>
          Your name
          <input className={`${input} mt-1`} value={draft.userName} onChange={(e) => set({ userName: e.target.value })} />
        </label>
        <label className={label}>
          Zoya replies in
          <select className={`${input} mt-1`} value={draft.replyLanguage} onChange={(e) => set({ replyLanguage: e.target.value as ReplyLanguage })}>
            <option value="en">English</option>
            <option value="ur">اردو</option>
          </select>
        </label>
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className={panelTitle}>Voice</h2>
        <label className={label}>
          I speak in
          <select className={`${input} mt-1`} value={draft.voice.listenLang} onChange={(e) => setVoice({ listenLang: e.target.value as ListenLanguage })}>
            <option value="en-US">English</option>
            <option value="ur-PK">اردو (Urdu)</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            className="accent-[var(--color-teal)]"
            checked={draft.voice.speakReplies}
            onChange={(e) => setVoice({ speakReplies: e.target.checked })}
          />
          Zoya speaks her replies (always on in hands-free)
        </label>
        <label className={label}>
          English voice
          <select className={`${input} mt-1`} value={draft.voice.englishVoice} onChange={(e) => setVoice({ englishVoice: e.target.value })}>
            <option value="">Automatic (female)</option>
            {speech.englishVoices.map((v) => (
              <option key={v.name} value={v.name}>{voiceLabel(v.name)} ({v.lang})</option>
            ))}
          </select>
        </label>
        {speech.urduVoices.length > 0 ? (
          <label className={label}>
            Urdu voice
            <select className={`${input} mt-1`} value={draft.voice.urduVoice} onChange={(e) => setVoice({ urduVoice: e.target.value })}>
              <option value="">Automatic (female)</option>
              {speech.urduVoices.map((v) => (
                <option key={v.name} value={v.name}>{voiceLabel(v.name)} ({v.lang})</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="text-xs leading-relaxed text-dim">
            This browser has no Urdu voice, so Urdu replies are shown but not spoken. Microsoft Edge includes a free Urdu voice,
            and this extension works there too.
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <button className={btn} onClick={testVoice}>Test voice</button>
          {speech.speaking && <button className={btn} onClick={speech.cancel}>Stop</button>}
          <button className={btn} onClick={() => void openMicPermission()}>Allow microphone</button>
        </div>
        {speech.note && <p className="text-xs text-amber">{speech.note}</p>}
        <p className="text-xs text-dim">Listening uses Chrome's speech service, which sends your voice to Google to turn it into text.</p>
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className={panelTitle}>Safety</h2>
        <label className={label}>
          Ask before
          <select className={`${input} mt-1`} value={draft.approvalMode} onChange={(e) => set({ approvalMode: e.target.value as ApprovalMode })}>
            <option value="standard">Anything that submits, sends, saves or deletes</option>
            <option value="strict">Every step except reading and opening pages</option>
          </select>
        </label>
        <label className="flex items-start gap-2 text-sm text-white">
          <input type="checkbox" className="mt-1 accent-[var(--color-teal)]" checked={draft.quickMode} onChange={(e) => set({ quickMode: e.target.checked })} />
          <span>
            Quick mode
            <span className="block text-xs text-dim">No plan first: Zoya starts right away. Risky steps still ask you.</span>
          </span>
        </label>
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className={panelTitle}>Compatibility</h2>
        <label className="flex items-start gap-2 text-sm text-white">
          <input
            type="checkbox"
            className="mt-1 accent-[var(--color-teal)]"
            checked={draft.trustedInput}
            onChange={(e) => set({ trustedInput: e.target.checked })}
          />
          <span>
            Trusted input
            <span className="block text-xs text-dim">
              For sites that ignore Zoya's clicks or typing. Uses Chrome's own input system, so Chrome shows a "debugging this
              browser" bar while it's on. Clicking Cancel on that bar switches it off until the next step.
            </span>
          </span>
        </label>
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className={panelTitle}>Brain for browser tasks</h2>
        <ProviderForm value={draft.brain} onChange={(brain) => set({ brain })} />
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className={panelTitle}>Brain for chatting</h2>
        <label className="flex items-center gap-2 text-sm text-white">
          <input
            type="checkbox"
            className="accent-[var(--color-teal)]"
            checked={draft.chatSameAsBrain}
            onChange={(e) => set({ chatSameAsBrain: e.target.checked })}
          />
          Same as browser tasks
        </label>
        {!draft.chatSameAsBrain && (
          <>
            <p className="text-xs text-dim">A faster or cheaper model makes small talk snappier.</p>
            <ProviderForm value={draft.chat} onChange={(chat) => set({ chat })} />
          </>
        )}
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className={panelTitle}>Backup brain</h2>
        <label className="flex items-start gap-2 text-sm text-white">
          <input
            type="checkbox"
            className="mt-1 accent-[var(--color-teal)]"
            checked={draft.fallbackEnabled}
            onChange={(e) => set({ fallbackEnabled: e.target.checked })}
          />
          <span>
            Use a backup when the main brain is down or out of free quota
            <span className="block text-xs text-dim">Zoya tells you in the chat when she switches. A wrong key or model never switches.</span>
          </span>
        </label>
        {draft.fallbackEnabled && <ProviderForm value={draft.fallback} onChange={(fallback) => set({ fallback })} />}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <button className={btnPrimary} onClick={save}>Save settings</button>
        {saved && <span className="text-xs text-teal">Saved.</span>}
        <button className={`${btn} ml-auto`} onClick={() => onSave({ ...settings, setupDone: false })}>Run setup again</button>
      </div>
    </div>
  );
}