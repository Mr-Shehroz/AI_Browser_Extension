import type { AgentRequest } from "@/lib/agentProtocol";
import { clickRef, elementPoint, focusForTyping, observePage, pressKey, scrollPage, typeRef } from "@/lib/pageScripts";

function handle(req: AgentRequest): unknown {
  switch (req.op) {
    case "observe":
      return observePage();
    case "click":
      return clickRef(req.ref);
    case "type":
      return typeRef(req.ref, req.text);
    case "press":
      return pressKey(req.key);
    case "scroll":
      return scrollPage(req.direction);
    case "point":
      return elementPoint(req.ref);
    case "focus":
      return focusForTyping(req.ref);
  }
}

/**
 * Zoya's helper inside web pages. It only answers messages from Zoya's own panel
 * and does nothing else on its own.
 * No "already loaded" guard: after Zoya is reloaded, an old copy in the tab stops
 * working, so every fresh copy must listen. If two copies are ever active, the first
 * answer wins, which is harmless.
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    browser.runtime.onMessage.addListener((message: unknown, _sender: unknown, sendResponse: (response: unknown) => void) => {
      const req = message as AgentRequest | undefined;
      if (!req || req.zoya !== true) return undefined;
      try {
        sendResponse(handle(req));
      } catch (e) {
        sendResponse({ ok: false, error: e instanceof Error ? e.message : String(e) });
      }
      return undefined;
    });
  },
});