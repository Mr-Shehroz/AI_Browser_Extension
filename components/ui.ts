import type { ActionStatus, RiskLevel } from "@/lib/types";

export const panel = "rail-panel";
export const panelTitle = "font-display text-2xl font-bold leading-none tracking-wide text-white";
export const input = "cine-input";
export const btn = "cine-btn";
export const btnPrimary = "cine-btn cine-btn-primary";
export const btnDanger = "cine-btn cine-btn-danger";
export const label = "block text-xs font-semibold text-white";

export const riskStyle: Record<RiskLevel, string> = {
  read_only: "bg-teal/10 text-teal",
  reversible: "bg-haze/10 text-haze",
  impactful: "bg-amber/15 text-amber",
  destructive: "bg-ember/15 text-ember",
  blocked: "bg-dim/15 text-dim",
};

export const statusStyle: Record<ActionStatus, string> = {
  pending_approval: "text-amber",
  running: "text-teal",
  succeeded: "text-teal/80",
  failed: "text-ember",
  rejected: "text-dim",
  blocked: "text-ember",
};