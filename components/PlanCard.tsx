import { useState } from "react";
import type { GoalPlan } from "@/lib/types";
import { btn, btnPrimary, input } from "./ui";

interface Props {
  plan: GoalPlan;
  onDecide: (approved: boolean, feedback?: string) => void;
}

export function PlanCard({ plan, onDecide }: Props) {
  const [feedback, setFeedback] = useState("");

  return (
    <div className="space-y-3 rounded-xl border border-amber/45 bg-amber/5 p-3 text-sm">
      <p dir="auto" className="font-display text-xl font-bold leading-tight text-white">{plan.summary}</p>
      <ol dir="auto" className="list-decimal space-y-1 pl-5 leading-relaxed text-haze marker:text-amber">
        {plan.steps.map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      {plan.risks.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber">I'll ask you before</p>
          <ul dir="auto" className="mt-1 list-disc pl-5 text-xs text-haze/80">{plan.risks.map((r, i) => <li key={i}>{r}</li>)}</ul>
        </div>
      )}
      <input className={input} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Anything to change?" dir="auto" />
      <div className="flex flex-wrap justify-end gap-2">
        <button className={btn} onClick={() => onDecide(false)}>Cancel</button>
        <button className={btn} disabled={!feedback.trim()} onClick={() => onDecide(false, feedback)}>Change plan</button>
        <button className={btnPrimary} onClick={() => onDecide(true, feedback || undefined)}>Start</button>
      </div>
    </div>
  );
}