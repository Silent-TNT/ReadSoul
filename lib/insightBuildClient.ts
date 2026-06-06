import type { NoteCorpusItem } from "@/lib/noteLinks";
import type {
  InsightBuildStage,
  InsightBuildResult,
  EnrichedInsightPair,
} from "@/lib/insightTypes";
import { INSIGHT_CACHE_VERSION } from "@/lib/insightTypes";
import { hashCorpus } from "@/lib/insightCache";
import type { InsightCluster } from "@/lib/noteGraph";
import type { InsightStreamEvent } from "@/lib/insightStream";

import type { InsightFeedbackEntry } from "@/lib/insightFeedback";
import { formatFeedbackForAi } from "@/lib/insightFeedback";
import { apiFetch } from "@/lib/apiClient";

export async function fetchInsightBuildStream(
  notes: NoteCorpusItem[],
  onEvent: (event: InsightStreamEvent) => void,
  feedback: InsightFeedbackEntry[] = [],
  apiKey?: string
): Promise<InsightBuildResult> {
  const feedbackContext = formatFeedbackForAi(feedback);

  const resp = await apiFetch("/api/ai/insight-build/stream", {
    method: "POST",
    apiKey,
    body: JSON.stringify({
      notes: notes.map((n) => ({
        id: n.id,
        bookId: n.bookId,
        bookTitle: n.bookTitle,
        text: n.text,
        type: n.type,
      })),
      feedbackContext,
    }),
  });

  if (!resp.ok || !resp.body) {
    const err = await resp.text();
    throw new Error(err.slice(0, 200) || "流式分析失败");
  }

  const pairs: EnrichedInsightPair[] = [];
  const clusters: InsightCluster[] = [];
  const seenPair = new Set<string>();
  const seenCluster = new Set<string>();

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.trim()) continue;
      let event: InsightStreamEvent;
      try {
        event = JSON.parse(line) as InsightStreamEvent;
      } catch {
        continue;
      }

      if (event.type === "pair" && !seenPair.has(event.pair.id)) {
        seenPair.add(event.pair.id);
        pairs.push(event.pair);
      } else if (event.type === "cluster") {
        const key = event.cluster.nodeIds.sort().join("|");
        if (!seenCluster.has(key)) {
          seenCluster.add(key);
          clusters.push(event.cluster);
        }
      }

      onEvent(event);
    }
  }

  if (buffer.trim()) {
    try {
      const event = JSON.parse(buffer) as InsightStreamEvent;
      if (event.type === "pair" && !seenPair.has(event.pair.id)) {
        pairs.push(event.pair);
      }
      onEvent(event);
    } catch {
      // ignore trailing partial line
    }
  }

  pairs.sort(
    (a, b) => (b.confidence ?? b.score) - (a.confidence ?? a.score)
  );

  return {
    pairs,
    clusters,
    builtAt: Date.now(),
    version: INSIGHT_CACHE_VERSION,
    corpusHash: hashCorpus(notes),
  };
}

/** @deprecated 使用 fetchInsightBuildStream */
export async function fetchInsightBuild(
  notes: NoteCorpusItem[],
  onProgress?: (stage: InsightBuildStage, message: string) => void
): Promise<InsightBuildResult> {
  return fetchInsightBuildStream(notes, (ev) => {
    if (ev.type === "stage") {
      const stageMap: Record<string, InsightBuildStage> = {
        embedding: "embedding",
        matching: "embedding",
        analyzing: "clustering",
      };
      onProgress?.(stageMap[ev.stage] ?? "clustering", ev.message);
    } else if (ev.type === "done") {
      onProgress?.("done", "分析完成");
    }
  });
}
