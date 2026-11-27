import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceSettings } from "./types";

const FEMALE_HINTS = [
  "female", "woman", "zira", "aria", "jenny", "sonia", "libby", "hazel", "susan", "heera", "uzma",
  "samantha", "karen", "tessa", "google us english", "google uk english female",
];
const isUrdu = (t: string) => /[\u0600-\u06FF]/.test(t);
const hasSpeech = () => typeof window !== "undefined" && "speechSynthesis" in window;

/** Chrome cuts off long utterances, so speak sentence by sentence. */
function chunk(text: string): string[] {
  const parts = text.replace(/\s+/g, " ").trim().match(/[^.!?۔؟]+[.!?۔؟]*/g) ?? [text];
  const out: string[] = [];
  let current = "";
  for (const p of parts) {
    if (current && (current + p).length > 220) {
      out.push(current.trim());
      current = p;
    } else {
      current += p;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Zoya's spoken replies, using voices available in this browser. */
export function useSpeechOutput(voice: VoiceSettings) {
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speaking, setSpeaking] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const token = useRef(0);
  const voiceRef = useRef(voice);
  voiceRef.current = voice;

  useEffect(() => {
    if (!hasSpeech()) return;
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  /** Saved choice first, then a female voice, then any voice for the language. */
  const pick = useCallback(
    (urdu: boolean): SpeechSynthesisVoice | undefined => {
      const list = voices.filter((v) => v.lang.toLowerCase().startsWith(urdu ? "ur" : "en"));
      const saved = urdu ? voiceRef.current.urduVoice : voiceRef.current.englishVoice;
      return (
        (saved ? list.find((v) => v.name === saved) : undefined) ??
        list.find((v) => FEMALE_HINTS.some((h) => v.name.toLowerCase().includes(h))) ??
        list[0]
      );
    },
    [voices],
  );

  const cancel = useCallback(() => {
    token.current++;
    if (hasSpeech()) window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string): boolean => {
      if (!hasSpeech() || !text.trim()) return false;
      const urdu = isUrdu(text);
      const v = pick(urdu);
      if (!v) {
        setNote(
          urdu
            ? "This browser has no Urdu voice, so Urdu replies are shown but not spoken. Microsoft Edge has a free Urdu voice, and this extension works there too."
            : "No English voice was found in this browser.",
        );
        return false;
      }
      setNote(null);
      window.speechSynthesis.cancel();
      const mine = ++token.current;
      const parts = chunk(text);
      parts.forEach((part, i) => {
        const u = new SpeechSynthesisUtterance(part);
        u.voice = v;
        u.lang = v.lang;
        u.rate = 1;
        u.pitch = 1.05;
        if (i === parts.length - 1) {
          u.onend = () => {
            if (token.current === mine) setSpeaking(false);
          };
        }
        u.onerror = () => {
          if (token.current === mine) setSpeaking(false);
        };
        window.speechSynthesis.speak(u);
      });
      setSpeaking(true);
      return true;
    },
    [pick],
  );

  return {
    voices,
    englishVoices: voices.filter((v) => v.lang.toLowerCase().startsWith("en")),
    urduVoices: voices.filter((v) => v.lang.toLowerCase().startsWith("ur")),
    speaking,
    note,
    speak,
    cancel,
    pick,
  };
}