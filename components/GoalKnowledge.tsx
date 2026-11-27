import { useState } from "react";
import type { GoalApi } from "@/lib/useGoal";
import { btnPrimary } from "./ui";

export function GoalKnowledge({ goalApi, onOpenKnowledge }: { goalApi: GoalApi; onOpenKnowledge: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const g = goalApi.goal;
  if (!g) return null;

  const used = g.usedSkills ?? [];
  const skipped = g.skippedSkills ?? [];
  const canSave = g.status === "done" && !g.savedSkill && !g.testOfSkill;
  if (!used.length && !skipped.length && !g.researchCount && !canSave && !g.savedSkill && !g.testOfSkill) return null;

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await goalApi.saveAsSkill();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save the skill.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-2 rounded-xl border border-white/5 bg-night/50 p-3 text-xs">
      {g.testOfSkill && <p className="text-teal">Testing the skill “{g.testOfSkill.name}” v{g.testOfSkill.version}</p>}
      {used.length > 0 && (
        <p className="text-haze/85">
          <span className="font-semibold text-teal">Using saved skills: </span>
          {used.map((s) => `${s.name} v${s.version}`).join(", ")}
        </p>
      )}
      {skipped.length > 0 && (
        <div>
          <p className="font-semibold text-amber">Skipped skills that need attention</p>
          <ul className="list-disc pl-5 text-haze/85">{skipped.map((s) => <li key={s.name}>{s.name}: {s.reason}</li>)}</ul>
        </div>
      )}
      {!!g.researchCount && (
        <p className="text-dim">
          Read {g.researchCount} help {g.researchCount === 1 ? "page" : "pages"} for this.{" "}
          <button className="text-teal underline-offset-2 hover:underline" onClick={onOpenKnowledge}>See research</button>
        </p>
      )}
      {canSave && (
        <div className="flex items-center gap-3 rounded-lg border border-teal/30 bg-teal/5 p-2">
          <p className="flex-1 leading-relaxed text-haze/85">That worked. Save it as a skill so I can do it faster next time?</p>
          <button className={btnPrimary} disabled={saving} onClick={save}>{saving ? "Saving…" : "Save as skill"}</button>
        </div>
      )}
      {g.savedSkill && (
        <p className="text-teal">
          Saved as the draft skill “{g.savedSkill.name}”.{" "}
          <button className="underline underline-offset-2" onClick={onOpenKnowledge}>Test it in Knowledge</button>
        </p>
      )}
      {error && <p className="text-ember" role="alert">{error}</p>}
    </section>
  );
}