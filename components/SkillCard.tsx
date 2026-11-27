import { useState } from "react";
import { revalidateSkill, SKILL_MAX_AGE_DAYS, updateSkill } from "@/lib/skills";
import type { Skill, SkillStatus } from "@/lib/types";
import type { SkillTestRequest } from "@/lib/useGoal";
import { btn, btnPrimary, input, panel } from "./ui";

const STATUS_LABEL: Record<SkillStatus, string> = {
  draft: "Draft",
  tested: "Tested",
  approved: "Approved",
  stale: "Needs attention",
  retired: "Retired",
};
const STATUS_STYLE: Record<SkillStatus, string> = {
  draft: "bg-haze/10 text-haze",
  tested: "bg-teal/10 text-teal",
  approved: "bg-teal/20 text-teal",
  stale: "bg-amber/15 text-amber",
  retired: "bg-dim/15 text-dim",
};

function ago(iso?: string): string {
  if (!iso) return "Never";
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  return days <= 0 ? "Today" : days === 1 ? "Yesterday" : `${days} days ago`;
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-white">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-haze/85">{items.map((i, n) => <li key={n}>{i}</li>)}</ul>
    </div>
  );
}

export function SkillCard({ skill, onTest }: { skill: Skill; onTest: (req: SkillTestRequest) => void }) {
  const [testing, setTesting] = useState(false);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const ref = skill.lastValidatedAt ?? skill.testedAt;
  const due = !ref || Date.now() - Date.parse(ref) > SKILL_MAX_AGE_DAYS * 86_400_000;
  const missing = skill.inputs.filter((i) => !inputs[i]?.trim());

  const act = async (work: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await work();
      setMessage(done);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "That didn't work.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className={`${panel} space-y-3`}>
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-2xl font-bold leading-none text-white">{skill.name}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-haze/85">{skill.purpose}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[skill.status]}`}>
          {STATUS_LABEL[skill.status]}
        </span>
      </header>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div><dt className="text-dim">Version</dt><dd className="font-semibold text-white">v{skill.version}</dd></div>
        <div><dt className="text-dim">Last tested</dt><dd className="font-semibold text-white">{ago(skill.testedAt)}</dd></div>
        <div><dt className="text-dim">Freshness check</dt><dd className={`font-semibold ${due ? "text-amber" : "text-white"}`}>{due ? "Due" : ago(ref)}</dd></div>
        <div><dt className="text-dim">Runs</dt><dd className="font-semibold text-white">{skill.successes} of {skill.uses} worked</dd></div>
      </dl>

      {skill.staleReason && <p className="rounded-lg border border-amber/40 bg-amber/5 p-2 text-xs text-amber">{skill.staleReason}</p>}
      {skill.status === "draft" && skill.testEvidence && <p className="text-xs text-ember">{skill.testEvidence}</p>}

      <details>
        <summary className="cursor-pointer text-xs font-semibold text-teal">Steps, checks and sources</summary>
        <div className="mt-2 space-y-2">
          <List title="Inputs" items={skill.inputs} />
          <List title="Before starting" items={skill.prerequisites} />
          <div>
            <p className="text-xs font-semibold text-white">Steps</p>
            <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-haze marker:text-amber">
              {skill.steps.map((s, i) => (
                <li key={i}>{s.instruction}{s.expected && <span className="block text-dim">Expect: {s.expected}</span>}</li>
              ))}
            </ol>
          </div>
          <List title="How to check it worked" items={skill.verification} />
          <List title="Known problems" items={skill.failureCases} />
          {skill.rollback && <p className="text-xs text-haze/85"><span className="font-semibold text-white">Undo: </span>{skill.rollback}</p>}
          <List title="Sources" items={skill.sources.map((s) => `${s.url} (read ${ago(s.accessedAt).toLowerCase()})`)} />
          <p className="text-xs text-dim">Highest risk: {skill.risk.replace("_", " ")}. Confidence: {skill.confidence}. Sites: {skill.domains.join(", ") || "any"}.</p>
        </div>
      </details>

      {skill.status !== "retired" && (testing ? (
        <form
          className="space-y-2 rounded-lg border border-teal/30 bg-teal/5 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!missing.length) onTest({ skill, inputs });
          }}
        >
          {skill.inputs.length === 0 ? (
            <p className="text-xs text-haze/85">This skill needs no inputs.</p>
          ) : (
            skill.inputs.map((name) => (
              <label key={name} className="block text-xs font-semibold text-white">
                {name}
                <input
                  className={`${input} mt-1`}
                  value={inputs[name] ?? ""}
                  onChange={(e) => setInputs((p) => ({ ...p, [name]: e.target.value }))}
                />
              </label>
            ))
          )}
          <p className="text-xs text-dim">The test runs on the Home tab like any task, with a plan and approvals.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className={btn} onClick={() => setTesting(false)}>Cancel</button>
            <button className={btnPrimary} disabled={missing.length > 0}>Run test</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button className={skill.status === "tested" ? btn : btnPrimary} onClick={() => setTesting(true)}>Test</button>
          {skill.status === "tested" && (
            <button
              className={btnPrimary}
              disabled={busy}
              onClick={() => void act(() => updateSkill(skill.id, { status: "approved", approvedAt: new Date().toISOString() }, "Approved by you"), "Approved.")}
            >
              Approve
            </button>
          )}
          <button className={btn} disabled={busy} onClick={() => void act(() => revalidateSkill(skill.id), "Checked.")}>
            {busy ? "Working…" : "Check freshness"}
          </button>
          <button
            className={`${btn} ml-auto`}
            disabled={busy}
            onClick={() => void act(() => updateSkill(skill.id, { status: "retired" }, "Retired by you"), "Retired.")}
          >
            Retire
          </button>
        </div>
      ))}
      {message && <p className="text-xs text-haze">{message}</p>}
    </article>
  );
}