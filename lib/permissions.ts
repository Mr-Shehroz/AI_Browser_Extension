import { browser } from "wxt/browser";

/** Side panels can't show Chrome's microphone prompt, so a small tab asks once instead. */
export async function openMicPermission(): Promise<void> {
  await browser.tabs.create({ url: browser.runtime.getURL("/permission.html"), active: true });
}