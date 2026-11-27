import { useState } from "react";
import { Header, type View } from "@/components/Header";
import { HomeView } from "@/components/HomeView";
import { KnowledgeView } from "@/components/KnowledgeView";
import { LogView } from "@/components/LogView";
import { SettingsView } from "@/components/SettingsView";
import { Setup } from "@/components/Setup";
import { useSettings } from "@/lib/settings";
import type { SkillTestRequest } from "@/lib/useGoal";

export default function App() {
  const { settings, update } = useSettings();
  const [view, setView] = useState<View>("home");
  const [skillTest, setSkillTest] = useState<SkillTestRequest | null>(null);

  if (!settings) return <div className="p-6 text-sm text-dim">Loading…</div>;
  if (!settings.setupDone) return <Setup initial={settings} onDone={update} />;

  return (
    <div className="min-h-screen">
      <Header settings={settings} view={view} setView={setView} />
      <main className="p-4">
        {/* Home stays mounted so a running task, a waiting approval and the mic are never lost when switching tabs. */}
        <div hidden={view !== "home"}>
          <HomeView
            settings={settings}
            skillTest={skillTest}
            onSkillTestTaken={() => setSkillTest(null)}
            onOpenKnowledge={() => setView("knowledge")}
          />
        </div>
        {view === "knowledge" && (
          <KnowledgeView
            settings={settings}
            onTestSkill={(req) => {
              setSkillTest(req);
              setView("home");
            }}
          />
        )}
        {view === "log" && <LogView />}
        {view === "settings" && <SettingsView settings={settings} onSave={update} />}
      </main>
    </div>
  );
}