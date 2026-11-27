import { useEffect, useState } from "react";
import { downloadJson, readAudit } from "@/lib/audit";
import type { AuditEntry } from "@/lib/types";
import { btn, panel, panelTitle } from "./ui";

export function LogView() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);

  const load = () => void readAudit().then(setEntries);
  useEffect(load, []);

  return (
    <section className={`${panel} space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className={panelTitle}>Activity log</h2>
        <div className="flex gap-2">
          <button className={btn} onClick={load}>Refresh</button>
          <button className={btn} disabled={!entries.length} onClick={() => downloadJson(`zoya-log-${new Date().toISOString().slice(0, 10)}.json`, entries)}>
            Download
          </button>
        </div>
      </div>
      <p className="text-xs text-dim">Everything Zoya does and every approval, kept on this computer. API keys are never logged.</p>
      {entries.length === 0 ? (
        <p className="text-sm text-dim">Nothing yet.</p>
      ) : (
        <ol className="max-h-[70vh] space-y-1.5 overflow-auto pr-1 text-xs">
          {[...entries].reverse().slice(0, 300).map((e, i) => (
            <li key={`${e.at}-${i}`} className="frame-card">
              <div className="flex gap-2">
                <span className="font-semibold text-white">{e.event.replaceAll("_", " ")}</span>
                <time className="ml-auto tabular-nums text-dim">{new Date(e.at).toLocaleString()}</time>
              </div>
              {Object.keys(e.data).length > 0 && (
                <p className="mt-1 break-words text-dim">{JSON.stringify(e.data).slice(0, 300)}</p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}