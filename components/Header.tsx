import { AGENT_NAME } from "@/lib/persona";
import type { Settings } from "@/lib/types";

export type View = "home" | "knowledge" | "log" | "settings";

const NAV: { id: View; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "knowledge", label: "Knowledge" },
  { id: "log", label: "Log" },
  { id: "settings", label: "Settings" },
];

export function Header({ settings, view, setView }: { settings: Settings; view: View; setView: (v: View) => void }) {
  return (
    <header className="sticky top-0 z-10 border-b border-white/5 bg-night/85 px-4 pb-3 pt-4 backdrop-blur">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-4xl font-black leading-none tracking-wide text-white">{AGENT_NAME}</h1>
        <span className="text-xs text-dim">NexForce</span>
      </div>
      <p className="mt-1 text-xs text-dim">
        {settings.userName ? `Hi ${settings.userName}, I'm here when you need me.` : "I'm here when you need me."}
      </p>
      <nav aria-label="Main" className="mt-3 flex gap-1 rounded-full border border-steel bg-deep/70 p-1">
        {NAV.map((n) => (
          <button
            key={n.id}
            type="button"
            aria-current={view === n.id ? "page" : undefined}
            onClick={() => setView(n.id)}
            className={`flex-1 rounded-full px-2 py-1 text-xs font-semibold transition-colors ${
              view === n.id ? "bg-teal text-[#04201d]" : "text-haze hover:text-white"
            }`}
          >
            {n.label}
          </button>
        ))}
      </nav>
    </header>
  );
}