/*
 * These functions run inside the web page, not in the extension.
 * They must be self-contained: no imports and no outside variables.
 */
import type { InteractiveElement } from "./types";

export interface RawObservation {
  url: string;
  title: string;
  text: string;
  elements: InteractiveElement[];
  blockers: string[];
}

export interface PageResult { ok: boolean; error?: string }

export function observePage(): RawObservation {
  const SELECTOR =
    'a[href], button, input:not([type="hidden"]), textarea, select, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [role="checkbox"], [contenteditable="true"]';
  document.querySelectorAll("[data-agent-ref]").forEach((el) => el.removeAttribute("data-agent-ref"));
  const elements: InteractiveElement[] = [];
  let i = 0;
  for (const node of Array.from(document.querySelectorAll<HTMLElement>(SELECTOR))) {
    if (elements.length >= 150) break;
    const r = node.getBoundingClientRect();
    const s = getComputedStyle(node);
    if (r.width === 0 || r.height === 0 || s.visibility === "hidden" || s.display === "none") continue;
    const ref = `e${i++}`;
    node.setAttribute("data-agent-ref", ref);
    const type = node.getAttribute("type") ?? undefined;
    const buttonValue = type === "submit" || type === "button" ? (node as HTMLInputElement).value : "";
    const name =
      node.getAttribute("aria-label") || node.innerText || node.getAttribute("placeholder") ||
      node.getAttribute("title") || buttonValue || node.getAttribute("name") || "";
    elements.push({
      ref,
      role: node.getAttribute("role") || node.tagName.toLowerCase(),
      type,
      name: String(name).replace(/\s+/g, " ").trim().slice(0, 100),
      inViewport: r.top < innerHeight && r.bottom > 0,
    });
  }
  const blockers: string[] = [];
  if (document.querySelector('iframe[src*="recaptcha"], iframe[src*="hcaptcha"], iframe[src*="challenges.cloudflare.com"]')) {
    blockers.push("captcha");
  }
  if (document.querySelector('input[type="password"]')) blockers.push("login_form");
  return {
    url: location.href,
    title: document.title,
    text: (document.body ? document.body.innerText : "").replace(/\n{3,}/g, "\n\n").slice(0, 4000),
    elements,
    blockers,
  };
}

export function clickRef(ref: string): PageResult {
  const el = document.querySelector<HTMLElement>(`[data-agent-ref="${ref}"]`);
  if (!el) return { ok: false, error: "That element isn't on the page anymore. Read the page again." };
  el.scrollIntoView({ block: "center" });
  el.focus({ preventScroll: true });
  el.click();
  return { ok: true };
}

export function typeRef(ref: string, text: string): PageResult {
  const el = document.querySelector<HTMLElement>(`[data-agent-ref="${ref}"]`);
  if (!el) return { ok: false, error: "That element isn't on the page anymore. Read the page again." };
  el.scrollIntoView({ block: "center" });
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    // Use the native setter so sites built with React and similar frameworks notice the change.
    const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(el, text);
    else el.value = text;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  }
  if (el instanceof HTMLSelectElement) {
    const wanted = text.trim().toLowerCase();
    const option = Array.from(el.options).find((o) => o.text.trim().toLowerCase() === wanted || o.value === text);
    if (!option) return { ok: false, error: "There's no option with that text." };
    el.value = option.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  }
  if (el.isContentEditable) {
    document.execCommand("selectAll");
    document.execCommand("insertText", false, text);
    return { ok: true };
  }
  return { ok: false, error: "That element can't be typed into." };
}

export function pressKey(key: string): PageResult {
  const target = (document.activeElement as HTMLElement | null) ?? document.body;
  const init = { key, bubbles: true, cancelable: true };
  const allowed = target.dispatchEvent(new KeyboardEvent("keydown", init));
  target.dispatchEvent(new KeyboardEvent("keyup", init));
  if (key === "Enter" && allowed && target instanceof HTMLInputElement && target.form) {
    target.form.requestSubmit();
  }
  return { ok: true };
}

export function scrollPage(direction: "up" | "down"): PageResult {
  window.scrollBy({ top: (direction === "down" ? 1 : -1) * window.innerHeight * 0.8, behavior: "smooth" });
  return { ok: true };
}



export interface PointResult { ok: boolean; x?: number; y?: number; error?: string }

/** Scrolls an element into view and returns its centre, for a trusted click. */
export function elementPoint(ref: string): PointResult {
  const el = document.querySelector<HTMLElement>(`[data-agent-ref="${ref}"]`);
  if (!el) return { ok: false, error: "That element isn't on the page anymore. Read the page again." };
  el.scrollIntoView({ block: "center" });
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return { ok: false, error: "That element isn't visible." };
  return { ok: true, x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
}

export interface FocusResult { ok: boolean; kind?: "text" | "other"; error?: string }

/** Focuses a field and selects what's in it, so trusted typing replaces the old text. */
export function focusForTyping(ref: string): FocusResult {
  const el = document.querySelector<HTMLElement>(`[data-agent-ref="${ref}"]`);
  if (!el) return { ok: false, error: "That element isn't on the page anymore. Read the page again." };
  el.scrollIntoView({ block: "center" });
  el.focus();
  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
    el.select();
    return { ok: true, kind: "text" };
  }
  if (el.isContentEditable) {
    const range = document.createRange();
    range.selectNodeContents(el);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    return { ok: true, kind: "text" };
  }
  return { ok: true, kind: "other" };
}