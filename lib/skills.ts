import { audit } from "./audit";
import { kvGet, kvUpdate, notifyKnowledgeChanged } from "./kv";
import { checkChanged, getResearch } from "./research";
import { nowIso } from "./text";
import type { Skill } from "./types";

const KEY = "knowledge.skills";
export const SKILL_MAX_AGE_DAYS = 30;
type SkillMap = Record<string, Skill[]>;

export type SkillDraft = Pick<
  Skill,
  | "id" | "name" | "purpose" | "domains" | "prerequisites" | "inputs" | "steps" | "verification"
  | "failureCases" | "rollback" | "risk" | "sources" | "confidence" | "derivedFromGoal"
>;

const latestOf = (list: Skill[] | undefined) => list?.[list.length - 1];

export async function allSkills(): Promise<Skill[]> {
  const m = await kvGet<SkillMap>(KEY, {});
  return Object.values(m)
    .map(latestOf)
    .filter((s): s is Skill => !!s)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Every version of every skill (for export). */
export async function allSkillVersions(): Promise<Skill[]> {
  return Object.values(await kvGet<SkillMap>(KEY, {})).flat();
}

export async function latestSkill(id: string): Promise<Skill | undefined> {
  return latestOf((await kvGet<SkillMap>(KEY, {}))[id]);
}

export async function versionsOf(id: string): Promise<Skill[]> {
  return [...((await kvGet<SkillMap>(KEY, {}))[id] ?? [])];
}

/** Any change to a skill's content is a new version, starting as a draft. */
export async function addSkillVersion(draft: SkillDraft): Promise<Skill> {
  const box: { skill?: Skill } = {};
  await kvUpdate<SkillMap>(KEY, {}, (m) => {
    const prev = latestOf(m[draft.id]);
    const now = nowIso();
    const version = prev ? prev.version + 1 : 1;
    box.skill = {
      ...draft,
      version,
      status: "draft",
      createdAt: prev?.createdAt ?? now,
      updatedAt: now,
      uses: 0,
      successes: 0,
      history: [
        ...(prev?.history ?? []),
        { version, at: now, change: prev ? `New draft replacing v${prev.version}` : "Drafted from a finished task" },
      ],
    };
    return { ...m, [draft.id]: [...(m[draft.id] ?? []), box.skill] };
  });
  void audit("skill_drafted", { id: draft.id, version: box.skill!.version });
  notifyKnowledgeChanged();
  return box.skill!;
}

/** Status and bookkeeping changes update the current version, with a history entry. */
export async function updateSkill(id: string, patch: Partial<Skill>, change: string): Promise<Skill> {
  const box: { skill?: Skill } = {};
  await kvUpdate<SkillMap>(KEY, {}, (m) => {
    const list = m[id];
    const current = latestOf(list);
    if (!list || !current) return m;
    const now = nowIso();
    box.skill = { ...current, ...patch, updatedAt: now, history: [...current.history, { version: current.version, at: now, change }] };
    return { ...m, [id]: [...list.slice(0, -1), box.skill] };
  });
  if (!box.skill) throw new Error("Skill not found.");
  void audit("skill_updated", { id, version: box.skill.version, change, status: box.skill.status });
  notifyKnowledgeChanged();
  return box.skill;
}

/** Stores a whole version as-is (knowledge-pack import). */
export async function importSkillVersion(s: Skill): Promise<void> {
  await kvUpdate<SkillMap>(KEY, {}, (m) => {
    const list = (m[s.id] ?? []).filter((v) => v.version !== s.version);
    list.push(s);
    list.sort((a, b) => a.version - b.version);
    return { ...m, [s.id]: list };
  });
}

/** Due when never checked, older than the window, or imported and not yet re-checked here. */
export function isDue(s: Skill): boolean {
  if (s.importedAt && (!s.lastValidatedAt || s.lastValidatedAt < s.importedAt)) return true;
  const ref = s.lastValidatedAt ?? s.testedAt;
  if (!ref) return true;
  return Date.now() - Date.parse(ref) > SKILL_MAX_AGE_DAYS * 86_400_000;
}

const STOP = new Set(["the", "and", "for", "with", "from", "into", "this", "that", "find", "open", "get", "use", "how", "what", "your", "page", "site"]);
const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2 && !STOP.has(t)));

/** Picks up to `limit` tested or approved skills that match the request. */
export function findSkills(list: Skill[], query: string, domains: string[], limit = 3): Skill[] {
  const q = tokens(query);
  return list
    .filter((s) => s.status !== "retired" && s.status !== "draft")
    .map((s) => {
      const hay = tokens(`${s.name} ${s.purpose} ${s.domains.join(" ")}`);
      let score = 0;
      for (const t of q) if (hay.has(t)) score++;
      if (s.domains.some((d) => domains.includes(d))) score += 3;
      return { s, score };
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

/** Freshness check: re-reads the skill's documentation and compares it with the saved copies. */
export async function revalidateSkill(id: string): Promise<Skill> {
  const s = await latestSkill(id);
  if (!s) throw new Error("Skill not found.");
  if (s.status === "retired") throw new Error("This skill is retired.");

  const sources = s.sources.filter((x) => x.researchId);
  if (!sources.length) {
    if (!isDue(s)) return s;
    return updateSkill(id, {
      status: "stale",
      staleReason: `There's no documentation to compare, and the last test is over ${SKILL_MAX_AGE_DAYS} days old. Test it again.`,
    }, "Marked as needing attention: too old without sources");
  }

  const changed: string[] = [];
  for (const src of sources) {
    const note = await getResearch(src.researchId!);
    if (!note) {
      changed.push(`${src.url} (saved copy missing)`);
      continue;
    }
    try {
      const r = await checkChanged(note);
      if (r.changed) changed.push(`${note.url} (${Math.round(r.similarity * 100)}% the same)`);
    } catch {
      changed.push(`${src.url} (couldn't re-read it)`);
    }
  }
  return changed.length
    ? updateSkill(id, { status: "stale", staleReason: `Documentation changed: ${changed.join("; ")}` }, "Marked as needing attention after a freshness check")
    : updateSkill(id, { lastValidatedAt: nowIso(), staleReason: undefined }, "Freshness check passed");
}