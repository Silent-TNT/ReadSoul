import { NextRequest } from "next/server";
import {
  getAiConfig,
  embedTexts,
  buildCandidatePairs,
  analyzeWithLlm,
  analyzeLlmOnlyBatches,
  pairsFromCandidates,
  INSIGHT_CACHE_VERSION,
  type NoteInput,
} from "@/lib/insightAiServer";
import type { EnrichedInsightPair } from "@/lib/insightTypes";
import {
  encodeStreamEvent,
  type InsightStreamEvent,
} from "@/lib/insightStream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_NOTES = 800;
const LLM_CHUNK = 20;

function sampleNotes(notes: NoteInput[]): NoteInput[] {
  if (notes.length <= MAX_NOTES) return notes;
  const byBook = new Map<string, NoteInput[]>();
  for (const n of notes) {
    const list = byBook.get(n.bookId) ?? [];
    list.push(n);
    byBook.set(n.bookId, list);
  }
  const perBook = Math.max(4, Math.floor(MAX_NOTES / byBook.size));
  const out: NoteInput[] = [];
  byBook.forEach((items) => {
    for (const item of items.slice(0, perBook)) {
      if (out.length >= MAX_NOTES) return;
      out.push(item);
    }
  });
  return out.length > 0 ? out : notes.slice(0, MAX_NOTES);
}

function emit(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: InsightStreamEvent
) {
  controller.enqueue(encoder.encode(encodeStreamEvent(event)));
}

export async function POST(req: NextRequest) {
  let body: { notes?: NoteInput[]; feedbackContext?: string };
  try {
    body = (await req.json()) as {
      notes?: NoteInput[];
      feedbackContext?: string;
    };
  } catch {
    return new Response(
      encodeStreamEvent({ type: "error", error: "请求体不是合法 JSON" }),
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  const rawNotes = body.notes ?? [];
  if (rawNotes.length < 2) {
    return new Response(
      encodeStreamEvent({ type: "error", error: "至少需要 2 条笔记" }),
      { status: 400, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  const {
    apiKey,
    baseUrl,
    model,
    embedModel,
    embedBaseUrl,
    embedApiKey,
    embedDimensions,
    embedEnabled,
    embedBatch,
  } = getAiConfig();
  if (!apiKey) {
    return new Response(
      encodeStreamEvent({ type: "error", error: "未配置 AI_API_KEY" }),
      { status: 503, headers: { "Content-Type": "application/x-ndjson" } }
    );
  }

  const notes = sampleNotes(rawNotes);
  const feedbackContext = body.feedbackContext?.trim() ?? "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const seenPairIds = new Set<string>();
      const seenClusterKeys = new Set<string>();
      let pairCount = 0;
      let clusterCount = 0;

      const pushPair = (pair: EnrichedInsightPair) => {
        if (seenPairIds.has(pair.id)) return;
        seenPairIds.add(pair.id);
        pairCount++;
        emit(controller, encoder, { type: "pair", pair });
      };

      try {
        let candidates: ReturnType<typeof buildCandidatePairs> = [];

        const runLlmOnly = async (message: string, progress: number) => {
          emit(controller, encoder, {
            type: "stage",
            stage: "analyzing",
            message,
            progress,
          });
          const { pairs, clusters } = await analyzeLlmOnlyBatches(
            notes,
            apiKey,
            baseUrl,
            model,
            feedbackContext
          );
          for (const pair of pairs) pushPair(pair);
          for (const cluster of clusters) {
            const key = [...cluster.nodeIds].sort().join("|");
            if (seenClusterKeys.has(key)) continue;
            seenClusterKeys.add(key);
            clusterCount++;
            emit(controller, encoder, { type: "cluster", cluster });
          }
        };

        if (!embedEnabled) {
          await runLlmOnly("AI 逐组分析观点…", 0.35);
        } else {
        emit(controller, encoder, {
          type: "stage",
          stage: "embedding",
          message: "正在理解你的划线…",
          progress: 0.1,
        });
        try {
          const texts = notes.map((n) =>
            `${n.bookTitle}：${n.text}`.slice(0, 512)
          );
          const vectors = await embedTexts(
            texts,
            embedApiKey ?? apiKey,
            embedBaseUrl,
            embedModel,
            embedBatch,
            embedDimensions
          );

          emit(controller, encoder, {
            type: "stage",
            stage: "matching",
            message: "正在寻找跨书关联…",
            progress: 0.35,
          });

          candidates = buildCandidatePairs(notes, vectors);

          emit(controller, encoder, {
            type: "stage",
            stage: "analyzing",
            message: "AI 逐组分析观点…",
            progress: 0.5,
          });

          const totalChunks = Math.max(
            1,
            Math.ceil(Math.min(candidates.length, 80) / LLM_CHUNK)
          );

          for (let i = 0; i < Math.min(candidates.length, 80); i += LLM_CHUNK) {
            const chunk = candidates.slice(i, i + LLM_CHUNK);
            const chunkIdx = Math.floor(i / LLM_CHUNK);
            emit(controller, encoder, {
              type: "stage",
              stage: "analyzing",
              message: `AI 分析中（${chunkIdx + 1}/${totalChunks} 批）…`,
              progress: 0.5 + (0.4 * (chunkIdx + 1)) / totalChunks,
            });

            const { pairs, clusters } = await analyzeWithLlm(
              notes,
              chunk,
              apiKey,
              baseUrl,
              model,
              chunkIdx === 0 ? feedbackContext : ""
            );

            for (const pair of pairs) pushPair(pair);

            for (const cluster of clusters) {
              const key = [...cluster.nodeIds].sort().join("|");
              if (seenClusterKeys.has(key)) continue;
              seenClusterKeys.add(key);
              clusterCount++;
              emit(controller, encoder, { type: "cluster", cluster });
            }
          }

          if (pairCount === 0 && candidates.length > 0) {
            for (const pair of pairsFromCandidates(notes, candidates).slice(0, 12)) {
              pushPair(pair);
            }
          }
        } catch {
          await runLlmOnly("AI 逐组分析观点…", 0.4);
        }
        }

        emit(controller, encoder, {
          type: "done",
          pairCount,
          clusterCount,
        });
      } catch (e) {
        emit(controller, encoder, {
          type: "error",
          error: (e as Error).message,
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache",
      "X-Insight-Version": String(INSIGHT_CACHE_VERSION),
    },
  });
}
