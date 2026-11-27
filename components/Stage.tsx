import { AGENT_NAME } from "@/lib/persona";
import type { ZoyaTab } from "@/lib/useAgent";
import { btn, btnPrimary } from "./ui";

interface Props {
  tab: ZoyaTab | null;
  busy: boolean;
  waiting: boolean;
  failed: boolean;
  onOpen: () => void;
  onFocus: () => void;
  onObserve: () => void;
}

export function Stage({ tab, busy, waiting, failed, onOpen, onFocus, onObserve }: Props) {
  const mood = waiting ? "approval" : busy ? "running" : failed ? "alert" : "idle";
  const label = waiting ? "Waiting for you" : busy ? "Working" : "Ready";

  return (
    <section className="stage-card" data-mood={mood} aria-label={`${AGENT_NAME}'s tab`}>
      {tab ? (
        <div className="space-y-3 p-4">
          <div className="flex items-center gap-2">
            <span className={`rec-dot ${busy ? "is-live" : ""}`} aria-hidden />
            <span className="font-display text-xl font-bold tracking-wide text-white">{label}</span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{tab.title || "Untitled page"}</p>
            <p className="truncate text-xs text-dim">{tab.url}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btn} onClick={onFocus}>Show tab</button>
            <button className={btn} onClick={onObserve} disabled={busy}>Read the page</button>
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-6 text-center">
          <h2 className="font-display text-4xl font-black leading-none text-white">Ready when you are</h2>
          <p className="text-sm leading-relaxed text-haze/80">
            I work in my own tab, inside a tab group called “{AGENT_NAME}”, so your other tabs stay yours.
          </p>
          <button className={`${btnPrimary} px-6 py-2 text-sm`} onClick={onOpen}>Open {AGENT_NAME}'s tab</button>
        </div>
      )}
    </section>
  );
}