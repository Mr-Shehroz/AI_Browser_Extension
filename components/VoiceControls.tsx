import { AGENT_NAME } from "@/lib/persona";
import { btnPrimary, panel } from "./ui";

export function MicButton({ listening, disabled, onClick }: { listening: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={listening}
      aria-label={listening ? "Stop listening" : "Speak to Zoya"}
      title={listening ? "Stop listening" : "Speak"}
      className={`grid h-9 w-9 shrink-0 place-items-center rounded-full transition-all disabled:opacity-40 ${
        listening
          ? "bg-ember text-white shadow-[0_0_18px_-4px_var(--color-ember)]"
          : "bg-steel text-haze hover:bg-teal hover:text-[#04201d]"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <rect x="9" y="3" width="6" height="11" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0M12 18v3" strokeLinecap="round" />
      </svg>
    </button>
  );
}

interface StripProps {
  supported: boolean;
  handsFree: boolean;
  onToggle: (on: boolean) => void;
  listening: boolean;
  interim: string;
  speaking: boolean;
  thinking: boolean;
  error: string | null;
  note: string | null;
  needsPermission: boolean;
  onAllow: () => void;
}

export function VoiceStrip(p: StripProps) {
  const status = !p.supported
    ? "This browser doesn't support speech recognition."
    : p.speaking
      ? `${AGENT_NAME} is talking. The mic waits until she's done.`
      : p.thinking
        ? `${AGENT_NAME} is thinking…`
        : p.listening
          ? "Listening. Just talk."
          : p.handsFree
            ? "Starting the mic…"
            : "Turn on hands-free, or press the mic next to the message box.";

  return (
    <section className={`${panel} space-y-2`} aria-label="Voice">
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-white">
          <input
            type="checkbox"
            role="switch"
            className="accent-[var(--color-teal)]"
            checked={p.handsFree}
            disabled={!p.supported}
            onChange={(e) => p.onToggle(e.target.checked)}
          />
          Hands-free
        </label>
        {p.handsFree && (
          <span className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-ember">
            <span className="h-2 w-2 animate-pulse rounded-full bg-ember" aria-hidden />
            Mic on
          </span>
        )}
      </div>
      <p className="text-xs text-dim" aria-live="polite">{status}</p>
      {p.interim && <p dir="auto" className="text-sm italic text-haze">{p.interim}</p>}
      {p.needsPermission && (
        <div className="space-y-2 rounded-lg border border-amber/45 bg-amber/5 p-3">
          <p className="text-xs text-haze">Chrome needs your OK once before {AGENT_NAME} can use the microphone.</p>
          <button className={btnPrimary} onClick={p.onAllow}>Allow microphone</button>
        </div>
      )}
      {p.error && <p className="text-xs text-ember" role="alert">{p.error}</p>}
      {p.note && <p className="text-xs text-amber">{p.note}</p>}
      <p className="text-[11px] text-dim">Your voice is turned into text by Chrome's speech service (Google).</p>
    </section>
  );
}