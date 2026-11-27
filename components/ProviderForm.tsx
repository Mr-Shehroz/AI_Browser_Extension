import { useId, useState } from "react";
import { listModels, PROVIDERS, testConnection } from "@/lib/providers";
import type { ProviderConfig, ProviderKind } from "@/lib/types";
import { btn, input, label } from "./ui";

interface Props {
  value: ProviderConfig;
  onChange: (p: ProviderConfig) => void;
}

type Status = { kind: "idle" } | { kind: "busy"; text: string } | { kind: "ok"; text: string } | { kind: "error"; text: string };

export function ProviderForm({ value, onChange }: Props) {
  const id = useId();
  const [models, setModels] = useState<string[]>([]);
  const [showKey, setShowKey] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const info = PROVIDERS[value.kind];
  const set = (patch: Partial<ProviderConfig>) => onChange({ ...value, ...patch });
  const ready = (!info.needsKey || value.apiKey.trim()) && value.baseUrl.trim();

  const chooseKind = (kind: ProviderKind) => {
    setModels([]);
    setStatus({ kind: "idle" });
    onChange({ kind, apiKey: kind === value.kind ? value.apiKey : "", baseUrl: PROVIDERS[kind].baseUrl, model: "" });
  };

  const load = async () => {
    setStatus({ kind: "busy", text: "Loading models…" });
    try {
      const list = await listModels(value);
      setModels(list);
      if (!value.model && list.length) {
        const preferred = value.kind === "gemini" ? list.find((m) => m.includes("flash")) : undefined;
        set({ model: preferred ?? list[0] ?? "" });
      }
      setStatus({ kind: "ok", text: `${list.length} models available. Pick one below.` });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : "Couldn't load models." });
    }
  };

  const test = async () => {
    setStatus({ kind: "busy", text: "Testing…" });
    try {
      const ms = await testConnection(value);
      setStatus({ kind: "ok", text: `Connected. The reply took ${(ms / 1000).toFixed(1)} s.` });
    } catch (e) {
      setStatus({ kind: "error", text: e instanceof Error ? e.message : "The test failed." });
    }
  };

  return (
    <div className="space-y-3">
      <label className={label}>
        Provider
        <select className={`${input} mt-1`} value={value.kind} onChange={(e) => chooseKind(e.target.value as ProviderKind)}>
          {(Object.keys(PROVIDERS) as ProviderKind[]).map((k) => (
            <option key={k} value={k}>{PROVIDERS[k].label}</option>
          ))}
        </select>
      </label>
      <p className="text-xs leading-relaxed text-dim">
        {info.note}{" "}
        {info.keyUrl && (
          <a href={info.keyUrl} target="_blank" rel="noreferrer" className="text-teal underline-offset-2 hover:underline">
            Get a key
          </a>
        )}
      </p>

      {(value.kind === "compatible" || value.kind === "ollama") && (
        <label className={label}>
          API address
          <input
            className={`${input} mt-1`}
            value={value.baseUrl}
            onChange={(e) => set({ baseUrl: e.target.value })}
            placeholder="https://api.example.com/v1"
          />
        </label>
      )}

      {info.needsKey && (
        <label className={label}>
          API key
          <div className="mt-1 flex gap-2">
            <input
              className={input}
              type={showKey ? "text" : "password"}
              value={value.apiKey}
              onChange={(e) => set({ apiKey: e.target.value.trim() })}
              placeholder="Paste your key"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="button" className={btn} onClick={() => setShowKey((s) => !s)}>{showKey ? "Hide" : "Show"}</button>
          </div>
          <span className="mt-1 block font-normal text-dim">Saved only in this Chrome profile on this computer.</span>
        </label>
      )}

      <label className={label}>
        Model
        <div className="mt-1 flex gap-2">
          <input
            className={input}
            list={`${id}-models`}
            value={value.model}
            onChange={(e) => set({ model: e.target.value.trim() })}
            placeholder="Load models, or type a model name"
          />
          <button type="button" className={btn} disabled={!ready || status.kind === "busy"} onClick={load}>Load models</button>
        </div>
        <datalist id={`${id}-models`}>
          {models.map((m) => <option key={m} value={m} />)}
        </datalist>
      </label>

      <div className="flex items-center gap-3">
        <button type="button" className={btn} disabled={!ready || !value.model || status.kind === "busy"} onClick={test}>
          Test connection
        </button>
        {status.kind !== "idle" && (
          <p
            role={status.kind === "error" ? "alert" : undefined}
            className={`text-xs ${status.kind === "error" ? "text-ember" : status.kind === "ok" ? "text-teal" : "text-dim"}`}
          >
            {status.text}
          </p>
        )}
      </div>
    </div>
  );
}