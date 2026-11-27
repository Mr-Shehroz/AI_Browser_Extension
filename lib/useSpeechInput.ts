import { useEffect, useRef, useState } from "react";
import type { ListenLanguage } from "./types";

// Minimal types for Chrome's speech recognition (not in TypeScript's standard library).
interface SRAlternative { transcript: string }
interface SRResult { readonly isFinal: boolean; readonly length: number; [index: number]: SRAlternative | undefined }
interface SREvent { resultIndex: number; results: { readonly length: number; [index: number]: SRResult | undefined } }
interface SRErrorEvent { error: string }
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onstart: (() => void) | null;
  onresult: ((e: SREvent) => void) | null;
  onerror: ((e: SRErrorEvent) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

function getRecognition(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

interface Options {
  lang: ListenLanguage;
  handsFree: boolean;
  /** While true (Zoya talking or thinking), hands-free listening is suspended. */
  paused: boolean;
  onFinal: (text: string) => void;
}

/** Push-to-talk and hands-free listening through Chrome's speech recognition. */
export function useSpeechInput({ lang, handsFree, paused, onFinal }: Options) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsPermission, setNeedsPermission] = useState(false);
  const supported = typeof window !== "undefined" && !!getRecognition();

  const recRef = useRef<Recognition | null>(null);
  const wantRef = useRef<"none" | "push" | "handsfree">("none");
  const pausedRef = useRef(paused);
  const langRef = useRef(lang);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;
  langRef.current = lang;

  const create = (continuous: boolean): Recognition => {
    const Ctor = getRecognition()!;
    const rec = new Ctor();
    rec.lang = langRef.current;
    rec.continuous = continuous;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      setListening(true);
      setNeedsPermission(false);
    };
    rec.onresult = (e) => {
      let pendingText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        if (!r) continue;
        const t = r[0]?.transcript ?? "";
        if (r.isFinal) {
          const clean = t.trim();
          if (clean) onFinalRef.current(clean);
        } else {
          pendingText += t;
        }
      }
      setInterim(pendingText);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        setNeedsPermission(true);
        wantRef.current = "none";
      } else if (e.error === "network") {
        setError("Speech recognition needs an internet connection.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        setError(`Speech recognition problem: ${e.error}`);
      }
    };
    rec.onend = () => {
      setListening(false);
      setInterim("");
      recRef.current = null;
      if (wantRef.current === "push") wantRef.current = "none";
      // Chrome ends recognition after silence; keep hands-free going.
      if (wantRef.current === "handsfree" && !pausedRef.current) setTimeout(startHandsFree, 300);
    };
    return rec;
  };

  function startHandsFree() {
    if (wantRef.current !== "handsfree" || pausedRef.current || recRef.current || !getRecognition()) return;
    try {
      const rec = create(true);
      recRef.current = rec;
      rec.start();
    } catch {
      // already starting; ignore
    }
  }

  function pushToTalk() {
    if (!supported) return;
    if (recRef.current) {
      recRef.current.stop();
      return;
    }
    setError(null);
    wantRef.current = "push";
    try {
      const rec = create(false);
      recRef.current = rec;
      rec.start();
    } catch {
      setError("Couldn't start listening. Try again.");
    }
  }

  // Hands-free on and off.
  useEffect(() => {
    if (handsFree) {
      setError(null);
      wantRef.current = "handsfree";
      startHandsFree();
    } else if (wantRef.current === "handsfree") {
      wantRef.current = "none";
      recRef.current?.abort();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handsFree]);

  // Suspend while Zoya talks or thinks, then resume.
  useEffect(() => {
    pausedRef.current = paused;
    if (paused) {
      if (wantRef.current === "handsfree") recRef.current?.abort();
    } else {
      startHandsFree();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused]);

  // Switching language restarts listening in the new language.
  useEffect(() => {
    if (wantRef.current === "handsfree") recRef.current?.abort();
  }, [lang]);

  // Release the microphone when the panel closes.
  useEffect(() => () => {
    wantRef.current = "none";
    recRef.current?.abort();
  }, []);

  return { supported, listening, interim, error, needsPermission, pushToTalk };
}