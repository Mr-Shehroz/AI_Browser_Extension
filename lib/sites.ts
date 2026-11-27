import { kvGet, kvUpdate, notifyKnowledgeChanged } from "./kv";
import { domainOf, nowIso } from "./text";
import type { SiteProfile } from "./types";

const KEY = "knowledge.sites";
type SiteMap = Record<string, SiteProfile>;

const blank = (domain: string): SiteProfile => {
  const now = nowIso();
  return { domain, firstSeen: now, lastVisited: now, visits: 0, titles: [], notes: [], pitfalls: [], skillIds: [] };
};

export async function listSites(): Promise<SiteProfile[]> {
  return Object.values(await kvGet<SiteMap>(KEY, {})).sort((a, b) => b.lastVisited.localeCompare(a.lastVisited));
}

export async function getSite(domain: string): Promise<SiteProfile | undefined> {
  return (await kvGet<SiteMap>(KEY, {}))[domain];
}

export async function recordVisit(url: string, title: string): Promise<void> {
  const domain = domainOf(url);
  if (!domain) return;
  await kvUpdate<SiteMap>(KEY, {}, (m) => {
    const p = m[domain] ?? blank(domain);
    const titles = title && !p.titles.includes(title) ? [title, ...p.titles].slice(0, 10) : p.titles;
    return { ...m, [domain]: { ...p, visits: p.visits + 1, lastVisited: nowIso(), titles } };
  });
  notifyKnowledgeChanged();
}

export async function addSiteNote(domain: string, note: string, type: "note" | "pitfall"): Promise<void> {
  const clean = domain.toLowerCase().replace(/^www\./, "").trim();
  await kvUpdate<SiteMap>(KEY, {}, (m) => {
    const p = m[clean] ?? blank(clean);
    return {
      ...m,
      [clean]: type === "note" ? { ...p, notes: [...p.notes, note.trim()] } : { ...p, pitfalls: [...p.pitfalls, note.trim()] },
    };
  });
  notifyKnowledgeChanged();
}

export async function linkSkill(domain: string, skillId: string): Promise<void> {
  await kvUpdate<SiteMap>(KEY, {}, (m) => {
    const p = m[domain] ?? blank(domain);
    return p.skillIds.includes(skillId) ? m : { ...m, [domain]: { ...p, skillIds: [...p.skillIds, skillId] } };
  });
}

/** Combines a profile from another computer with this one. */
export async function mergeSite(p: SiteProfile): Promise<"new" | "merge"> {
  let result: "new" | "merge" = "new";
  await kvUpdate<SiteMap>(KEY, {}, (m) => {
    const local = m[p.domain];
    if (!local) return { ...m, [p.domain]: p };
    result = "merge";
    const uniq = (a: string[], b: string[]) => [...new Set([...a, ...b])];
    return {
      ...m,
      [p.domain]: {
        ...local,
        firstSeen: local.firstSeen < p.firstSeen ? local.firstSeen : p.firstSeen,
        lastVisited: local.lastVisited > p.lastVisited ? local.lastVisited : p.lastVisited,
        visits: Math.max(local.visits, p.visits),
        titles: uniq(local.titles, p.titles).slice(0, 10),
        notes: uniq(local.notes, p.notes),
        pitfalls: uniq(local.pitfalls, p.pitfalls),
        skillIds: uniq(local.skillIds, p.skillIds),
      },
    };
  });
  notifyKnowledgeChanged();
  return result;
}