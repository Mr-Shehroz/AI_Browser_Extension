export const slugify = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

export const nowIso = () => new Date().toISOString();
export const shortId = () => crypto.randomUUID().slice(0, 8);

export function domainOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

export function extractUrls(text: string): string[] {
  const found = text.match(/https?:\/\/[^\s"'<>)]+/gi) ?? [];
  return [...new Set(found.map((u) => u.replace(/[.,;:!?]+$/, "")))];
}

export function extractDomains(text: string): string[] {
  const out = new Set<string>();
  for (const u of extractUrls(text)) {
    const d = domainOf(u);
    if (d) out.add(d);
  }
  for (const m of text.matchAll(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})\b/gi)) {
    const d = m[1]?.toLowerCase().replace(/^www\./, "");
    if (d) out.add(d);
  }
  return [...out];
}

export function normalizeText(t: string): string {
  return t
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

/** Share of identical lines (0 to 1). Tolerates small dynamic changes better than a hash. */
export function similarity(a: string, b: string): number {
  const A = new Set(a.split("\n"));
  const B = new Set(b.split("\n"));
  if (A.size === 0 && B.size === 0) return 1;
  let same = 0;
  for (const line of A) if (B.has(line)) same++;
  return same / (A.size + B.size - same);
}

export async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const LONG_DIGITS = /\b(?:\d[ -]?){8,}\b/g;
const SENSITIVE_PARAM = /^(token|access_token|id_token|refresh_token|key|api_key|apikey|auth|code|session|sid|sig|signature|password|secret|otp)$/i;

export function sanitizeUrl(raw: string): string {
  try {
    const u = new URL(raw);
    u.username = "";
    u.password = "";
    for (const k of [...u.searchParams.keys()]) {
      if (SENSITIVE_PARAM.test(k)) u.searchParams.set(k, "REDACTED");
    }
    if (/token|code=/i.test(u.hash)) u.hash = "";
    return u.toString();
  } catch {
    return raw;
  }
}

export function sanitizeText(s: string): string {
  return s
    .replace(/https?:\/\/[^\s"')]+/g, (m) => sanitizeUrl(m))
    .replace(EMAIL, "{{email}}")
    .replace(LONG_DIGITS, "{{number}}");
}

/** Only for model-written content, never for timestamps or IDs. */
export function sanitizeDeep<T>(v: T): T {
  if (typeof v === "string") return sanitizeText(v) as T;
  if (Array.isArray(v)) return v.map((x) => sanitizeDeep(x)) as T;
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, sanitizeDeep(x)])) as T;
  }
  return v;
}