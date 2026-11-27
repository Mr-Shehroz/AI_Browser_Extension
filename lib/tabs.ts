import { browser, type Browser } from "wxt/browser";

const SESSION_KEY = "zoyaTabId";
const START_URL = "https://www.google.com";

/** Zoya's own tab, if it's still open. */
export async function getZoyaTab(): Promise<Browser.tabs.Tab | null> {
  const stored = await browser.storage.session.get(SESSION_KEY);
  const id = stored[SESSION_KEY];
  if (typeof id !== "number") return null;
  try {
    return await browser.tabs.get(id);
  } catch {
    return null;
  }
}

/** Opens Zoya's tab in a tab group called "Zoya", so your other tabs stay yours. */
export async function ensureZoyaTab(): Promise<Browser.tabs.Tab> {
  const existing = await getZoyaTab();
  if (existing) return existing;
  const tab = await browser.tabs.create({ url: START_URL, active: true });
  if (tab.id === undefined) throw new Error("Chrome couldn't open a tab.");
  const groupId = await browser.tabs.group({ tabIds: tab.id });
  await browser.tabGroups.update(groupId, { title: "Zoya", color: "cyan" });
  await browser.storage.session.set({ [SESSION_KEY]: tab.id });
  return tab;
}