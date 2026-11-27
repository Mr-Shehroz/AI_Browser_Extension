import { useEffect, useRef, useState } from "react";
import { companionReply } from "./companion";
import { classify } from "./intents";
import { phrases } from "./phrases";
import type { ConvoMessage, Settings } from "./types";
import type { AgentApi } from "./useAgent";
import { isActiveGoal, type GoalApi } from "./useGoal";

const now = () => new Date().toISOString();

/** One place for everything said to and by Zoya: typed now, spoken from Phase 3. */
export function useConversation({ agent, goalApi, settings, onSay }: {
  agent: AgentApi;
  goalApi: GoalApi;
  settings: Settings;
  onSay?: (text: string) => void;
}) {
  const [messages, setMessages] = useState<ConvoMessage[]>([]);
  const [thinking, setThinking] = useState(false);
  const messagesRef = useRef<ConvoMessage[]>([]);
  const onSayRef = useRef(onSay);
  onSayRef.current = onSay;
  const P = phrases(settings.replyLanguage, settings.userName);

  const add = (who: ConvoMessage["who"], text: string) => {
    const m: ConvoMessage = { id: crypto.randomUUID(), who, text, at: now() };
    messagesRef.current = [...messagesRef.current, m].slice(-60);
    setMessages(messagesRef.current);
  };
  const say = (text: string) => {
    if (!text.trim()) return;
    add("zoya", text);
    onSayRef.current?.(text);
  };

  // Zoya speaks up when the goal or an approval needs the user. Each event once.
  const announced = useRef(new Set<string>());
  useEffect(() => {
    const once = (key: string, text?: string) => {
      if (!text || announced.current.has(key)) return;
      announced.current.add(key);
      say(text);
    };
    const pending = agent.pending?.record;
    if (pending) {
      once(`approval:${pending.id}`, pending.risk === "destructive" ? P.destructiveAnnounce(pending.target) : P.approvalNeeded(pending.target));
    }
    const g = goalApi.goal;
    if (g) {
      if (g.status === "awaiting_plan_approval" && g.plan) once(`plan:${g.id}:${g.plan.summary}`, P.plan(g.plan.summary, g.plan.steps.length));
      if (g.status === "waiting_user") once(`ask:${g.id}:${g.question}`, g.question);
      if (g.status === "done") once(`done:${g.id}`, P.done(g.result ?? ""));
      if (g.status === "failed") once(`failed:${g.id}`, P.failed(g.error ?? ""));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent.pending, goalApi.goal]);



    // Tell the user when the backup brain takes over (at most once a minute).
  const lastFallbackNote = useRef(0);
  useEffect(() => {
    const onFallback = () => {
      if (Date.now() - lastFallbackNote.current < 60_000) return;
      lastFallbackNote.current = Date.now();
      add(
        "note",
        settings.replyLanguage === "ur"
          ? "میرا مین AI ابھی جواب نہیں دے رہا، اس لیے بیک اپ استعمال کر رہی ہوں۔"
          : "My main AI isn't answering right now, so I'm using the backup.",
      );
    };
    window.addEventListener("zoya-fallback", onFallback);
    return () => window.removeEventListener("zoya-fallback", onFallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.replyLanguage]);







  /** Handle anything the user says or types. Returns false if it was ignored as noise. */
  async function send(raw: string): Promise<boolean> {
    const text = raw.trim();
    const intent = classify(text);
    if (intent === "noise" || thinking) return false;
    add("you", text);

    const g = goalApi.goal;
    const active = isActiveGoal(g);
    const pending = agent.pending?.record;

    if (intent === "stop") {
      if (active) goalApi.stop();
      else agent.cancelPending();
      say(P.stopped);
      return true;
    }
    if (intent === "pause") {
      if (g?.status === "running") goalApi.pause();
      say(P.paused);
      return true;
    }
    if (intent === "resume") {
      if (!g?.paused) say(P.notPaused);
      else {
        goalApi.resume();
        say(P.resumed);
      }
      return true;
    }

    if (pending) {
      if (pending.risk === "destructive") say(P.destructiveVoice);
      else if (intent === "yes") {
        agent.decide(true);
        say(P.approved);
      } else if (intent === "no") {
        agent.decide(false);
        say(P.skipped);
      } else say(P.sayYesNo);
      return true;
    }

    if (g?.status === "awaiting_plan_approval") {
      if (intent === "yes") {
        void goalApi.decidePlan(true);
        say(P.planStart);
      } else if (intent === "no") {
        void goalApi.decidePlan(false);
        say(P.planDropped);
      } else {
        void goalApi.decidePlan(false, text);
        say(P.planRework);
      }
      return true;
    }

    if (g?.status === "waiting_user") {
      goalApi.reply(text);
      say(P.replyThanks);
      return true;
    }

    if (active) {
      say(P.busy);
      return true;
    }

    setThinking(true);
    try {
      const r = await companionReply(settings, messagesRef.current.slice(0, -1), text);
      say(r.reply);
      if (r.task) await goalApi.start(r.task);
    } catch (e) {
      say(P.brainFreeze);
      add("note", e instanceof Error ? e.message : String(e));
    } finally {
      setThinking(false);
    }
    return true;
  }

  function greet() {
    if (messagesRef.current.length === 0) say(P.greeting);
  }

  return { messages, thinking, send, greet, say };
}

export type ConversationApi = ReturnType<typeof useConversation>;