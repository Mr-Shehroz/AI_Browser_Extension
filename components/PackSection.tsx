import { useState } from "react";
import { applyPack, exportPack, parsePack, type ConflictMode, type ParsedPack, type SkillAction } from "@/lib/pack";
import type { Settings } from "@/lib/types";
import { btn, btnPrimary, panel, panelTitle } from "./ui";

const ACTION_LABEL: Record<SkillAction, string> = { new: "New", update: "New versions", same: "Already here", conflict: "Differs from yours" };
const ACTION_STYLE: Record<SkillAction, string> = { new: "text-teal", update: "text-teal", same: "text-dim", conflict: "text-amber" };

export function PackSection({ settings }: { settings: Settings }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedPack | null>(null);
  const [mode, setMode] = useState<ConflictMode>("keep_mine");

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  const p = parsed?.preview;
  const conflicts = p?.skills.filter((s) => s.action === "conflict").length ?? 0;

  return (
    <section className={`${panel} space-y-3`}>
      <h2 className={panelTitle}>Share or move</h2>
      <p className="text-xs leading-relaxed text-dim">
        A knowledge pack carries skills, site notes and research to another computer or a friend's Chrome. API keys, passwords,
        cookies and logins are never included.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          className={btnPrimary}
          disabled={busy}
          onClick={() => void run(async () => {
            const r = await exportPack(settings);
            setMessage(`Downloaded ${r.fileName}.${r.excluded.length ? ` ${r.excluded.length} file(s) were left out because they looked like secrets.` : ""}`);
          })}
        >
          Export pack
        </button>
        <label className={`${btn} cursor-pointer`}>
          {busy ? "Working…" : "Import a pack"}
          <input
            type="file"
            accept=".zip,application/zip"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void run(async () => setParsed(await parsePack(file)));
            }}
          />
        </label>
      </div>
      {message && <p className="text-xs text-teal">{message}</p>}
      {error && <p className="text-xs text-ember" role="alert">{error}</p>}

      {p && parsed && (
        <div className="space-y-2 rounded-xl border border-amber/45 bg-amber/5 p-3 text-xs">
          <p className="font-display text-lg font-bold text-white">Check before merging</p>
          <p className="text-dim">{p.fileName}, exported {new Date(p.exportedAt).toLocaleString()}</p>
          <p className={p.problems.length ? "text-ember" : "text-teal"}>
            {p.problems.length ? "Some files are damaged or were edited after export." : "Every file matches its checksum."}
          </p>
          {p.problems.length > 0 && <ul className="list-disc pl-5 text-ember">{p.problems.slice(0, 6).map((x) => <li key={x}>{x}</li>)}</ul>}
          {p.warnings.length > 0 && <ul className="list-disc pl-5 text-amber">{p.warnings.slice(0, 6).map((x) => <li key={x}>{x}</li>)}</ul>}
          <ul className="max-h-36 space-y-1 overflow-auto">
            {p.skills.map((s) => (
              <li key={s.id} className="flex gap-2">
                <span className="min-w-0 flex-1 truncate text-haze">{s.name} (v{s.versions.join(", v")})</span>
                <span className={`shrink-0 font-semibold ${ACTION_STYLE[s.action]}`}>{ACTION_LABEL[s.action]}</span>
              </li>
            ))}
          </ul>
          <p className="text-haze/85">
            Sites: {p.sites.filter((s) => s.action === "new").length} new, {p.sites.filter((s) => s.action === "merge").length} to merge.
            Research: {p.research.new} new, {p.research.existing} already here.
          </p>
          {conflicts > 0 && (
            <fieldset className="space-y-1">
              <legend className="font-semibold text-white">{conflicts} skill(s) differ from yours:</legend>
              <label className="flex gap-2 text-haze">
                <input type="radio" name="conflict" checked={mode === "keep_mine"} onChange={() => setMode("keep_mine")} /> Keep mine, skip theirs
              </label>
              <label className="flex gap-2 text-haze">
                <input type="radio" name="conflict" checked={mode === "add_as_draft"} onChange={() => setMode("add_as_draft")} /> Keep mine, add theirs as a draft
              </label>
            </fieldset>
          )}
          <p className="text-dim">Imported skills are re-checked before first use. Skills without sources need a new test.</p>
          <div className="flex justify-end gap-2">
            <button className={btn} onClick={() => setParsed(null)}>Discard</button>
            <button
              className={btnPrimary}
              disabled={busy || p.problems.length > 0}
              onClick={() => void run(async () => {
                setMessage(await applyPack(parsed, mode));
                setParsed(null);
              })}
            >
              Merge
            </button>
          </div>
        </div>
      )}
    </section>
  );
}