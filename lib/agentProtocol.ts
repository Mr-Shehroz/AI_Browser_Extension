/** Messages Zoya's panel sends to the content script running in her tab. */
export type AgentRequest =
  | { zoya: true; op: "observe" }
  | { zoya: true; op: "click"; ref: string }
  | { zoya: true; op: "type"; ref: string; text: string }
  | { zoya: true; op: "press"; key: string }
  | { zoya: true; op: "scroll"; direction: "up" | "down" }
  | { zoya: true; op: "point"; ref: string }
  | { zoya: true; op: "focus"; ref: string };