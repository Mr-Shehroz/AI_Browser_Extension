import { AGENT_NAME, AGENT_NAME_URDU } from "./persona";
import type { ReplyLanguage } from "./types";

/** Everything Zoya says herself. Chat replies, plans and reports come from the model. */
export interface Phrases {
  greeting: string;
  stopped: string;
  paused: string;
  resumed: string;
  notPaused: string;
  destructiveVoice: string;
  approved: string;
  skipped: string;
  sayYesNo: string;
  planStart: string;
  planDropped: string;
  planRework: string;
  replyThanks: string;
  busy: string;
  brainFreeze: string;
  approvalNeeded: (target?: string) => string;
  destructiveAnnounce: (target?: string) => string;
  plan: (summary: string, steps: number) => string;
  done: (result: string) => string;
  failed: (error: string) => string;
}

export function phrases(lang: ReplyLanguage, userName: string): Phrases {
  const name = userName.trim();
  if (lang === "ur") {
    const hi = name ? ` ${name}` : "";
    return {
      greeting: `ہائے${hi}! میں ${AGENT_NAME_URDU}۔ آپ کیسے ہو؟ بتاؤ، آج کیا کرنا ہے؟`,
      stopped: "اوکے، رک گئی۔",
      paused: "اوکے، پاز کر دیا۔ اب ٹیب آپ کے پاس ہے۔ جب کہو، پھر سے شروع کر دوں گی۔",
      resumed: "چلو، پھر سے شروع کرتی ہوں۔",
      notPaused: "میں تو رکی ہی نہیں ہوں۔",
      destructiveVoice: "یہ والا کام واپس نہیں ہو سکتا، اس لیے پلیز اسکرین پر دیکھ کے خود کلک کرو۔",
      approved: "اوکے، کر رہی ہوں۔",
      skipped: "ٹھیک ہے، نہیں کرتی۔",
      sayYesNo: "بس ہاں یا نہیں بول دو۔",
      planStart: "زبردست، شروع کرتی ہوں۔",
      planDropped: "اوکے، چھوڑ دیا۔",
      planRework: "سمجھ گئی، پلان تھوڑا بدلتی ہوں۔",
      replyThanks: "تھینک یو، اب آگے چلتی ہوں۔",
      busy: `ایک منٹ${hi}، ابھی اسی پر لگی ہوں۔ رکوانا ہو تو بولو، رکو۔`,
      brainFreeze: "سوری، ایک سیکنڈ کے لیے دماغ اٹک گیا۔ دوبارہ بولو؟",
      approvalNeeded: (t) => `آگے جانے سے پہلے ایک بار پوچھ لوں${t ? ` (${t})` : ""}۔ کر دوں؟`,
      destructiveAnnounce: (t) => `دھیان سے، اگلا اسٹیپ واپس نہیں ہو سکتا${t ? ` (${t})` : ""}۔ پلیز دیکھ کے کلک کرو۔`,
      plan: (summary, steps) => `میرا پلان یہ ہے۔ ${summary} ٹوٹل ${steps} اسٹیپ ہیں۔ شروع کروں؟`,
      done: (result) => `ہو گیا${hi}! ${result}`,
      failed: (error) => `سوری${hi}، یہ والا نہیں ہو پایا۔ ${error}`,
    };
  }
  const hi = name ? ` ${name}` : "";
  return {
    greeting: `Hey${hi}! It's ${AGENT_NAME}. How are you doing? What are we up to today?`,
    stopped: "Okay, I've stopped.",
    paused: "Okay, paused. The tab's all yours. Just say continue when you're ready.",
    resumed: "Alright, carrying on.",
    notPaused: "I'm not paused, silly. Nothing to resume.",
    destructiveVoice: "This one can't be undone, so please check it on screen and click yourself.",
    approved: "Okay, doing it.",
    skipped: "Fine, I'll skip that.",
    sayYesNo: "Just say yes or no.",
    planStart: "Great, starting now.",
    planDropped: "Okay, dropped it.",
    planRework: "Got it, let me change the plan.",
    replyThanks: "Thanks, carrying on.",
    busy: `Hang on${hi}, I'm still on it. Say stop if you want me to stop.`,
    brainFreeze: `Sorry${hi}, my brain froze for a second. Say that again?`,
    approvalNeeded: (t) => `Quick check before I go on${t ? `: ${t}` : ""}. Should I?`,
    destructiveAnnounce: (t) => `Careful, the next step can't be undone${t ? `: ${t}` : ""}. Please check it and click.`,
    plan: (summary, steps) => `Here's my plan. ${summary} That's ${steps} step${steps === 1 ? "" : "s"}. Shall I start?`,
    done: (result) => `Done${hi}! ${result}`,
    failed: (error) => `Sorry${hi}, I couldn't get this one done. ${error}`,
  };
}