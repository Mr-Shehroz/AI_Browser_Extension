import { browser } from "wxt/browser";
import type { AuditEntry } from "./types";

const KEY = "audit";
const MAX_ENTRIES = 3000;
let chain: Promise<void> = Promise.resolve();

/** Append-only activity log. Never pass API keys or secret text here. */
export function audit(event: string, data: Record<string, unknown> = {}): Promise<void> {
  chain = chain.then(async () => {
    const stored = await browser.storage.local.get(KEY);
    const list = (stored[KEY] as AuditEntry[] | undefined) ?? [];
    list.push({ at: new Date().toISOString(), event, data });
    await browser.storage.local.set({ [KEY]: list.slice(-MAX_ENTRIES) });
  }).catch(() => {});
  return chain;
}

export async function readAudit(): Promise<AuditEntry[]> {
  const stored = await browser.storage.local.get(KEY);
  return (stored[KEY] as AuditEntry[] | undefined) ?? [];
}

export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}