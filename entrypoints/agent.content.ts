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
 * Zoya's helper inside web pages. It only listens for messages from Zoya's own panel
 * and does nothing else on its own.
 */
export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    // If Zoya loads this script into a tab a second time, don't listen twice.
    const flags = window as unknown as { __zoyaAgentReady?: boolean };
    if (flags.__zoyaAgentReady) return;
    flags.__zoyaAgentReady = true;

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