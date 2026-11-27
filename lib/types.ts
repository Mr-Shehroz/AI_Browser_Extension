export type ProviderKind =
  | "gemini"
  | "openai"
  | "anthropic"
  | "compatible"
  | "ollama";

export interface ProviderConfig {
  kind: ProviderKind;
  apiKey: string;
  baseUrl: string;
  model: string;
}

export type ReplyLanguage = "en" | "ur";
export type ApprovalMode = "standard" | "strict";

export type ListenLanguage = "en-US" | "ur-PK";

export interface VoiceSettings {
  speakReplies: boolean;
  listenLang: ListenLanguage;
  /** Empty means "pick a female voice automatically". */
  englishVoice: string;
  urduVoice: string;
}

export interface Settings {
  setupDone: boolean;
  userName: string;
  replyLanguage: ReplyLanguage;
  approvalMode: ApprovalMode;
  quickMode: boolean;
  /** Model for browser tasks. */
  brain: ProviderConfig;
  /** Small talk can use a faster or cheaper model. */
  chatSameAsBrain: boolean;
  chat: ProviderConfig;
  voice: VoiceSettings;
  /** Use Chrome's own input system for clicks and typing (for stubborn sites). */
  trustedInput: boolean;
  /** Second provider used when the main one is down or out of quota. */
  fallbackEnabled: boolean;
  fallback: ProviderConfig;
}

export type RiskLevel =
  | "read_only"
  | "reversible"
  | "impactful"
  | "destructive"
  | "blocked";

export type BrowserAction =
  | { type: "navigate"; url: string }
  | { type: "click"; ref: string }
  | { type: "type"; ref: string; text: string; secret?: boolean }
  | { type: "press"; key: string }
  | { type: "scroll"; direction: "up" | "down" }
  | { type: "back" };

export interface InteractiveElement {
  ref: string;
  role: string;
  type?: string;
  name: string;
  inViewport: boolean;
}

export interface PageObservation {
  url: string;
  title: string;
  text: string;
  elements: InteractiveElement[];
  blockers: string[];
  observedAt: string;
}

export type ActionStatus =
  | "pending_approval"
  | "running"
  | "succeeded"
  | "failed"
  | "rejected"
  | "blocked";

export interface ActionRecord {
  id: string;
  action: BrowserAction;
  risk: RiskLevel;
  reason: string;
  target?: string;
  status: ActionStatus;
  createdAt: string;
  finishedAt?: string;
  evidence?: string;
  error?: string;
}

export interface AuditEntry {
  at: string;
  event: string;
  data: Record<string, unknown>;
}

// ---- Phase 2: goals and conversation ----
export type GoalStatus =
  | "planning"
  | "awaiting_plan_approval"
  | "running"
  | "waiting_user"
  | "done"
  | "failed"
  | "stopped";

export interface GoalPlan {
  summary: string;
  steps: string[];
  risks: string[];
}

export interface GoalStep {
  index: number;
  thought: string;
  decision: string;
  outcome?: string;
}

export interface GoalRun {
  id: string;
  goal: string;
  status: GoalStatus;
  paused: boolean;
  activity?: string;
  plan?: GoalPlan;
  steps: GoalStep[];
  question?: string;
  result?: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
  usedSkills?: SkillRef[];
  skippedSkills?: { name: string; reason: string }[];
  researchCount?: number;
  testOfSkill?: SkillRef;
  savedSkill?: SkillRef;
}

export interface ConvoMessage {
  id: string;
  who: "you" | "zoya" | "note";
  text: string;
  at: string;
}
// ---- Phase 4: knowledge ----
export interface ResearchNote {
  id: string;
  url: string;
  title: string;
  accessedAt: string;
  relevant: boolean;
  summary: string;
  keyPoints: string[];
  versionInfo?: string;
  /** Saved page text, used to spot later changes. */
  text: string;
}

export type SkillStatus = "draft" | "tested" | "approved" | "stale" | "retired";
export interface SkillStep {
  instruction: string;
  expected?: string;
}
export interface SkillSource {
  url: string;
  researchId?: string;
  accessedAt: string;
}

export interface Skill {
  id: string;
  version: number;
  name: string;
  purpose: string;
  domains: string[];
  prerequisites: string[];
  inputs: string[];
  steps: SkillStep[];
  verification: string[];
  failureCases: string[];
  rollback: string;
  risk: RiskLevel;
  sources: SkillSource[];
  status: SkillStatus;
  confidence: "low" | "medium" | "high";
  createdAt: string;
  updatedAt: string;
  testedAt?: string;
  testEvidence?: string;
  approvedAt?: string;
  lastValidatedAt?: string;
  staleReason?: string;
  lastUsedAt?: string;
  importedAt?: string;
  uses: number;
  successes: number;
  derivedFromGoal?: string;
  history: { version: number; at: string; change: string }[];
}

export interface SkillRef {
  id: string;
  version: number;
  name: string;
  status: SkillStatus;
}

export interface SiteProfile {
  domain: string;
  firstSeen: string;
  lastVisited: string;
  visits: number;
  titles: string[];
  notes: string[];
  pitfalls: string[];
  skillIds: string[];
}
