import type { EnrichedInsightPair } from "@/lib/insightTypes";
import type { InsightCluster } from "@/lib/noteGraph";

export type InsightStreamEvent =
  | { type: "stage"; stage: string; message: string; progress?: number }
  | { type: "pair"; pair: EnrichedInsightPair }
  | { type: "cluster"; cluster: InsightCluster }
  | { type: "done"; pairCount: number; clusterCount: number }
  | { type: "error"; error: string };

export function encodeStreamEvent(event: InsightStreamEvent): string {
  return `${JSON.stringify(event)}\n`;
}
