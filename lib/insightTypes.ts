import type { InsightKind, NoteCorpusItem } from "@/lib/noteLinks";
import type { InsightCluster } from "@/lib/noteGraph";

export const INSIGHT_CACHE_VERSION = 1;

export interface EnrichedInsightPair {
  id: string;
  kind: InsightKind;
  score: number;
  sharedTerms: string[];
  source: NoteCorpusItem;
  target: NoteCorpusItem;
  theme?: string;
  reflectionPrompt?: string;
  confidence?: number;
  dataSource: "local" | "ai";
}

export interface InsightBuildResult {
  pairs: EnrichedInsightPair[];
  clusters: InsightCluster[];
  builtAt: number;
  version: number;
  corpusHash: string;
}

export type InsightBuildStage =
  | "idle"
  | "preview"
  | "embedding"
  | "clustering"
  | "prompts"
  | "done"
  | "error";

export function defaultReflectionPrompt(pair: EnrichedInsightPair): string {
  const theme = pair.theme || pair.sharedTerms.slice(0, 2).join("、") || "这一主题";
  if (pair.kind === "opposing") {
    return `这两段话在「${theme}」上立场相反，你更认同哪一种？为什么？`;
  }
  return `这两段话都在谈「${theme}」，你读到了什么相同或不同的洞见？`;
}

export function toEnrichedPair(
  pair: {
    id: string;
    kind: InsightKind;
    score: number;
    sharedTerms: string[];
    source: NoteCorpusItem;
    target: NoteCorpusItem;
  },
  dataSource: "local" | "ai",
  extras?: Partial<EnrichedInsightPair>
): EnrichedInsightPair {
  const enriched: EnrichedInsightPair = {
    ...pair,
    dataSource,
    ...extras,
  };
  if (!enriched.reflectionPrompt) {
    enriched.reflectionPrompt = defaultReflectionPrompt(enriched);
  }
  return enriched;
}
