import { browser } from "wxt/browser";
import type { AgentRequest } from "./agentProtocol";
import type { FocusResult, PageResult, PointResult } from "./pageScripts";
import { isTrustedKey, trustedClick, trustedInsertText, trustedPress } from "./trustedInput";
import type { BrowserAction, PageObservation } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CONTENT_SCRIPT = "content-scripts/agent.js";

function friendly(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/cannot access|cannot be scripted|chrome:\/\/|edge:\/\/|extensions gallery|webstore/i.test(message)) {
    return new Error("Chrome doesn't let extensions work on this page. Please do this step yourself.");
  }
  return err instanceof Error ? err : new Error(message);
}

const notLoaded = (err: unknown) =>
  /receiving end does not exist|could not establish connection/i.test(err instanceof Error ? err.message : String(err));

/**
 * Sends a request to Zoya's content script in the tab. If the tab was opened before Zoya
 * was installed or reloaded, the script is loaded into it first, then the request is retried.
 */
async function ask<T>(tabId: number, req: AgentRequest): Promise<T> {
  try {
    return (await browser.tabs.sendMessage(tabId, req)) as T;
  } catch (err) {
    if (!notLoaded(err)) throw friendly(err);
  }
  // The helper isn't in this tab yet (for example, the tab was open before Zoya was reloaded): load it.
  try {
    await browser.scripting.executeScript({ target: { tabId }, files: [CONTENT_SCRIPT as "/background.js"] });
  } catch (injectErr) {
    throw friendly(injectErr);
  }
  // Give it a moment to start listening, then try again a few times.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 8; attempt++) {
    await sleep(250);
    try {
      return (await browser.tabs.sendMessage(tabId, req)) as T;
    } catch (retryErr) {
      lastErr = retryErr;
      if (!notLoaded(retryErr)) break;
    }
  }
  throw friendly(lastErr);
}

export function waitForLoad(tabId: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      browser.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id: number, info: { status?: string }) => {
      if (id === tabId && info.status === "complete") finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    browser.tabs.onUpdated.addListener(listener);
  });
}

async function settle(tabId: number): Promise<void> {
  await sleep(600);
  const tab = await browser.tabs.get(tabId);
  if (tab.status === "loading") await waitForLoad(tabId, 15_000);
  await sleep(300);
}

function check(result: PageResult | undefined, fallback: string): void {
  if (!result?.ok) throw new Error(result?.error ?? fallback);
}

export async function observeTab(tabId: number): Promise<PageObservation> {
  const raw = await ask<string | undefined>(tabId, { zoya: true, op: "observe" });
  if (typeof raw !== "string") throw new Error("Couldn't read this page (no answer from the page).");
  const parsed = JSON.parse(raw) as
    | { ok: true; url: string; title: string; text: string; elements: PageObservation["elements"]; blockers: string[] }
    | { ok: false; error: string };
  if (!parsed.ok) throw new Error(`Couldn't read this page: ${parsed.error}`);
  return {
    url: parsed.url,
    title: parsed.title,
    text: parsed.text,
    elements: parsed.elements.map((e) => ({ ...e, type: e.type || undefined })),
    blockers: parsed.blockers,
    observedAt: new Date().toISOString(),
  };
}

/** Runs one action. With `trusted`, clicks, typing and keys go through Chrome's own input system. */
export async function executeAction(tabId: number, action: BrowserAction, trusted = false): Promise<void> {
  switch (action.type) {
    case "navigate": {
      const loaded = waitForLoad(tabId, 30_000);
      await browser.tabs.update(tabId, { url: action.url });
      await loaded;
      await sleep(300);
      return;
    }
    case "back": {
      const loaded = waitForLoad(tabId, 15_000);
      await browser.tabs.goBack(tabId);
      await loaded;
      return;
    }
    case "click": {
      if (trusted) {
        const p = await ask<PointResult>(tabId, { zoya: true, op: "point", ref: action.ref });
        if (!p?.ok || p.x === undefined || p.y === undefined) throw new Error(p?.error ?? "Couldn't find that element.");
        await trustedClick(tabId, p.x, p.y);
      } else {
        check(await ask<PageResult>(tabId, { zoya: true, op: "click", ref: action.ref }), "The click didn't work.");
      }
      await settle(tabId);
      return;
    }
    case "type": {
      if (trusted) {
        const f = await ask<FocusResult>(tabId, { zoya: true, op: "focus", ref: action.ref });
        if (!f?.ok) throw new Error(f?.error ?? "Couldn't focus that field.");
        if (f.kind === "text") {
          await trustedInsertText(tabId, action.text);
          return;
        }
      }
      check(await ask<PageResult>(tabId, { zoya: true, op: "type", ref: action.ref, text: action.text }), "Typing didn't work.");
      return;
    }
    case "press":
      if (trusted && isTrustedKey(action.key)) await trustedPress(tabId, action.key);
      else check(await ask<PageResult>(tabId, { zoya: true, op: "press", key: action.key }), "The key press didn't work.");
      await settle(tabId);
      return;
    case "scroll":
      check(await ask<PageResult>(tabId, { zoya: true, op: "scroll", direction: action.direction }), "Scrolling didn't work.");
      await sleep(500);
      return;
  }
}