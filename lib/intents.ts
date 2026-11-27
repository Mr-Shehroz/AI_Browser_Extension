export type Intent = "noise" | "stop" | "pause" | "resume" | "yes" | "no" | "text";

export const normalize = (t: string) =>
  t.toLowerCase().replace(/[.!?,،۔؟"']/g, "").replace(/\s+/g, " ").trim();

const STOP = ["stop", "cancel", "stop it", "stop the agent", "رکو", "روکو", "بند کرو", "بس کرو", "روک دو"];
const PAUSE = ["pause", "wait", "hold on", "take over", "ٹھہرو", "رک جاؤ", "انتظار کرو"];
const RESUME = ["continue", "resume", "carry on", "go on", "جاری رکھو", "چلو جاری رکھو"];
const YES = [
  "yes", "yeah", "yep", "yes please", "go ahead", "do it", "approve", "approved", "okay", "ok", "sure", "yes go ahead",
  "haan", "han", "ji", "ji haan", "theek hai", "ہاں", "جی", "جی ہاں", "ہاں جی", "ٹھیک ہے", "کرو", "کر دو",
];
const NO = ["no", "nope", "dont", "do not", "reject", "no thanks", "nahi", "na", "نہیں", "نہ", "مت کرو", "نہیں کرو"];

/** Things speech recognition often "hears" in silence. */
const NOISE = ["you", "thank you", "thanks", "thank you for watching", "thanks for watching", "bye", "subscribe", "شکریہ", "بہت شکریہ"];

export function classify(text: string): Intent {
  const n = normalize(text);
  if (n.length < 2 || NOISE.includes(n)) return "noise";
  if (STOP.includes(n)) return "stop";
  if (PAUSE.includes(n)) return "pause";
  if (RESUME.includes(n)) return "resume";
  if (YES.includes(n)) return "yes";
  if (NO.includes(n)) return "no";
  return "text";
}