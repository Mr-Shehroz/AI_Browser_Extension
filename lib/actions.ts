import { browser } from "wxt/browser";
import {
  clickRef, elementPoint, focusForTyping, observePage, pressKey, scrollPage, typeRef, type PageResult,
} from "./pageScripts";
import { isTrustedKey, trustedClick, trustedInsertText, trustedPress } from "./trustedInput";
import type { BrowserAction, PageObservation } from "./types";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function friendly(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/cannot access|cannot be scripted|chrome:\/\/|extensions gallery|webstore/i.test(message)) {
    return new Error("Chrome doesn't let extensions work on this page. Please do this step yourself.");
  }
  return err instanceof Error ? err : new Error(message);
}

async function inject<A extends unknown[], R>(tabId: number, func: (...args: A) => R, args: A): Promise<R> {
  try {
    const results = await browser.scripting.executeScript({ target: { tabId }, func, args });
    console.debug("[zoya] page script result", results);
    return results[0]?.result as R;
  } catch (err) {
    throw friendly(err);
  }
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
  const raw = await inject(tabId, observePage, []);
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
        const p = await inject(tabId, elementPoint, [action.ref]);
        if (!p?.ok || p.x === undefined || p.y === undefined) throw new Error(p?.error ?? "Couldn't find that element.");
        await trustedClick(tabId, p.x, p.y);
      } else {
        check(await inject(tabId, clickRef, [action.ref]), "The click didn't work.");
      }
      await settle(tabId);
      return;
    }
    case "type": {
      if (trusted) {
        const f = await inject(tabId, focusForTyping, [action.ref]);
        if (!f?.ok) throw new Error(f?.error ?? "Couldn't focus that field.");
        if (f.kind === "text") {
          await trustedInsertText(tabId, action.text);
          return;
        }
      }
      // Dropdowns and anything trusted typing can't handle.
      check(await inject(tabId, typeRef, [action.ref, action.text]), "Typing didn't work.");
      return;
    }
    case "press":
      if (trusted && isTrustedKey(action.key)) await trustedPress(tabId, action.key);
      else check(await inject(tabId, pressKey, [action.key]), "The key press didn't work.");
      await settle(tabId);
      return;
    case "scroll":
      check(await inject(tabId, scrollPage, [action.direction]), "Scrolling didn't work.");
      await sleep(500);
      return;
  }
}