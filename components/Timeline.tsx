import { describeAction } from "@/lib/describe";
import type { ActionRecord } from "@/lib/types";
import { panel, panelTitle, riskStyle, statusStyle } from "./ui";

export function Timeline({ records }: { records: ActionRecord[] }) {
  return (
    <section className={panel}>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className={panelTitle}>Timeline</h2>
        <span className="text-xs text-dim">{records.length} {records.length === 1 ? "action" : "actions"}</span>
      </div>
      {records.length === 0 ? (
        <p className="text-sm text-dim">Every step I take shows up here, newest first.</p>
      ) : (
        <ol className="max-h-96 space-y-2 overflow-auto pr-1">
          {records.map((r) => (
            <li key={r.id} className="frame-card" data-status={r.status}>
              <div className="flex items-center gap-2">
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${riskStyle[r.risk]}`}>{r.risk.replace("_", " ")}</span>
                <span className={`text-xs font-semibold ${statusStyle[r.status]}`}>{r.status.replace("_", " ")}</span>
                <time className="ml-auto text-[11px] tabular-nums text-dim">{new Date(r.createdAt).toLocaleTimeString()}</time>
              </div>
              <p className="mt-1 break-words text-[13px] text-white">{describeAction(r.action, r.target)}</p>
              {r.evidence && <p className="mt-1 break-words text-xs text-teal/80">{r.evidence}</p>}
              {r.error && <p className="mt-1 break-words text-xs text-ember">{r.error}</p>}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}