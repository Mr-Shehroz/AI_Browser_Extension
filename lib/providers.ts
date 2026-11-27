import { z } from "zod";
import type { ProviderConfig, ProviderKind } from "./types";

export interface ChatMsg { role: "user" | "assistant"; content: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any; // provider responses differ, so they're read defensively

export const PROVIDERS: Record<ProviderKind, { label: string; baseUrl: string; needsKey: boolean; note: string; keyUrl?: string }> = {
  gemini: {
    label: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    needsKey: true,
    keyUrl: "https://aistudio.google.com",
    note: "Free tier with daily limits. Create a key in Google AI Studio; no card needed.",
  },
  openai: {
    label: "OpenAI (ChatGPT models)",
    baseUrl: "https://api.openai.com/v1",
    needsKey: true,
    note: "Pay-as-you-go. A ChatGPT subscription doesn't include API access.",
  },
  anthropic: {
    label: "Anthropic (Claude models)",
    baseUrl: "https://api.anthropic.com/v1",
    needsKey: true,
    note: "Pay-as-you-go. A Claude subscription doesn't include API access.",
  },
  compatible: {
    label: "Other (OpenAI-compatible)",
    baseUrl: "",
    needsKey: true,
    note: "Groq, OpenRouter, DeepSeek, Mistral and others. Enter the provider's API address.",
  },
  ollama: {
    label: "Local Ollama (private)",
    baseUrl: "http://127.0.0.1:11434/v1",
    needsKey: false,
    note: "Runs on this PC: private and free, but slow on small computers.",
  },
};

export class ProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const base = (p: ProviderConfig) => p.baseUrl.trim().replace(/\/+$/, "");
const isLocal = (p: ProviderConfig) => /localhost|127\.0\.0\.1/.test(p.baseUrl);

function explain(p: ProviderConfig, status: number, body: string): string {
  if (status === 403 && isLocal(p)) {
    return "Ollama blocked the extension. Run: setx OLLAMA_ORIGINS \"chrome-extension://*\" then quit and reopen Ollama.";
  }
  if (status === 401 || status === 403) return "The API key was rejected. Check it in Settings.";
  if (status === 404) return "That model wasn't found. Use Load models and pick one from the list.";
  if (status === 429) return "Rate limit or free quota reached. Wait a minute, or switch provider in Settings.";
  if (status >= 500) return "The AI provider is having trouble right now. Try again shortly.";
  return `The AI provider returned an error (${status}): ${body.slice(0, 200)}`;
}

async function request(p: ProviderConfig, url: string, init: RequestInit, timeoutMs = 120_000): Promise<Json> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") throw new Error("The AI provider took too long to answer.");
    throw new Error(isLocal(p) ? "Couldn't reach Ollama. Is it running?" : "Couldn't reach the AI provider. Check your internet connection.");
  }
  const text = await res.text();
  if (!res.ok) throw new ProviderError(res.status, explain(p, res.status, text));
  return text ? JSON.parse(text) : {};
}

const openaiHeaders = (p: ProviderConfig): Record<string, string> => ({
  "Content-Type": "application/json",
  ...(p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {}),
});
const anthropicHeaders = (p: ProviderConfig): Record<string, string> => ({
  "Content-Type": "application/json",
  "x-api-key": p.apiKey,
  "anthropic-version": "2023-06-01",
  "anthropic-dangerous-direct-browser-access": "true",
});
const geminiHeaders = (p: ProviderConfig): Record<string, string> => ({
  "Content-Type": "application/json",
  "x-goog-api-key": p.apiKey,
});

/** Models this key can use, so the user picks a name that really exists. */
export async function listModels(p: ProviderConfig): Promise<string[]> {
  if (p.kind === "gemini") {
    const d = await request(p, `${base(p)}/models?pageSize=1000`, { headers: geminiHeaders(p) });
    return (d.models ?? [])
      .filter((m: Json) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
      .map((m: Json) => String(m.name).replace(/^models\//, ""))
      .sort();
  }
  if (p.kind === "anthropic") {
    const d = await request(p, `${base(p)}/models?limit=100`, { headers: anthropicHeaders(p) });
    return (d.data ?? []).map((m: Json) => String(m.id));
  }
  const d = await request(p, `${base(p)}/models`, { headers: openaiHeaders(p) });
  return (d.data ?? []).map((m: Json) => String(m.id)).sort();
}

/** One request to whichever provider is configured. Returns the reply text. */
async function complete(p: ProviderConfig, system: string, messages: ChatMsg[], maxTokens: number, json: boolean): Promise<string> {
  if (!p.model.trim()) throw new Error("No model is chosen yet. Pick one in Settings.");

  if (p.kind === "gemini") {
    const d = await request(p, `${base(p)}/models/${encodeURIComponent(p.model)}:generateContent`, {
      method: "POST",
      headers: geminiHeaders(p),
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: messages.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
        generationConfig: { temperature: 0.2, ...(json ? { responseMimeType: "application/json" } : {}) },
      }),
    });
    const text = (d.candidates?.[0]?.content?.parts ?? []).map((x: Json) => x.text ?? "").join("");
    if (!text) throw new Error("The model returned an empty reply. The provider may have blocked it.");
    return text;
  }

  if (p.kind === "anthropic") {
    const d = await request(p, `${base(p)}/messages`, {
      method: "POST",
      headers: anthropicHeaders(p),
      body: JSON.stringify({ model: p.model, system, messages, max_tokens: maxTokens }),
    });
    return (d.content ?? []).filter((c: Json) => c.type === "text").map((c: Json) => c.text).join("");
  }


    if (p.kind === "ollama") {
    // Ollama's own API can switch off "thinking", which is very slow on ordinary computers.
    const origin = base(p).replace(/\/v1$/, "");
    const thinking = /^(qwen3|deepseek-r1)/i.test(p.model) ? { think: false } : {};
    const d = await request(
      p,
      `${origin}/api/chat`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: p.model,
          stream: false,
          ...thinking,
          ...(json ? { format: "json" } : {}),
          options: { temperature: 0.2, num_predict: maxTokens },
          messages: [{ role: "system", content: system }, ...messages],
        }),
      },
      300_000,
    );
    return String(d.message?.content ?? "");
  }

  // OpenAI and every OpenAI-compatible provider, including local Ollama.
  const body: Record<string, unknown> = { model: p.model, messages: [{ role: "system", content: system }, ...messages] };
  if (p.kind === "openai") {
    body.max_completion_tokens = maxTokens;
  } else {
    body.max_tokens = maxTokens;
    body.temperature = 0.2;
  }
  if (json) body.response_format = { type: "json_object" };

  const send = () =>
    request(p, `${base(p)}/chat/completions`, { method: "POST", headers: openaiHeaders(p), body: JSON.stringify(body) });
  let d: Json;
  try {
    d = await send();
  } catch (err) {
    // Some compatible providers don't support JSON mode; retry without it.
    if (json && err instanceof ProviderError && err.status === 400) {
      delete body.response_format;
      d = await send();
    } else {
      throw err;
    }
  }
  return String(d.choices?.[0]?.message?.content ?? "");
}

export function extractJson(raw: string): string {
  const t = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  return start >= 0 && end > start ? t.slice(start, end + 1) : t;
}

/** Ask for JSON, check it, and retry once with the error if the reply doesn't fit. */
export async function chatJSON<T>(
  p: ProviderConfig,
  opts: { system: string; messages: ChatMsg[]; parse: (v: unknown) => T; maxTokens?: number },
): Promise<T> {
  let messages = opts.messages;
  let lastError = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const raw = await complete(p, opts.system, messages, opts.maxTokens ?? 2048, true);
    try {
      return opts.parse(JSON.parse(extractJson(raw)));
    } catch (err) {
      lastError = (err instanceof Error ? err.message : String(err)).slice(0, 300);
      messages = [
        ...opts.messages,
        { role: "assistant", content: raw },
        { role: "user", content: `That reply was invalid (${lastError}). Reply again with only valid JSON matching the requested format.` },
      ];
    }
  }
  throw new Error(`The model's reply wasn't in the expected format twice: ${lastError}`);
}

/** A tiny request that proves the key and model work. Returns the time taken in milliseconds. */
export async function testConnection(p: ProviderConfig): Promise<number> {
  const started = performance.now();
  await chatJSON(p, {
    system: "You are a connection test. Reply with JSON only.",
    messages: [{ role: "user", content: 'Reply with exactly this JSON: {"ok": true}' }],
    parse: (v) => z.object({ ok: z.boolean() }).parse(v),
    maxTokens: 512,
  });
  return Math.round(performance.now() - started);
}