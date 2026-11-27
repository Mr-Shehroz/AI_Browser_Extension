import { useState } from "react";
import { audit } from "@/lib/audit";
import { AGENT_NAME } from "@/lib/persona";
import { PROVIDERS } from "@/lib/providers";
import type { ReplyLanguage, Settings } from "@/lib/types";
import { ProviderForm } from "./ProviderForm";
import { btn, btnPrimary, input, label, panel } from "./ui";

export function Setup({ initial, onDone }: { initial: Settings; onDone: (s: Settings) => Promise<void> }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Settings>(initial);
  const set = (patch: Partial<Settings>) => setDraft((d) => ({ ...d, ...patch }));

  const info = PROVIDERS[draft.brain.kind];
  const brainReady = draft.brain.model.trim() && (!info.needsKey || draft.brain.apiKey.trim()) && draft.brain.baseUrl.trim();

  const finish = async () => {
    const done: Settings = { ...draft, setupDone: true, chat: draft.chatSameAsBrain ? draft.brain : draft.chat };
    void audit("setup_completed", { provider: done.brain.kind, model: done.brain.model, replyLanguage: done.replyLanguage });
    await onDone(done);
  };

  return (
    <div className="min-h-screen space-y-5 p-5">
      <div>
        <p className="text-xs text-dim">NexForce · Step {step + 1} of 3</p>
        <h1 className="mt-1 font-display text-5xl font-black leading-[0.95] text-white">
          {step === 0 ? `Hi, I'm ${AGENT_NAME}` : step === 1 ? "How should I talk?" : "Give me a brain"}
        </h1>
      </div>

      {step === 0 && (
        <div className={`${panel} space-y-3`}>
          <p className="text-sm leading-relaxed text-haze/85">
            I work in your browser, in my own tab, and I always ask before doing anything important. First, what should I call you?
          </p>
          <label className={label}>
            Your name
            <input className={`${input} mt-1`} value={draft.userName} onChange={(e) => set({ userName: e.target.value })} placeholder="Your name" autoFocus />
          </label>
          <div className="flex justify-end">
            <button className={btnPrimary} disabled={!draft.userName.trim()} onClick={() => setStep(1)}>Next</button>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className={`${panel} space-y-3`}>
          <p className="text-sm text-haze/85">I'll reply in this language. You can change it any time in Settings.</p>
          <div role="group" aria-label="Reply language" className="flex gap-2">
            {([["en", "English"], ["ur", "اردو"]] as [ReplyLanguage, string][]).map(([id, text]) => (
              <button
                key={id}
                type="button"
                aria-pressed={draft.replyLanguage === id}
                onClick={() => set({ replyLanguage: id })}
                className={`flex-1 rounded-xl border px-3 py-3 text-base font-semibold transition-colors ${
                  draft.replyLanguage === id ? "border-teal bg-teal/10 text-white" : "border-steel text-haze hover:text-white"
                }`}
              >
                {text}
              </button>
            ))}
          </div>
          <div className="flex justify-between">
            <button className={btn} onClick={() => setStep(0)}>Back</button>
            <button className={btnPrimary} onClick={() => setStep(2)}>Next</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={`${panel} space-y-4`}>
          <p className="text-sm leading-relaxed text-haze/85">
            Choose which AI does my thinking. Google Gemini has a free tier, so it's the easiest start. You can switch later.
          </p>
          <ProviderForm value={draft.brain} onChange={(brain) => set({ brain })} />
          <p className="rounded-lg border border-amber/35 bg-amber/5 p-3 text-xs leading-relaxed text-haze">
            With a cloud provider, the page text I read and what you ask me are sent to that company. For private things like
            banking, switch to Local Ollama in Settings, or do it yourself.
          </p>
          <div className="flex justify-between">
            <button className={btn} onClick={() => setStep(1)}>Back</button>
            <button className={btnPrimary} disabled={!brainReady} onClick={finish}>Finish setup</button>
          </div>
        </div>
      )}
    </div>
  );
}