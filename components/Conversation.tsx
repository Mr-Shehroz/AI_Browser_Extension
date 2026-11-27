import { useEffect, useRef, useState } from "react";
import { AGENT_NAME } from "@/lib/persona";
import type { GoalStatus } from "@/lib/types";
import type { ConversationApi } from "@/lib/useConversation";
import { isActiveGoal, type GoalApi } from "@/lib/useGoal";
import { PlanCard } from "./PlanCard";
import { btn, btnDanger, btnPrimary, input, panel, panelTitle } from "./ui";

const STATUS_LABEL: Record<GoalStatus, string> = {
  planning: "Planning",
  awaiting_plan_approval: "Plan ready",
  running: "Working",
  waiting_user: "Needs you",
  done: "Done",
  failed: "Couldn't finish",
  stopped: "Stopped",
};

const SUGGESTIONS = ["How are you?", "Open Wikipedia and search for Lahore", "What's on this page?"];

interface Props {
  convo: ConversationApi;
  goalApi: GoalApi;
  /** Extra controls placed next to the text box (the microphone, from Phase 3). */
  inputAddon?: React.ReactNode;
}

export function Conversation({ convo, goalApi, inputAddon }: Props) {
  const [text, setText] = useState("");
  const listRef = useRef<HTMLOListElement>(null);
  const g = goalApi.goal;
  const active = isActiveGoal(g);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [convo.messages.length, convo.thinking]);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    void convo.send(t);
  };

  return (
    <section className={`${panel} space-y-3`}>
      <div className="flex items-center justify-between">
        <h2 className={panelTitle}>Talk to {AGENT_NAME}</h2>
        {g && (
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${active ? "bg-teal/10 text-teal" : "bg-dim/15 text-dim"}`}>
            {g.paused ? "Paused" : STATUS_LABEL[g.status]}
          </span>
        )}
      </div>

      {convo.messages.length === 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-haze/80">Tell me what to do, or just say hi.</p>
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button key={s} className={btn} onClick={() => void convo.send(s)}>{s}</button>
            ))}
          </div>
        </div>
      ) : (
        <ol ref={listRef} className="max-h-80 space-y-2 overflow-auto pr-1 text-sm" aria-label="Conversation" aria-live="polite">
          {convo.messages.map((m) => (
            <li
              key={m.id}
              dir="auto"
              className={
                m.who === "you"
                  ? "ml-8 rounded-xl rounded-br-sm bg-steel/70 px-3 py-2 text-white"
                  : m.who === "zoya"
                    ? "mr-8 rounded-xl rounded-bl-sm border border-teal/25 bg-teal/5 px-3 py-2 text-white"
                    : "px-1 text-xs text-ember"
              }
            >
              {m.text}
            </li>
          ))}
        </ol>
      )}

      {convo.thinking && <p className="animate-pulse text-xs text-teal">{AGENT_NAME} is thinking…</p>}

      {active && (
        <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-night/50 px-3 py-2">
          <p className="min-w-0 flex-1 truncate text-xs text-haze" dir="auto">{g.activity ?? STATUS_LABEL[g.status]}</p>
          {g.status === "running" && (g.paused
            ? <button className={btn} onClick={goalApi.resume}>Resume</button>
            : <button className={btn} onClick={goalApi.pause}>Pause</button>)}
          <button className={btnDanger} onClick={goalApi.stop}>Stop</button>
        </div>
      )}

      {g?.status === "awaiting_plan_approval" && g.plan && (
        <PlanCard plan={g.plan} onDecide={(ok, fb) => void goalApi.decidePlan(ok, fb)} />
      )}

      {g && g.steps.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-dim">What I did ({g.steps.length} steps)</summary>
          <ol className="mt-2 max-h-56 space-y-2 overflow-auto pr-1">
            {[...g.steps].reverse().map((s) => (
              <li key={s.index} dir="auto">
                <p className="text-dim">{s.index}. {s.thought}</p>
                <p className="font-semibold text-white">{s.decision}</p>
                {s.outcome && <p className="text-haze/70">{s.outcome}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}

      <form className="flex items-center gap-2" onSubmit={submit}>
        {inputAddon}
        <input
          className={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={g?.status === "waiting_user" ? "Type your answer…" : `Message ${AGENT_NAME}…`}
          aria-label={`Message ${AGENT_NAME}`}
          dir="auto"
          disabled={convo.thinking}
        />
        <button className={btnPrimary} disabled={!text.trim() || convo.thinking}>Send</button>
      </form>
    </section>
  );
}