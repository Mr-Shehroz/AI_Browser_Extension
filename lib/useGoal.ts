import { useRef, useState } from "react";
import { audit } from "./audit";
import { describeAction } from "./describe";
import { buildPlanInput, buildStepInput, formatKnowledge, planSystem, stepSystem } from "./prompts";
import { think } from "./brain";
import { researchUrl } from "./research";
import { decisionSchema, planSchema, toBrowserAction } from "./schemas";
import { getSite, linkSkill, recordVisit } from "./sites";
import { draftSkill } from "./skillDrafter";
import { addSkillVersion, allSkills, findSkills, isDue, latestSkill, revalidateSkill, updateSkill } from "./skills";
import { domainOf, extractDomains, extractUrls } from "./text";
import type { GoalRun, GoalStatus, GoalStep, ResearchNote, RiskLevel, Settings, Skill, SkillRef } from "./types";
import type { AgentApi } from "./useAgent";

const MAX_STEPS = 25;
const MAX_FAILURES = 3;
const MAX_RESEARCH = 5;
const ACTIVE: GoalStatus[] = ["planning", "awaiting_plan_approval", "running", "waiting_user"];
const RISK_ORDER: RiskLevel[] = ["read_only", "reversible", "impactful", "destructive"];

export const isActiveGoal = (g: GoalRun | null | undefined): g is GoalRun => !!g && ACTIVE.includes(g.status);
const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const now = () => new Date().toISOString();
const refOf = (s: Skill): SkillRef => ({ id: s.id, version: s.version, name: s.name, status: s.status });

export interface StartOptions { testSkill?: Skill; inputs?: Record<string, string> }
export interface SkillTestRequest { skill: Skill; inputs: Record<string, string> }

/** Prepare (research + skills) → optional plan → Observe → Think → Act → Verify → learn. */
export function useGoal(agent: AgentApi, settings: Settings) {
  const [goal, setGoal] = useState<GoalRun | null>(null);
  const goalRef = useRef<GoalRun | null>(null);
  const agentRef = useRef(agent);
  agentRef.current = agent;
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const notes = useRef<string[]>([]);
  const looping = useRef(false);
  const resumeRef = useRef<(() => void) | null>(null);

  // What this run knows and did.
  const research = useRef<ResearchNote[]>([]);
  const skillsInUse = useRef<Skill[]>([]);
  const visited = useRef(new Set<string>());
  const lastUrl = useRef("");
  const maxRisk = useRef(0);
  const testSkillRef = useRef<Skill | null>(null);

  function publish() {
    const g = goalRef.current;
    setGoal(g ? { ...g, steps: [...g.steps] } : null);
  }
  function patch(g: GoalRun, p: Partial<GoalRun>) {
    if (goalRef.current !== g) return;
    Object.assign(g, p);
    publish();
  }
  const isLive = (g: GoalRun) => goalRef.current === g && g.status === "running";

  function finish(g: GoalRun, status: GoalStatus, extra: Partial<GoalRun> = {}) {
    if (goalRef.current !== g || !isActiveGoal(g)) return;
    patch(g, { status, paused: false, activity: undefined, finishedAt: now(), ...extra });
    resumeRef.current?.();
    resumeRef.current = null;
    void audit("goal_finished", { goal: g.goal, status, steps: g.steps.length, result: g.result, error: g.error });
    void afterFinish(g);
  }
  const fail = (g: GoalRun, e: unknown) => finish(g, "failed", { error: errMsg(e) });
  const askUser = (g: GoalRun, question: string) => patch(g, { status: "waiting_user", question, activity: undefined });
  const waitWhilePaused = (g: GoalRun) =>
    g.paused ? new Promise<void>((resolve) => { resumeRef.current = resolve; }) : Promise.resolve();

  async function knowledgeFor(url: string): Promise<string> {
    const domain = domainOf(url);
    const site = domain ? await getSite(domain) : undefined;
    return formatKnowledge(research.current, skillsInUse.current, site);
  }

  async function doResearch(g: GoalRun, url: string): Promise<ResearchNote> {
    const note = await researchUrl(url, g.goal, settingsRef.current);
    research.current.push(note);
    patch(g, { researchCount: research.current.length });
    return note;
  }

  /** Read links in the request, and pick saved skills that are still fresh. */
  async function prepare(g: GoalRun, testSkill?: Skill) {
    for (const url of extractUrls(g.goal).slice(0, 3)) {
      if (goalRef.current !== g || g.status !== "planning") return;
      patch(g, { activity: `Reading ${url}` });
      try {
        await doResearch(g, url);
      } catch (e) {
        notes.current.push(`Couldn't read ${url}: ${errMsg(e)}`);
      }
    }

    const candidates = testSkill ? [testSkill] : findSkills(await allSkills(), g.goal, extractDomains(g.goal));
    const used: SkillRef[] = [];
    const skipped: { name: string; reason: string }[] = [];
    for (const c of candidates) {
      if (goalRef.current !== g || g.status !== "planning") return;
      let fresh: Skill | undefined = c;
      if (!testSkill && isDue(c)) {
        patch(g, { activity: `Checking "${c.name}" is still current` });
        try {
          fresh = await revalidateSkill(c.id);
        } catch {
          fresh = await latestSkill(c.id);
        }
      }
      if (!fresh) continue;
      if (!testSkill && (fresh.status === "stale" || isDue(fresh))) {
        skipped.push({ name: fresh.name, reason: fresh.staleReason ?? "Needs a new test before reuse." });
        continue;
      }
      skillsInUse.current.push(fresh);
      used.push(refOf(fresh));
    }
    patch(g, { usedSkills: used, skippedSkills: skipped, activity: undefined });
  }

  /** Records test results, and marks skills that failed in use. */
  async function afterFinish(g: GoalRun) {
    try {
      const today = now().slice(0, 10);
      const test = testSkillRef.current;
      if (test) {
        const s = await latestSkill(test.id);
        if (!s || s.version !== test.version) return;
        if (g.status === "done") {
          await updateSkill(s.id, {
            status: "tested", testedAt: now(), lastValidatedAt: now(), staleReason: undefined, testEvidence: g.result?.slice(0, 600),
          }, "Test passed");
        } else if (g.status === "failed") {
          await updateSkill(
            s.id,
            s.status === "draft"
              ? { testEvidence: `Last test failed on ${today}: ${g.error ?? ""}` }
              : { status: "stale", staleReason: `Failed a test on ${today}: ${g.error ?? ""}` },
            "Test failed",
          );
        }
        return;
      }
      for (const used of skillsInUse.current) {
        const s = await latestSkill(used.id);
        if (!s || s.version !== used.version) continue;
        if (g.status === "done") {
          await updateSkill(s.id, { uses: s.uses + 1, successes: s.successes + 1, lastUsedAt: now() }, "Used successfully");
        } else if (g.status === "failed") {
          await updateSkill(s.id, {
            uses: s.uses + 1, lastUsedAt: now(), status: "stale", staleReason: `A task using this skill failed on ${today}: ${g.error ?? ""}`,
          }, "Marked as needing attention after a failed task");
        }
      }
    } catch {
      // learning is best-effort; never break the main flow
    }
  }

  async function loop() {
    const g = goalRef.current;
    if (!g || looping.current) return;
    looping.current = true;
    let failures = 0;
    try {
      while (isLive(g)) {
        if (g.steps.length >= MAX_STEPS) {
          finish(g, "failed", { error: `I hit the ${MAX_STEPS}-step limit without finishing.` });
          break;
        }
        await waitWhilePaused(g);
        if (!isLive(g)) break;

        // Observe
        const obs = await agentRef.current.observe();
        if (!isLive(g)) break;
        if (!obs) {
          askUser(g, "I can't read this page. Could you open a normal website in my tab, then tell me to carry on?");
          break;
        }
        if (obs.blockers.includes("captcha")) {
          askUser(g, "There's a CAPTCHA on the page. Could you solve it in my tab, then tell me to carry on?");
          break;
        }
        if (obs.url !== lastUrl.current) {
          lastUrl.current = obs.url;
          const domain = domainOf(obs.url);
          if (domain) {
            visited.current.add(domain);
            void recordVisit(obs.url, obs.title);
          }
        }

        // Think
        patch(g, { activity: `Thinking (step ${g.steps.length + 1})` });
        const s = settingsRef.current;
        const knowledge = await knowledgeFor(obs.url);
                const d = await think(s, "brain", {
          system: stepSystem(s.userName, s.replyLanguage),
          messages: [{ role: "user", content: buildStepInput(g.goal, g.plan, g.steps, notes.current, knowledge, obs) }],
          parse: (v) => decisionSchema.parse(v),
        });
        if (!isLive(g)) break;

        const step: GoalStep = { index: g.steps.length + 1, thought: d.thought, decision: d.action };

        if (d.action === "finish") {
          step.outcome = "finished";
          g.steps.push(step);
          finish(g, "done", { result: d.message.trim() || "Done." });
          break;
        }
        if (d.action === "ask_user") {
          step.outcome = "asked you";
          g.steps.push(step);
          askUser(g, d.message.trim() || d.thought);
          break;
        }

        if (d.action === "research") {
          const raw = d.url?.trim() ?? "";
          step.decision = `Read ${raw || "a page"}`;
          g.steps.push(step);
          if (!raw) {
            step.outcome = "Not done: research needs a url";
            failures++;
          } else if (research.current.length >= MAX_RESEARCH) {
            step.outcome = `Not done: I've already read ${MAX_RESEARCH} pages for this task`;
            failures++;
          } else {
            patch(g, { activity: `Reading ${raw}` });
            try {
              const note = await doResearch(g, raw.includes("://") ? raw : `https://${raw}`);
              step.outcome = `researched: ${note.relevant ? note.summary.slice(0, 180) : "not relevant to the task"}`;
              failures = 0;
            } catch (e) {
              step.outcome = `failed: ${errMsg(e)}`;
              failures++;
            }
          }
          publish();
          if (failures >= MAX_FAILURES) {
            finish(g, "failed", { error: "Three steps in a row didn't work." });
            break;
          }
          continue;
        }

        // Act (through the safety layer)
        const built = toBrowserAction(d, obs);
        if ("error" in built) {
          step.decision = `invalid ${d.action}`;
          step.outcome = `Not done: ${built.error}`;
          g.steps.push(step);
          publish();
          if (++failures >= MAX_FAILURES) {
            finish(g, "failed", { error: "The AI kept suggesting steps I couldn't use." });
            break;
          }
          continue;
        }

        step.decision = describeAction(built.action, built.label);
        const previous = g.steps.slice(-2);
        if (built.action.type !== "scroll" && previous.length === 2 && previous.every((p) => p.decision === step.decision)) {
          step.outcome = "Not done: same step three times";
          g.steps.push(step);
          askUser(g, `I keep trying "${step.decision}" and it isn't working. What should I do?`);
          break;
        }

        g.steps.push(step);
        patch(g, { activity: step.decision });
        const rec = await agentRef.current.run(built.action, "zoya");
        if (goalRef.current !== g) break;

        // Verify
        step.outcome = [rec.status.replace("_", " "), rec.evidence, rec.error].filter(Boolean).join(": ");
        if (rec.status === "succeeded") maxRisk.current = Math.max(maxRisk.current, RISK_ORDER.indexOf(rec.risk));
        publish();
        if (!isLive(g)) break;

        if (rec.status === "failed" || rec.status === "blocked") failures++;
        else failures = 0;
        if (failures >= MAX_FAILURES) {
          finish(g, "failed", { error: "Three steps in a row didn't work." });
          break;
        }
      }
    } catch (e) {
      fail(g, e);
    } finally {
      looping.current = false;
    }
  }

  async function makePlan(g: GoalRun) {
    patch(g, { status: "planning", activity: "Making a plan" });
    try {
      const obs = await agentRef.current.observe();
      const s = settingsRef.current;
            const plan = await think(s, "brain", {
        system: planSystem(s.userName, s.replyLanguage),
        messages: [{ role: "user", content: buildPlanInput(g.goal, obs, notes.current, await knowledgeFor(obs?.url ?? "")) }],
        parse: (v) => planSchema.parse(v),
      });
      if (goalRef.current !== g || g.status !== "planning") return;
      patch(g, { status: "awaiting_plan_approval", activity: undefined, plan });
      void audit("goal_plan_proposed", { goal: g.goal, steps: plan.steps.length });
    } catch (e) {
      fail(g, e);
    }
  }

  async function start(text: string, opts: StartOptions = {}) {
    if (isActiveGoal(goalRef.current)) throw new Error("I'm already working on something. Stop it first.");
    if (!agentRef.current.getTab()) {
      const opened = await agentRef.current.openTab();
      if (!opened) throw new Error("I couldn't open my tab.");
    }
    notes.current = [];
    research.current = [];
    skillsInUse.current = [];
    visited.current = new Set();
    lastUrl.current = "";
    maxRisk.current = 0;
    testSkillRef.current = opts.testSkill ?? null;
    if (opts.inputs && Object.keys(opts.inputs).length) {
      notes.current.push(`Inputs for this run: ${Object.entries(opts.inputs).map(([k, v]) => `${k} = ${v}`).join("; ")}`);
    }

    const g: GoalRun = {
      id: crypto.randomUUID(),
      goal: text,
      status: "planning",
      paused: false,
      steps: [],
      startedAt: now(),
      testOfSkill: opts.testSkill ? refOf(opts.testSkill) : undefined,
    };
    goalRef.current = g;
    publish();
    void audit("goal_started", { goal: text, quickMode: settingsRef.current.quickMode, testOfSkill: g.testOfSkill?.id });

    await prepare(g, opts.testSkill);
    if (goalRef.current !== g || g.status !== "planning") return;

    if (settingsRef.current.quickMode && !opts.testSkill) {
      patch(g, { status: "running" });
      void loop();
    } else {
      await makePlan(g);
    }
  }

  async function decidePlan(approved: boolean, feedback?: string) {
    const g = goalRef.current;
    if (!g || g.status !== "awaiting_plan_approval") return;
    const note = feedback?.trim();
    void audit("goal_plan_decision", { approved, feedback: note });
    if (approved) {
      if (note) notes.current.push(`Note on the plan: ${note}`);
      patch(g, { status: "running" });
      void loop();
    } else if (note) {
      notes.current.push(`Change the plan: ${note}`);
      await makePlan(g);
    } else {
      finish(g, "stopped", { result: "Plan cancelled." });
    }
  }

  function reply(text: string) {
    const g = goalRef.current;
    if (!g || g.status !== "waiting_user") return;
    notes.current.push(`Asked "${g.question ?? ""}", the user answered: ${text}`);
    patch(g, { status: "running", question: undefined });
    void loop();
  }

  function pause() {
    const g = goalRef.current;
    if (!g || g.status !== "running" || g.paused) return;
    patch(g, { paused: true, activity: "Paused. The tab is yours." });
    void audit("goal_paused", {});
  }

  function resume() {
    const g = goalRef.current;
    if (!g || !g.paused) return;
    patch(g, { paused: false, activity: undefined });
    resumeRef.current?.();
    resumeRef.current = null;
    void audit("goal_resumed", {});
  }

  function stop() {
    const g = goalRef.current;
    if (!g || !isActiveGoal(g)) return;
    finish(g, "stopped", { result: "Stopped." });
    agentRef.current.cancelPending();
  }

  /** Turns the finished task into a draft skill. */
  async function saveAsSkill(): Promise<Skill> {
    const g = goalRef.current;
    if (!g || g.status !== "done") throw new Error("Finish a task before saving it as a skill.");
    if (g.testOfSkill) throw new Error("This was a test of an existing skill; its result is already recorded.");
    if (g.savedSkill) throw new Error(`Already saved as "${g.savedSkill.name}".`);
    const firstUsed = g.usedSkills?.[0];
    const existing = firstUsed ? await latestSkill(firstUsed.id) : undefined;
    const draft = await draftSkill({
      settings: settingsRef.current,
      goal: g,
      research: research.current,
      domains: [...new Set([...visited.current, ...extractDomains(g.goal)])],
      risk: RISK_ORDER[maxRisk.current] ?? "read_only",
      existing,
    });
    const skill = await addSkillVersion(draft);
    for (const domain of skill.domains) await linkSkill(domain, skill.id);
    Object.assign(g, { savedSkill: refOf(skill) });
    publish();
    return skill;
  }

  return { goal, start, decidePlan, reply, pause, resume, stop, saveAsSkill };
}

export type GoalApi = ReturnType<typeof useGoal>;