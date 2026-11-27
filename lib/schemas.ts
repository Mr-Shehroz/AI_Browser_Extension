import { z } from "zod";
import type { BrowserAction, PageObservation } from "./types";

const text = (max: number) => z.string().nullish().transform((v) => (v ?? "").slice(0, max));
const optional = z.string().nullish().transform((v) => (v == null || v === "" ? undefined : v));
const lower = (v: unknown) => (typeof v === "string" ? v.toLowerCase().trim() : v);
const list = (maxLength: number, maxItems: number) =>
  z.array(z.string().transform((s) => s.slice(0, maxLength))).nullish().transform((v) => (v ?? []).slice(0, maxItems));

export const DECISION_ACTIONS = ["navigate", "click", "type", "press", "scroll", "back", "research", "ask_user", "finish"] as const;

// Lenient on purpose: different models format optional fields differently.
export const decisionSchema = z.object({
  thought: text(600),
  action: z.preprocess(lower, z.enum(DECISION_ACTIONS)),
  url: optional,
  ref: optional,
  text: z.string().max(5000).nullish().transform((v) => v ?? undefined),
  key: optional,
  direction: z.preprocess(lower, z.enum(["up", "down"]).nullish()).transform((v) => v ?? undefined),
  message: text(2000),
});
export type Decision = z.infer<typeof decisionSchema>;

export const planSchema = z.object({
  summary: text(800),
  steps: z.array(z.string().transform((s) => s.slice(0, 300))).min(1).max(12),
  risks: list(300, 8),
});

export const chatReplySchema = z.object({
  reply: text(800),
  task: text(500),
});

export const researchSchema = z.object({
  relevant: z.boolean().catch(true),
  summary: text(800),
  key_points: list(300, 10),
  version_info: text(200),
});

export const skillDraftSchema = z.object({
  name: text(80),
  purpose: text(400),
  prerequisites: list(200, 8),
  inputs: list(60, 8),
  steps: z
    .array(z.object({ instruction: text(300), expected: z.string().nullish().transform((v) => (v ? v.slice(0, 200) : undefined)) }))
    .min(1)
    .max(20),
  verification: list(200, 8),
  failure_cases: list(200, 8),
  rollback: text(300),
  confidence: z.preprocess(lower, z.enum(["low", "medium", "high"])).catch("medium"),
});

/** Turns a model decision into a concrete action, or explains why it can't be used. */
export function toBrowserAction(d: Decision, obs: PageObservation): { action: BrowserAction; label?: string } | { error: string } {
  const findEl = (ref?: string) => obs.elements.find((e) => e.ref === ref?.trim());
  switch (d.action) {
    case "navigate": {
      const raw = d.url?.trim();
      if (!raw) return { error: "navigate needs a url." };
      return { action: { type: "navigate", url: raw.includes("://") ? raw : `https://${raw}` } };
    }
    case "click": {
      const el = findEl(d.ref);
      if (!el) return { error: `Unknown ref "${d.ref ?? ""}". Use a ref from the current list.` };
      return { action: { type: "click", ref: el.ref }, label: el.name };
    }
    case "type": {
      const el = findEl(d.ref);
      if (!el) return { error: `Unknown ref "${d.ref ?? ""}". Use a ref from the current list.` };
      if (d.text === undefined) return { error: "type needs text." };
      return { action: { type: "type", ref: el.ref, text: d.text }, label: el.name };
    }
    case "press": {
      const key = d.key?.trim();
      if (!key || !/^[A-Za-z0-9+]{1,30}$/.test(key)) return { error: `Invalid key "${d.key ?? ""}".` };
      return { action: { type: "press", key } };
    }
    case "scroll":
      return { action: { type: "scroll", direction: d.direction ?? "down" } };
    case "back":
      return { action: { type: "back" } };
    default:
      return { error: `"${d.action}" isn't a browser action.` };
  }
}