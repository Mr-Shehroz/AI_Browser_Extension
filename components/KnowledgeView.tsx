import { useState } from "react";
import { researchUrl } from "@/lib/research";
import { addSiteNote } from "@/lib/sites";
import type { Settings } from "@/lib/types";
import type { SkillTestRequest } from "@/lib/useGoal";
import { useKnowledge } from "@/lib/useKnowledge";
import { PackSection } from "./PackSection";
import { SkillCard } from "./SkillCard";
import { btn, btnPrimary, input, panel, panelTitle } from "./ui";

export function KnowledgeView({ settings, onTestSkill }: { settings: Settings; onTestSkill: (req: SkillTestRequest) => void }) {
  const { data } = useKnowledge();
  const [url, setUrl] = useState("");
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState<"note" | "pitfall">("note");

  if (!data) return <p className="text-sm text-dim">Loading…</p>;
  const active = data.skills.filter((s) => s.status !== "retired");
  const retired = data.skills.filter((s) => s.status === "retired");

  const read = async (e: React.FormEvent) => {
    e.preventDefault();
    const raw = url.trim();
    if (!raw) return;
    setReading(true);
    setReadError(null);
    try {
      await researchUrl(raw.includes("://") ? raw : `https://${raw}`, "General reference for future tasks", settings);
      setUrl("");
    } catch (err) {
      setReadError(err instanceof Error ? err.message : "Couldn't read that page.");
    } finally {
      setReading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-4xl font-black leading-none text-white">Skills</h2>
        <p className="mt-2 text-xs leading-relaxed text-haze/80">
          Things I've learned to do. Test one to prove it works, then approve it, and I'll use it on similar tasks.
        </p>
      </div>
      {active.length === 0 ? (
        <p className={`${panel} text-sm text-haze/80`}>No skills yet. When a task works, choose “Save as skill” on the Home tab.</p>
      ) : (
        active.map((s) => <SkillCard key={s.id} skill={s} onTest={onTestSkill} />)
      )}
      {retired.length > 0 && (
        <details className={panel}>
          <summary className="cursor-pointer text-sm font-semibold text-white">Retired ({retired.length})</summary>
          <ul className="mt-2 space-y-1 text-xs text-dim">{retired.map((s) => <li key={s.id}>{s.name} v{s.version}</li>)}</ul>
        </details>
      )}

      <section className={`${panel} space-y-3`}>
        <h2 className={panelTitle}>Research</h2>
        <p className="text-xs text-dim">Pages I've read, with the date. Re-reading them later is how I spot changes.</p>
        <form className="flex gap-2" onSubmit={read}>
          <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://help.example.com/guide" />
          <button className={btnPrimary} disabled={!url.trim() || reading}>{reading ? "Reading…" : "Read"}</button>
        </form>
        {readError && <p className="text-xs text-ember" role="alert">{readError}</p>}
        {data.research.length === 0 ? (
          <p className="text-sm text-dim">Nothing read yet.</p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-auto pr-1">
            {data.research.map((n) => (
              <li key={n.id} className="frame-card">
                <a href={n.url} target="_blank" rel="noreferrer" className="text-sm font-semibold text-white hover:text-teal">{n.title}</a>
                <p className="break-all text-[11px] text-dim">{n.url}, read {new Date(n.accessedAt).toLocaleDateString()}</p>
                {!n.relevant && <p className="text-[11px] text-amber">Not relevant to the task it was read for</p>}
                <p className="mt-1 text-xs leading-relaxed text-haze/85">{n.summary}</p>
                {n.versionInfo && <p className="text-[11px] text-teal/80">{n.versionInfo}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={`${panel} space-y-3`}>
        <h2 className={panelTitle}>Sites</h2>
        <p className="text-xs text-dim">Sites I've worked on. Your notes and pitfalls are shown to me whenever I'm on that site.</p>
        {data.sites.length === 0 ? (
          <p className="text-sm text-dim">No sites yet.</p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-auto pr-1">
            {data.sites.map((s) => (
              <li key={s.domain} className="frame-card space-y-1.5">
                <div className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-white">{s.domain}</span>
                  <span className="shrink-0 text-[11px] text-dim">{s.visits} visits</span>
                </div>
                {s.notes.length > 0 && <ul className="list-disc pl-5 text-xs text-haze/85">{s.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>}
                {s.pitfalls.length > 0 && <ul className="list-disc pl-5 text-xs text-amber">{s.pitfalls.map((n, i) => <li key={i}>Pitfall: {n}</li>)}</ul>}
                {noteFor === s.domain ? (
                  <form
                    className="space-y-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!note.trim()) return;
                      void addSiteNote(s.domain, note, noteType);
                      setNote("");
                      setNoteFor(null);
                    }}
                  >
                    <input className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The export button is under Settings" autoFocus />
                    <div className="flex items-center gap-2">
                      <select className={`${input} w-auto`} value={noteType} onChange={(e) => setNoteType(e.target.value as "note" | "pitfall")} aria-label="Note type">
                        <option value="note">Note</option>
                        <option value="pitfall">Pitfall</option>
                      </select>
                      <button type="button" className={`${btn} ml-auto`} onClick={() => setNoteFor(null)}>Cancel</button>
                      <button className={btnPrimary} disabled={!note.trim()}>Add</button>
                    </div>
                  </form>
                ) : (
                  <button className={btn} onClick={() => { setNoteFor(s.domain); setNote(""); setNoteType("note"); }}>Add note</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <PackSection settings={settings} />
    </div>
  );
}