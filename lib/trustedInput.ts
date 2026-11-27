import { browser } from "wxt/browser";

/**
 * Trusted input: clicks, typing and key presses through Chrome's DevTools protocol,
 * which websites can't tell apart from a real person. Chrome shows a "debugging" bar while it's on.
 */
const attached = new Set<number>();
let watching = false;

function watch() {
  if (watching) return;
  watching = true;
  // If the user clicks "Cancel" on Chrome's bar, or the tab closes, forget the attachment.
  browser.debugger.onDetach.addListener((source) => {
    if (source.tabId !== undefined) attached.delete(source.tabId);
  });
  // Let go when the side panel closes.
  window.addEventListener("pagehide", () => void detachAll());
}

async function attach(tabId: number): Promise<void> {
  watch();
  if (attached.has(tabId)) return;
  try {
    await browser.debugger.attach({ tabId }, "1.3");
    attached.add(tabId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/already attached/i.test(message)) {
      attached.add(tabId);
      return;
    }
    throw new Error(`Trusted input couldn't start: ${message}`);
  }
}

export async function detachAll(): Promise<void> {
  for (const tabId of [...attached]) {
    await browser.debugger.detach({ tabId }).catch(() => {});
  }
  attached.clear();
}

const send = (tabId: number, method: string, params: Record<string, unknown>) =>
  browser.debugger.sendCommand({ tabId }, method, params);

export async function trustedClick(tabId: number, x: number, y: number): Promise<void> {
  await attach(tabId);
  const press = { x, y, button: "left", clickCount: 1 };
  await send(tabId, "Input.dispatchMouseEvent", { type: "mouseMoved", x, y });
  await send(tabId, "Input.dispatchMouseEvent", { type: "mousePressed", ...press });
  await send(tabId, "Input.dispatchMouseEvent", { type: "mouseReleased", ...press });
}

export async function trustedInsertText(tabId: number, text: string): Promise<void> {
  await attach(tabId);
  await send(tabId, "Input.insertText", { text });
}

const KEYS: Record<string, { code: string; keyCode: number; text?: string }> = {
  Enter: { code: "Enter", keyCode: 13, text: "\r" },
  Tab: { code: "Tab", keyCode: 9 },
  Escape: { code: "Escape", keyCode: 27 },
  Backspace: { code: "Backspace", keyCode: 8 },
  Delete: { code: "Delete", keyCode: 46 },
  ArrowUp: { code: "ArrowUp", keyCode: 38 },
  ArrowDown: { code: "ArrowDown", keyCode: 40 },
  ArrowLeft: { code: "ArrowLeft", keyCode: 37 },
  ArrowRight: { code: "ArrowRight", keyCode: 39 },
  Home: { code: "Home", keyCode: 36 },
  End: { code: "End", keyCode: 35 },
  PageUp: { code: "PageUp", keyCode: 33 },
  PageDown: { code: "PageDown", keyCode: 34 },
};

export const isTrustedKey = (key: string) => key in KEYS;

export async function trustedPress(tabId: number, key: string): Promise<void> {
  const k = KEYS[key];
  if (!k) throw new Error(`Trusted input doesn't support the key "${key}".`);
  await attach(tabId);
  const common = { key, code: k.code, windowsVirtualKeyCode: k.keyCode, nativeVirtualKeyCode: k.keyCode };
  await send(tabId, "Input.dispatchKeyEvent", k.text
    ? { type: "keyDown", ...common, text: k.text, unmodifiedText: k.text }
    : { type: "rawKeyDown", ...common });
  await send(tabId, "Input.dispatchKeyEvent", { type: "keyUp", ...common });
}