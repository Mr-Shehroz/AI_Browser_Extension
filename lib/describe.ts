import type { BrowserAction } from "./types";

export function describeAction(a: BrowserAction, target?: string): string {
  const what = target ? `"${target}"` : "an element";
  switch (a.type) {
    case "navigate": return `Go to ${a.url}`;
    case "click": return `Click ${what}`;
    case "type": return `Type ${a.secret ? "••••••" : `"${a.text}"`} into ${what}`;
    case "press": return `Press ${a.key}`;
    case "scroll": return `Scroll ${a.direction}`;
    case "back": return "Go back";
  }
}

export function redactAction(a: BrowserAction): BrowserAction {
  return a.type === "type" && a.secret ? { ...a, text: "[REDACTED]" } : a;
}