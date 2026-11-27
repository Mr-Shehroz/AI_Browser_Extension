import { audit } from "./audit";
import { chatJSON, ProviderError, type ChatMsg } from "./providers";
import type { ProviderConfig, Settings } from "./types";

const usable = (p: ProviderConfig) => !!p.model.trim() && !!p.baseUrl.trim();

/** Fall back only when the provider is down or out of quota, never for a wrong key or model. */
function shouldFallBack(err: unknown): boolean {
  if (err instanceof ProviderError) return err.status === 429 || err.status >= 500;
  return err instanceof Error && /couldn't reach|took too long|empty reply/i.test(err.message);
}

/** Asks the configured brain. If it's down or out of quota, tries the backup and says so. */
export async function think<T>(
  settings: Settings,
  role: "brain" | "chat",
  opts: { system: string; messages: ChatMsg[]; parse: (v: unknown) => T; maxTokens?: number },
): Promise<T> {
  const primary = role === "chat" && !settings.chatSameAsBrain ? settings.chat : settings.brain;
  try {
    return await chatJSON(primary, opts);
  } catch (err) {
    if (!settings.fallbackEnabled || !usable(settings.fallback) || !shouldFallBack(err)) throw err;
    const reason = err instanceof Error ? err.message : String(err);
    window.dispatchEvent(new CustomEvent("zoya-fallback", { detail: { reason } }));
    void audit("brain_fallback", {
      role,
      from: `${primary.kind}:${primary.model}`,
      to: `${settings.fallback.kind}:${settings.fallback.model}`,
      reason,
    });
    return chatJSON(settings.fallback, opts);
  }
}