import { think } from "./brain";
import { skillDraftSchema } from "./schemas";
import type { SkillDraft } from "./skills";
import { sanitizeDeep, sanitizeText, slugify } from "./text";
import type { GoalRun, ResearchNote, RiskLevel, Settings, Skill } from "./types";

const SKILL_SYSTEM = `You turn a browser task that worked into a reusable procedure (a "skill") that can be followed again later.
Rules:
- Make it generic. Replace values specific to this run (names, emails, search terms, IDs, amounts, typed text) with named inputs written as {{input_name}}, and list each input name in "inputs".
- Describe steps by intent and by the visible labels on the page (button text, menu names, field labels). Never mention element refs like e12; they change every visit.
- Leave out failed attempts, but turn what went wrong into "failure_cases".
- Never include passwords, one-time codes, tokens, cookies or personal data. Signing in is a prerequisite the human handles.
- "verification" lists what should be visible on the page once it has worked.
- "rollback" explains how to undo the result, or says plainly that it can't be undone.
- confidence is "low" if the run needed retries or help, "high" only if it went straight through.
Write everything in English.
Reply with one JSON object and nothing else:
{"name": "...", "purpose": "...", "prerequisites": [], "inputs": [], "steps": [{"instruction": "...", "expected": "..."}], "verification": [], "failure_cases": [], "rollback": "...", "confidence": "medium"}`;

export async function draftSkill(opts: {
  settings: Settings;
  goal: GoalRun;
  research: ResearchNote[];
  domains: string[];
  risk: RiskLevel;
  existing?: Skill;
}): Promise<SkillDraft> {
  const { goal, research, existing } = opts;
  const steps = goal.steps
    .filter((s) => !s.outcome?.startsWith("Not done"))
    .map((s) => `${s.index}. ${s.decision} => ${s.outcome ?? "unknown"}`)
    .join("\n");
  const docs = research.filter((n) => n.relevant).map((n) => `- ${n.title} (${n.url}): ${n.summary}`).join("\n");

  const input = [
    `GOAL: ${goal.goal}`,
    goal.plan ? `PLAN SUMMARY: ${goal.plan.summary}` : "",
    goal.result ? `FINAL REPORT: ${goal.result}` : "",
    `STEPS (in order, with outcomes):\n${steps}`,
    docs ? `DOCUMENTATION READ:\n${docs}` : "",
    existing ? `EXISTING SKILL TO IMPROVE: "${existing.name}"\n${existing.steps.map((s, i) => `${i + 1}. ${s.instruction}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");

    const d = await think(opts.settings, "brain", {
    system: SKILL_SYSTEM,
    messages: [{ role: "user", content: input }],
    parse: (v) => skillDraftSchema.parse(v),
    maxTokens: 2500,
  });

  const content = sanitizeDeep({
    name: d.name,
    purpose: d.purpose,
    prerequisites: d.prerequisites,
    inputs: d.inputs,
    steps: d.steps,
    verification: d.verification,
    failureCases: d.failure_cases,
    rollback: d.rollback,
  });

  return {
    id: existing?.id ?? (slugify(content.name) || `skill-${Date.now()}`),
    ...content,
    domains: opts.domains.slice(0, 5),
    risk: opts.risk,
    confidence: d.confidence,
    sources: research.filter((n) => n.relevant).map((n) => ({ url: n.url, researchId: n.id, accessedAt: n.accessedAt })),
    derivedFromGoal: sanitizeText(goal.goal),
  };
}