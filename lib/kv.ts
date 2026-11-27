import { browser } from "wxt/browser";

let chain: Promise<unknown> = Promise.resolve();

export async function kvGet<T>(key: string, fallback: T): Promise<T> {
  const stored = await browser.storage.local.get(key);
  return (stored[key] as T | undefined) ?? fallback;
}

/** Read-modify-write, one at a time, so updates never overwrite each other. */
export function kvUpdate<T>(key: string, fallback: T, change: (current: T) => T): Promise<T> {
  const job = chain.then(async () => {
    const next = change(await kvGet(key, fallback));
    await browser.storage.local.set({ [key]: next });
    return next;
  });
  chain = job.catch(() => {});
  return job;
}

/** Tells open views (like the Knowledge tab) to reload. */
export function notifyKnowledgeChanged(): void {
  window.dispatchEvent(new Event("zoya-knowledge"));
}