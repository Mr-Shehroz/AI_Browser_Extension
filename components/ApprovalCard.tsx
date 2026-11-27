import { useState } from "react";
import { describeAction } from "@/lib/describe";
import type { ActionRecord } from "@/lib/types";
import { btn, btnDanger, btnPrimary, riskStyle } from "./ui";

export function ApprovalCard({ record, onDecide }: { record: ActionRecord; onDecide: (approved: boolean) => void }) {
  const [ack, setAck] = useState(false);
  const destructive = record.risk === "destructive";

  return (
    <section
      role="alertdialog"
      aria-labelledby="approval-title"
      className={`space-y-3 rounded-xl border p-4 ${destructive ? "border-ember/60 bg-ember/5" : "border-amber/55 bg-amber/5"}`}
    >
      <span className={`rounded px-2 py-0.5 text-xs font-semibold ${riskStyle[record.risk]}`}>{record.risk.replace("_", " ")}</span>
      <h2 id="approval-title" className="font-display text-3xl font-black leading-none text-white">
        {destructive ? "This can't easily be undone" : "Is this okay?"}
      </h2>
      <p className="break-words rounded-lg bg-night/70 px-3 py-2 text-sm text-white">{describeAction(record.action, record.target)}</p>
      <p className="text-sm leading-relaxed text-haze">{record.reason}</p>
      {destructive && (
        <label className="flex items-start gap-2 text-sm text-ember">
          <input type="checkbox" className="mt-1 accent-[var(--color-ember)]" checked={ack} onChange={(e) => setAck(e.target.checked)} />
          I understand this may not be reversible, and I want to go ahead.
        </label>
      )}
      <div className="flex justify-end gap-2">
        <button className={btn} onClick={() => onDecide(false)}>No</button>
        <button className={destructive ? btnDanger : btnPrimary} disabled={destructive && !ack} onClick={() => onDecide(true)}>
          Yes, go ahead
        </button>
      </div>
    </section>
  );
}