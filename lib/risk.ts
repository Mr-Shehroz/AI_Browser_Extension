import type { ApprovalMode, BrowserAction, InteractiveElement, RiskLevel } from "./types";

const DESTRUCTIVE = /\b(delete|remove|erase|destroy|reset|wipe|purge|terminate|deactivate|revoke|uninstall|discard|overwrite|close account|cancel subscription|empty trash)\b/i;
const IMPACTFUL = /\b(submit|send|publish|post|pay|buy|purchase|checkout|place order|order|confirm|save|update|apply|deploy|invite|transfer|subscribe|upgrade|sign up|register|share|approve|merge|go live|schedule)\b/i;
const SAFE_UI = /\b(next|previous|back|menu|open|show|expand|collapse|view|details|more|search|filter|sort|tab|close|dismiss|help|docs|learn more)\b/i;

export interface RiskAssessment { risk: RiskLevel; reason: string }

export function assessRisk(action: BrowserAction, el?: InteractiveElement): RiskAssessment {
  switch (action.type) {
    case "scroll":
    case "back":
      return { risk: "read_only", reason: "Doesn't change anything on the site." };

    case "navigate": {
      let url: URL;
      try {
        url = new URL(action.url);
      } catch {
        return { risk: "blocked", reason: "That isn't a valid web address." };
      }
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return { risk: "blocked", reason: "Only http and https pages can be opened." };
      }
      return { risk: "read_only", reason: "Opens a page." };
    }

    case "type":
      if (el?.type === "password") {
        return { risk: "blocked", reason: "Zoya never types into password fields. Please enter it yourself." };
      }
      return { risk: "reversible", reason: "Fills a field. Nothing is saved until it's submitted." };

    case "press":
      return action.key.toLowerCase() === "enter"
        ? { risk: "impactful", reason: "Enter may submit a form." }
        : { risk: "reversible", reason: "Keyboard input." };

    case "click": {
      if (!el) return { risk: "impactful", reason: "Unknown element, so it's treated as impactful." };
      const label = `${el.name} ${el.type ?? ""}`;
      if (DESTRUCTIVE.test(label)) return { risk: "destructive", reason: `"${el.name}" looks like it can't be undone.` };
      if (el.type === "submit" || IMPACTFUL.test(label)) return { risk: "impactful", reason: `"${el.name}" may submit, send or save something.` };
      if (el.role === "a" || el.role === "link") return { risk: "reversible", reason: "A link (just navigation)." };
      if (SAFE_UI.test(label)) return { risk: "reversible", reason: "A page control." };
      return { risk: "impactful", reason: "An unrecognised button that might change something." };
    }
  }
}

export function requiresApproval(risk: RiskLevel, mode: ApprovalMode): boolean {
  if (risk === "impactful" || risk === "destructive") return true;
  return mode === "strict" && risk === "reversible";
}