import { useCallback, useEffect, useState } from "react";
import { listResearch } from "./research";
import { listSites } from "./sites";
import { allSkills } from "./skills";
import type { ResearchNote, SiteProfile, Skill } from "./types";

export interface KnowledgeData { skills: Skill[]; research: ResearchNote[]; sites: SiteProfile[] }

/** Everything Zoya has learned, reloaded whenever it changes. */
export function useKnowledge() {
  const [data, setData] = useState<KnowledgeData | null>(null);

  const reload = useCallback(async () => {
    const [skills, research, sites] = await Promise.all([allSkills(), listResearch(), listSites()]);
    setData({ skills, research, sites });
  }, []);

  useEffect(() => {
    void reload();
    const onChange = () => void reload();
    window.addEventListener("zoya-knowledge", onChange);
    return () => window.removeEventListener("zoya-knowledge", onChange);
  }, [reload]);

  return { data, reload };
}