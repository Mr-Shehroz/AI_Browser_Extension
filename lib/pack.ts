import JSZip from "jszip";
import { z } from "zod";
import { audit } from "./audit";
import { getResearch, importResearch, listResearch } from "./research";
import { getSite, listSites, mergeSite } from "./sites";
import { allSkillVersions, importSkillVersion, versionsOf } from "./skills";
import { nowIso, sha256 } from "./text";
import type { ResearchNote, Settings, SiteProfile, Skill } from "./types";

const FORMAT = "nexforce-zoya-knowledge";
const SCHEMA_VERSION = 1;
const MAX_PACK_BYTES = 50 * 1024 * 1024;

const SECRET_PATTERNS = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /\b(sk|rk)-[A-Za-z0-9_-]{20,}/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}/,
  /\bAIza[0-9A-Za-z_-]{35}\b/,
  /"(password|passwd|secret|api_?key|access_?token|refresh_?token|cookie)"\s*:\s*"[^"]{4,}"/i,
];
const ALWAYS_EXCLUDED = ["API keys and settings", "Passwords, cookies and logins", "The activity log"];

const ALLOWED_PATHS = [
  /^global\/preferences\.json$/,
  /^skills\/[a-z0-9-]{1,60}\/v\d{1,4}\.json$/,
  /^sites\/[a-z0-9.-]{1,253}\.json$/,
  /^research\/rs-[\w-]{1,80}\.json$/,
];

const manifestSchema = z.object({
  format: z.literal(FORMAT),
  schemaVersion: z.number().int(),
  exportedAt: z.string(),
  files: z.array(z.object({ path: z.string(), sha256: z.string() })).max(20_000),
});

const strList = z.array(z.string());
const skillSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,60}$/),
  version: z.number().int().min(1).max(9999),
  name: z.string(),
  purpose: z.string(),
  domains: strList,
  prerequisites: strList,
  inputs: strList,
  steps: z.array(z.object({ instruction: z.string(), expected: z.string().optional() })),
  verification: strList,
  failureCases: strList,
  rollback: z.string(),
  risk: z.enum(["read_only", "reversible", "impactful", "destructive", "blocked"]),
  sources: z.array(z.object({ url: z.string(), researchId: z.string().optional(), accessedAt: z.string() })),
  status: z.enum(["draft", "tested", "approved", "stale", "retired"]),
  confidence: z.enum(["low", "medium", "high"]),
  createdAt: z.string(),
  updatedAt: z.string(),
  uses: z.number(),
  successes: z.number(),
  history: z.array(z.object({ version: z.number(), at: z.string(), change: z.string() })),
}).passthrough();
const siteSchema = z.object({
  domain: z.string().regex(/^[a-z0-9.-]{1,253}$/),
  firstSeen: z.string(),
  lastVisited: z.string(),
  visits: z.number(),
  titles: strList,
  notes: strList,
  pitfalls: strList,
  skillIds: strList,
});
const researchNoteSchema = z.object({
  id: z.string().regex(/^rs-[\w-]{1,80}$/),
  url: z.string(),
  title: z.string(),
  accessedAt: z.string(),
  relevant: z.boolean(),
  summary: z.string(),
  keyPoints: strList,
  versionInfo: z.string().optional(),
  text: z.string(),
});

export type SkillAction = "new" | "update" | "same" | "conflict";

export interface PackPreview {
  fileName: string;
  exportedAt: string;
  problems: string[];
  warnings: string[];
  skills: { id: string; name: string; versions: number[]; action: SkillAction }[];
  sites: { domain: string; action: "new" | "merge" }[];
  research: { new: number; existing: number };
}

export interface ParsedPack {
  preview: PackPreview;
  skills: Skill[];
  sites: SiteProfile[];
  research: ResearchNote[];
}

/** Content fingerprint, to tell a real difference from an identical copy. */
const signature = (s: Skill) =>
  JSON.stringify([s.name, s.purpose, s.inputs, s.prerequisites, s.steps, s.verification, s.failureCases, s.rollback]);

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export async function exportPack(settings: Settings): Promise<{ fileName: string; counts: Record<string, number>; excluded: string[] }> {
  const zip = new JSZip();
  const files: { path: string; sha256: string }[] = [];
  const excluded: string[] = [];
  const add = async (path: string, content: string) => {
    if (SECRET_PATTERNS.some((p) => p.test(content))) {
      excluded.push(`${path}: looks like it contains a secret`);
      return;
    }
    zip.file(path, content);
    files.push({ path, sha256: await sha256(content) });
  };

  await add("global/preferences.json", JSON.stringify({
    replyLanguage: settings.replyLanguage,
    approvalMode: settings.approvalMode,
    quickMode: settings.quickMode,
  }, null, 2));

  const skills = await allSkillVersions();
  for (const s of skills) await add(`skills/${s.id}/v${s.version}.json`, JSON.stringify(s, null, 2));
  const sites = await listSites();
  for (const s of sites) await add(`sites/${s.domain}.json`, JSON.stringify(s, null, 2));
  const research = await listResearch();
  for (const n of research) await add(`research/${n.id}.json`, JSON.stringify(n, null, 2));

  const counts = { skills: new Set(skills.map((s) => s.id)).size, skillVersions: skills.length, sites: sites.length, research: research.length };
  const exportedAt = nowIso();
  zip.file("manifest.json", JSON.stringify({
    format: FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    counts,
    files,
    excluded: [...ALWAYS_EXCLUDED, ...excluded],
  }, null, 2));
  zip.file("README.md", [
    "# Zoya knowledge pack",
    "",
    `Exported ${exportedAt}. Skills: ${counts.skills} (${counts.skillVersions} versions). Sites: ${counts.sites}. Research notes: ${counts.research}.`,
    "",
    "Never included: API keys, passwords, cookies, logins and the activity log.",
    "To import: open Zoya → Knowledge → Import a pack, check the preview, then merge.",
    "",
  ].join("\n"));

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
  const fileName = `zoya-knowledge-${exportedAt.slice(0, 10)}.zip`;
  download(blob, fileName);
  void audit("pack_exported", { counts, excludedCount: excluded.length });
  return { fileName, counts, excluded };
}

/** Checks a pack and works out what would change. Nothing is written yet. */
export async function parsePack(file: File): Promise<ParsedPack> {
  if (file.size > MAX_PACK_BYTES) throw new Error("Knowledge packs can be up to 50 MB.");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch {
    throw new Error("That file isn't a valid ZIP.");
  }
  const manifestFile = zip.file("manifest.json");
  if (!manifestFile) throw new Error("This isn't a Zoya knowledge pack (manifest.json is missing).");
  let manifest: z.infer<typeof manifestSchema>;
  try {
    manifest = manifestSchema.parse(JSON.parse(await manifestFile.async("string")));
  } catch {
    throw new Error("This isn't a Zoya knowledge pack (its manifest is unreadable).");
  }
  if (manifest.schemaVersion > SCHEMA_VERSION) throw new Error("This pack is from a newer version of Zoya. Update first.");

  const problems: string[] = [];
  const warnings: string[] = [];
  const skills: Skill[] = [];
  const sites: SiteProfile[] = [];
  const research: ResearchNote[] = [];

  for (const f of manifest.files) {
    if (!ALLOWED_PATHS.some((r) => r.test(f.path))) {
      warnings.push(`Ignored unexpected file: ${f.path}`);
      continue;
    }
    const entry = zip.file(f.path);
    if (!entry) {
      problems.push(`Missing file: ${f.path}`);
      continue;
    }
    const text = await entry.async("string");
    if ((await sha256(text)) !== f.sha256) {
      problems.push(`Damaged or edited file: ${f.path}`);
      continue;
    }
    try {
      const data: unknown = JSON.parse(text);
      if (f.path.startsWith("skills/")) {
        const s = skillSchema.parse(data) as unknown as Skill;
        if (f.path !== `skills/${s.id}/v${s.version}.json`) throw new Error("its name doesn't match its contents");
        skills.push(s);
      } else if (f.path.startsWith("sites/")) {
        const s = siteSchema.parse(data);
        if (f.path !== `sites/${s.domain}.json`) throw new Error("its name doesn't match its contents");
        sites.push(s);
      } else if (f.path.startsWith("research/")) {
        const n = researchNoteSchema.parse(data);
        if (f.path !== `research/${n.id}.json`) throw new Error("its name doesn't match its contents");
        research.push(n);
      }
    } catch (err) {
      warnings.push(`Skipped ${f.path}: ${(err instanceof Error ? err.message : String(err)).slice(0, 150)}`);
    }
  }

  const byId = new Map<string, Skill[]>();
  for (const s of skills) byId.set(s.id, [...(byId.get(s.id) ?? []), s]);
  const skillRows: PackPreview["skills"] = [];
  for (const [id, list] of byId) {
    const local = await versionsOf(id);
    let action: SkillAction = local.length ? "same" : "new";
    for (const s of list) {
      const lv = local.find((v) => v.version === s.version);
      if (!lv) {
        if (action !== "conflict") action = local.length ? "update" : "new";
      } else if (signature(lv) !== signature(s)) {
        action = "conflict";
      }
    }
    const newest = list.reduce((a, b) => (a.version > b.version ? a : b));
    skillRows.push({ id, name: newest.name, versions: list.map((v) => v.version).sort((a, b) => a - b), action });
  }

  const siteRows: PackPreview["sites"] = [];
  for (const s of sites) siteRows.push({ domain: s.domain, action: (await getSite(s.domain)) ? "merge" : "new" });

  let existing = 0;
  for (const n of research) if (await getResearch(n.id)) existing++;

  return {
    preview: {
      fileName: file.name,
      exportedAt: manifest.exportedAt,
      problems,
      warnings,
      skills: skillRows.sort((a, b) => a.name.localeCompare(b.name)),
      sites: siteRows,
      research: { new: research.length - existing, existing },
    },
    skills,
    sites,
    research,
  };
}

export type ConflictMode = "keep_mine" | "add_as_draft";

export async function applyPack(p: ParsedPack, mode: ConflictMode): Promise<string> {
  if (p.preview.problems.length) throw new Error("This pack has problems, so it can't be imported.");
  const today = nowIso();
  let added = 0;
  let drafts = 0;
  let skipped = 0;

  const ordered = [...p.skills].sort((a, b) => a.id.localeCompare(b.id) || a.version - b.version);
  for (const s of ordered) {
    const local = await versionsOf(s.id);
    const same = local.find((v) => v.version === s.version);
    if (same) {
      if (signature(same) === signature(s) || mode === "keep_mine") {
        skipped++;
        continue;
      }
      const latest = local[local.length - 1]!;
      const version = latest.version + 1;
      await importSkillVersion({
        ...s,
        version,
        status: "draft",
        testedAt: undefined,
        approvedAt: undefined,
        lastValidatedAt: undefined,
        importedAt: today,
        updatedAt: today,
        history: [...latest.history, { version, at: today, change: `Imported as a draft (it differed from your v${s.version})` }],
      });
      drafts++;
      continue;
    }
    await importSkillVersion({
      ...s,
      lastValidatedAt: undefined,
      importedAt: today,
      history: [...s.history, { version: s.version, at: today, change: "Imported; re-checked before first use" }],
    });
    added++;
  }

  let sitesNew = 0;
  let sitesMerged = 0;
  for (const s of p.sites) {
    if ((await mergeSite(s)) === "new") sitesNew++;
    else sitesMerged++;
  }
  const researchAdded = await importResearch(p.research);

  const summary = `Imported ${added} skill version(s), ${drafts} as drafts, ${skipped} skipped; ${sitesNew} new and ${sitesMerged} merged site(s); ${researchAdded} research note(s).`;
  void audit("pack_imported", { fileName: p.preview.fileName, mode, added, drafts, skipped, sitesNew, sitesMerged, researchAdded });
  window.dispatchEvent(new Event("zoya-knowledge"));
  return summary;
}