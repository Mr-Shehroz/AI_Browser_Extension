import { useEffect, useRef, useState } from "react";
import { audit } from "@/lib/audit";
import { openMicPermission } from "@/lib/permissions";
import { useAgent } from "@/lib/useAgent";
import { useConversation } from "@/lib/useConversation";
import { isActiveGoal, useGoal, type SkillTestRequest } from "@/lib/useGoal";
import { useSpeechInput } from "@/lib/useSpeechInput";
import { useSpeechOutput } from "@/lib/useSpeechOutput";
import type { Settings } from "@/lib/types";
import { ApprovalCard } from "./ApprovalCard";
import { Conversation } from "./Conversation";
import { GoalKnowledge } from "./GoalKnowledge";
import { ManualControls } from "./ManualControls";
import { Stage } from "./Stage";
import { Timeline } from "./Timeline";
import { MicButton, VoiceStrip } from "./VoiceControls";

interface Props {
  settings: Settings;
  skillTest: SkillTestRequest | null;
  onSkillTestTaken: () => void;
  onOpenKnowledge: () => void;
}

export function HomeView({ settings, skillTest, onSkillTestTaken, onOpenKnowledge }: Props) {
  const agent = useAgent(settings);
  const goalApi = useGoal(agent, settings);
  const speech = useSpeechOutput(settings.voice);
  const [handsFree, setHandsFree] = useState(false); // always opt-in, per session
  const handsFreeRef = useRef(false);

  const convo = useConversation({
    agent,
    goalApi,
    settings,
    onSay: (text) => {
      if (settings.voice.speakReplies || handsFreeRef.current) speech.speak(text);
    },
  });

  const input = useSpeechInput({
    lang: settings.voice.listenLang,
    handsFree,
    paused: speech.speaking || convo.thinking,
    onFinal: (text) => {
      speech.cancel();
      void convo.send(text);
    },
  });

  const working = isActiveGoal(goalApi.goal);

  // Say hello once when the panel opens.
  useEffect(() => {
    convo.greet();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A skill test requested from the Knowledge tab.
  useEffect(() => {
    if (!skillTest) return;
    onSkillTestTaken();
    const { skill, inputs } = skillTest;
    goalApi
      .start(`Test the saved skill "${skill.name}" (v${skill.version}): ${skill.purpose}`, { testSkill: skill, inputs })
      .catch((e: unknown) => convo.say(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skillTest]);

  const toggleHandsFree = (on: boolean) => {
    handsFreeRef.current = on;
    setHandsFree(on);
    void audit(on ? "handsfree_on" : "handsfree_off", { listenLang: settings.voice.listenLang });
    if (on) convo.say(settings.replyLanguage === "ur" ? "میں سن رہی ہوں، بولو۔" : "I'm listening. Go ahead.");
    else speech.cancel();
  };

  return (
    <div className="space-y-4">
      <Conversation
        convo={convo}
        goalApi={goalApi}
        inputAddon={
          <MicButton
            listening={input.listening && !handsFree}
            disabled={!input.supported || handsFree || convo.thinking}
            onClick={() => {
              speech.cancel();
              input.pushToTalk();
            }}
          />
        }
      />

      <GoalKnowledge goalApi={goalApi} onOpenKnowledge={onOpenKnowledge} />

      <VoiceStrip
        supported={input.supported}
        handsFree={handsFree}
        onToggle={toggleHandsFree}
        listening={input.listening}
        interim={input.interim}
        speaking={speech.speaking}
        thinking={convo.thinking}
        error={input.error}
        note={speech.note}
        needsPermission={input.needsPermission}
        onAllow={() => void openMicPermission()}
      />

      {agent.pending && (
        <ApprovalCard key={agent.pending.record.id} record={agent.pending.record} onDecide={agent.decide} />
      )}

      <Stage
        tab={agent.tab}
        busy={agent.busy || goalApi.goal?.status === "running"}
        waiting={!!agent.pending}
        failed={goalApi.goal?.status === "failed"}
        onOpen={() => void agent.openTab()}
        onFocus={agent.focusTab}
        onObserve={() => void agent.observe()}
      />

      {agent.error && (
        <p className="rounded-lg border border-ember/50 bg-ember/5 p-3 text-sm text-ember" role="alert">{agent.error}</p>
      )}

      <Timeline records={agent.records} />

      <ManualControls
        observation={agent.observation}
        disabled={!agent.tab || agent.busy || !!agent.pending || working}
        onRun={(a) => agent.run(a, "you")}
        onObserve={agent.observe}
      />
    </div>
  );
}