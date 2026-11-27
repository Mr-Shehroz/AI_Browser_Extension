import { useCallback, useEffect, useRef, useState } from "react";
import { browser } from "wxt/browser";
import { executeAction, observeTab } from "./actions";
import { audit } from "./audit";
import { redactAction } from "./describe";
import { assessRisk, requiresApproval } from "./risk";
import { ensureZoyaTab, getZoyaTab } from "./tabs";
import type { ActionRecord, BrowserAction, PageObservation, Settings } from "./types";

export interface ZoyaTab { id: number; url: string; title: string }
export interface PendingApproval { record: ActionRecord; resolve: (approved: boolean) => void }
export type Actor = "you" | "zoya";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const now = () => new Date().toISOString();

/** Zoya's tab, page reading, and every action through the risk and approval rules. */
export function useAgent(settings: Settings) {
  const [tab, setTab] = useState<ZoyaTab | null>(null);
  const [observation, setObservation] = useState<PageObservation | null>(null);
  const [records, setRecords] = useState<ActionRecord[]>([]);
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tabRef = useRef<ZoyaTab | null>(null);
  const obsRef = useRef<PageObservation | null>(null);
  const pendingRef = useRef<PendingApproval | null>(null);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  const updateTab = (t: ZoyaTab | null) => {
    tabRef.current = t;
    setTab(t);
  };
  const updatePending = (p: PendingApproval | null) => {
    pendingRef.current = p;
    setPending(p);
  };

  useEffect(() => {
    void getZoyaTab().then((t) => {
      if (t?.id !== undefined) updateTab({ id: t.id, url: t.url ?? "", title: t.title ?? "" });
    });
    const onUpdated = (tabId: number, _info: unknown, t: { url?: string; title?: string }) => {
      if (tabRef.current?.id === tabId) updateTab({ id: tabId, url: t.url ?? "", title: t.title ?? "" });
    };
    const onRemoved = (tabId: number) => {
      if (tabRef.current?.id === tabId) {
        updateTab(null);
        obsRef.current = null;
        setObservation(null);
      }
    };
    browser.tabs.onUpdated.addListener(onUpdated);
    browser.tabs.onRemoved.addListener(onRemoved);
    return () => {
      browser.tabs.onUpdated.removeListener(onUpdated);
      browser.tabs.onRemoved.removeListener(onRemoved);
    };
  }, []);

  const getTab = useCallback(() => tabRef.current, []);

  const openTab = useCallback(async (): Promise<boolean> => {
    setError(null);
    try {
      const t = await ensureZoyaTab();
      updateTab({ id: t.id!, url: t.url ?? "", title: t.title ?? "" });
      await browser.tabs.update(t.id!, { active: true });
      void audit("tab_opened", { url: t.url });
      return true;
    } catch (e) {
      setError(errMsg(e));
      return false;
    }
  }, []);

  const focusTab = useCallback(async () => {
    if (tabRef.current) await browser.tabs.update(tabRef.current.id, { active: true });
  }, []);

  const observe = useCallback(async (): Promise<PageObservation | null> => {
    setError(null);
    const t = tabRef.current;
    if (!t) {
      setError("Open Zoya's tab first.");
      return null;
    }
    try {
      const obs = await observeTab(t.id);
      obsRef.current = obs;
      setObservation(obs);
      return obs;
    } catch (e) {
      setError(errMsg(e));
      return null;
    }
  }, []);

  const upsert = (rec: ActionRecord) =>
    setRecords((prev) => [{ ...rec }, ...prev.filter((r) => r.id !== rec.id)].slice(0, 100));

  const run = useCallback(async (action: BrowserAction, by: Actor = "you"): Promise<ActionRecord> => {
    setError(null);
    const t = tabRef.current;
    const needsElement = action.type === "click" || action.type === "type";
    const el = needsElement ? obsRef.current?.elements.find((e) => e.ref === action.ref) : undefined;
    const { risk, reason } = assessRisk(action, el);

    const rec: ActionRecord = {
      id: crypto.randomUUID(),
      action: redactAction(action),
      risk,
      reason,
      target: el?.name,
      status: "running",
      createdAt: now(),
    };
    const finish = (patch: Partial<ActionRecord>) => {
      Object.assign(rec, patch, { finishedAt: now() });
      upsert(rec);
      void audit(`action_${rec.status}`, { by, action: rec.action, risk, target: rec.target, evidence: rec.evidence, error: rec.error });
      return { ...rec };
    };

    if (!t) return finish({ status: "failed", error: "Open Zoya's tab first." });
    if (needsElement && !el) return finish({ status: "failed", error: "Unknown element. Read the page first." });
    if (risk === "blocked") return finish({ status: "blocked", error: reason });

    if (requiresApproval(risk, settingsRef.current.approvalMode)) {
      rec.status = "pending_approval";
      upsert(rec);
      const approved = await new Promise<boolean>((resolve) => updatePending({ record: { ...rec }, resolve }));
      updatePending(null);
      void audit("approval_decision", { by, action: rec.action, risk, approved });
      if (!approved) return finish({ status: "rejected" });
    }

    rec.status = "running";
    upsert(rec);
    setBusy(true);
    try {
      await executeAction(t.id, action, settingsRef.current.trustedInput);
      const after = await browser.tabs.get(t.id);
      const evidence = `Now on "${after.title ?? ""}" (${after.url ?? ""})`;
      const obs = await observeTab(t.id).catch(() => null);
      if (obs) {
        obsRef.current = obs;
        setObservation(obs);
      }
      return finish({ status: "succeeded", evidence });
    } catch (e) {
      return finish({ status: "failed", error: errMsg(e) });
    } finally {
      setBusy(false);
    }
  }, []);

  const decide = useCallback((approved: boolean) => pendingRef.current?.resolve(approved), []);
  const cancelPending = useCallback(() => pendingRef.current?.resolve(false), []);

  return { tab, observation, records, pending, busy, error, getTab, openTab, focusTab, observe, run, decide, cancelPending };
}

export type AgentApi = ReturnType<typeof useAgent>;