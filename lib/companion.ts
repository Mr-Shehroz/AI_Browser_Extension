import { think } from "./brain";
import { chatSystem } from "./prompts";
import type { ChatMsg } from "./providers";
import { chatReplySchema } from "./schemas";
import type { ConvoMessage, Settings } from "./types";

/** Recent conversation in the shape every provider accepts: starts with the user, roles alternate. */
function toHistory(messages: ConvoMessage[]): ChatMsg[] {
  const out: ChatMsg[] = [];
  for (const m of messages.slice(-14)) {
    if (m.who === "note") continue;
    const role = m.who === "you" ? "user" : "assistant";
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += `\n${m.text}`;
    else out.push({ role, content: m.text });
  }
  while (out.length && out[0]?.role !== "user") out.shift();
  return out;
}

/** Small talk, or spotting that what was said is really a browser task. */
export async function companionReply(settings: Settings, earlier: ConvoMessage[], text: string): Promise<{ reply: string; task: string | null }> {
  const history = toHistory(earlier);
  const last = history[history.length - 1];
  const messages: ChatMsg[] = last?.role === "user"
    ? [...history.slice(0, -1), { role: "user", content: `${last.content}\n${text}` }]
    : [...history, { role: "user", content: text }];
  const r = await think(settings, "chat", {
    system: chatSystem(settings.userName, settings.replyLanguage),
    messages,
    parse: (v) => chatReplySchema.parse(v),
    maxTokens: 800,
  });
  return { reply: r.reply.trim(), task: r.task.trim() || null };
}