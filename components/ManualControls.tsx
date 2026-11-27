import { useMemo, useState } from "react";
import type { BrowserAction, PageObservation } from "@/lib/types";
import { btn, btnPrimary, input, panel, panelTitle } from "./ui";

interface Props {
  observation: PageObservation | null;
  disabled: boolean;
  onRun: (action: BrowserAction) => Promise<unknown>;
  onObserve: () => Promise<unknown>;
}

export function ManualControls({ observation, disabled, onRun, onObserve }: Props) {
  const [url, setUrl] = useState("https://");
  const [filter, setFilter] = useState("");
  const [typing, setTyping] = useState<string | null>(null);
  const [text, setText] = useState("");

  const elements = useMemo(() => {
    const q = filter.toLowerCase();
    return (observation?.elements ?? []).filter((e) => !q || e.name.toLowerCase().includes(q) || e.role.includes(q));
  }, [observation, filter]);

  const go = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = url.trim();
    if (!raw || raw === "https://") return;
    void onRun({ type: "navigate", url: raw.includes("://") ? raw : `https://${raw}` });
  };

  return (
    <details className={panel}>
      <summary className="cursor-pointer select-none font-display text-xl font-bold tracking-wide text-white">Manual controls</summary>
      <div className="mt-3 space-y-3">
        <form className="flex gap-2" onSubmit={go}>
          <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Web address" />
          <button className={btnPrimary} disabled={disabled}>Go</button>
        </form>

        <div className="flex flex-wrap gap-2">
          <button className={btn} disabled={disabled} onClick={() => void onObserve()}>Read the page</button>
          <button className={btn} disabled={disabled} onClick={() => void onRun({ type: "back" })}>Back</button>
          <button className={btn} disabled={disabled} onClick={() => void onRun({ type: "scroll", direction: "up" })}>Up</button>
          <button className={btn} disabled={disabled} onClick={() => void onRun({ type: "scroll", direction: "down" })}>Down</button>
          <button className={btn} disabled={disabled} onClick={() => void onRun({ type: "press", key: "Enter" })}>Enter</button>
        </div>

        {observation && (
          <div className="space-y-2 border-t border-white/5 pt-3">
            <div className="flex items-center justify-between">
              <h3 className={panelTitle}>On this page</h3>
              {observation.blockers.length > 0 && <span className="text-xs text-amber">{observation.blockers.join(", ")}</span>}
            </div>
            <input className={input} value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter by name" aria-label="Filter elements" />
            <ul className="max-h-72 space-y-1 overflow-auto pr-1 text-sm">
              {elements.map((el) => (
                <li key={el.ref} className={`rounded px-2 py-1 hover:bg-white/5 ${el.inViewport ? "" : "opacity-60"}`}>
                  <div className="flex items-center gap-2">
                    <span className="w-14 shrink-0 truncate text-xs text-dim">{el.role}</span>
                    <span className="min-w-0 flex-1 truncate">{el.name || <em className="text-dim">unnamed</em>}</span>
                    <button className={btn} disabled={disabled} onClick={() => void onRun({ type: "click", ref: el.ref })}>Click</button>
                    {["input", "textarea", "select"].includes(el.role) || el.role === "textbox" ? (
                      <button className={btn} disabled={disabled} onClick={() => { setTyping(el.ref); setText(""); }}>Type</button>
                    ) : null}
                  </div>
                  {typing === el.ref && (
                    <form
                      className="mt-2 flex gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void onRun({ type: "type", ref: el.ref, text });
                        setTyping(null);
                      }}
                    >
                      <input className={input} value={text} onChange={(e) => setText(e.target.value)} placeholder="Text to type" autoFocus />
                      <button className={btnPrimary} disabled={disabled}>Type</button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}