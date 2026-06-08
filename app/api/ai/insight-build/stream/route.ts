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
  type CandidatePair,
} from "@/lib/insightAiServer";
import type { EnrichedInsightPair } from "@/lib/insightTypes";
import {
  encodeStreamEvent,
  type InsightStreamEvent,
} from "@/lib/insightStream";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const LLM_CHUNK = 8;
const INITIAL_SIMILAR = 3;
const INITIAL_OPPOSING = 3;
const MIN_CONFIDENCE = 0.63;
const MAX_CONTINUE_CANDIDATES = 48;

function emit(
  controller: ReadableStreamDefaultController<Uint8Array>,
  encoder: TextEncoder,
  event: InsightStreamEvent
) {
  controller.enqueue(encoder.encode(encodeStreamEvent(event)));
}

function pairQuality(pair: EnrichedInsightPair): number {
  return pair.confidence ?? pair.score ?? 0;
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

  const notes = body.notes ?? [];
  if (notes.length < 2) {
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

  const feedbackContext = body.feedbackContext?.trim() ?? "";
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const seenPairIds = new Set<string>();
      const seenClusterKeys = new Set<string>();
      const noteUsage = new Map<string, number>();
      let pairCount = 0;
      let clusterCount = 0;
      let qualitySimilar = 0;
      let qualityOpposing = 0;
      let initialReadyEmitted = false;

      const pushPair = (
        pair: EnrichedInsightPair,
        opts: { requireQuality?: boolean; maxNoteUse?: number } = {}
      ): boolean => {
        const requireQuality = opts.requireQuality ?? false;
        const maxNoteUse = opts.maxNoteUse ?? 2;
        if (seenPairIds.has(pair.id)) return false;
        if (requireQuality && pairQuality(pair) < MIN_CONFIDENCE) return false;

        const su = noteUsage.get(pair.source.id) ?? 0;
        const tu = noteUsage.get(pair.target.id) ?? 0;
        if (su >= maxNoteUse || tu >= maxNoteUse) return false;

        seenPairIds.add(pair.id);
        noteUsage.set(pair.source.id, su + 1);
        noteUsage.set(pair.target.id, tu + 1);
        pairCount++;

        if (pairQuality(pair) >= MIN_CONFIDENCE) {
          if (pair.kind === "similar") qualitySimilar++;
          else qualityOpposing++;
        }

        emit(controller, encoder, { type: "pair", pair });
        return true;
      };

      const maybeInitialReady = () => {
        if (initialReadyEmitted) return;
        if (
          qualitySimilar >= INITIAL_SIMILAR &&
          qualityOpposing >= INITIAL_OPPOSING
        ) {
          initialReadyEmitted = true;
          emit(controller, encoder, {
            type: "initial_ready",
            similarCount: qualitySimilar,
            opposingCount: qualityOpposing,
          });
        }
      };

      async function analyzePool(
        pool: CandidatePair[],
        kind: "similar" | "opposing",
        target: number,
        message: string,
        progressFrom: number,
        progressTo: number
      ) {
        let found = 0;
        const totalSteps = Math.max(1, Math.ceil(pool.length / LLM_CHUNK));

        for (let i = 0; i < pool.length && found < target; i += LLM_CHUNK) {
          const chunk = pool.slice(i, i + LLM_CHUNK);
          const step = Math.floor(i / LLM_CHUNK);
          emit(controller, encoder, {
            type: "stage",
            stage: "analyzing",
            message,
            progress:
              progressFrom +
              ((progressTo - progressFrom) * (step + 1)) / totalSteps,
          });

          const { pairs } = await analyzeWithLlm(
            notes,
            chunk,
            apiKey,
            baseUrl,
            model,
            i === 0 ? feedbackContext : ""
          );

          for (const pair of pairs) {
            if (pair.kind !== kind) continue;
            if (pushPair(pair, { requireQuality: true, maxNoteUse: 1 })) {
              if (pairQuality(pair) >= MIN_CONFIDENCE) found++;
            }
            maybeInitialReady();
            if (found >= target) break;
          }
        }
      }

      async function analyzeRemaining(
        pool: CandidatePair[],
        includeClusters: boolean
      ) {
        const unseen = pool.filter((c) => {
          const a = notes[c.aIdx];
          const b = notes[c.bIdx];
          if (!a || !b) return false;
          const id = [a.id, b.id, c.likelyOpposing ? "opposing" : "similar"]
            .sort()
            .join("|");
          return !seenPairIds.has(id);
        });

        const totalSteps = Math.max(
          1,
          Math.ceil(
            Math.min(unseen.length, MAX_CONTINUE_CANDIDATES) / LLM_CHUNK
          )
        );

        for (
          let i = 0;
          i < Math.min(unseen.length, MAX_CONTINUE_CANDIDATES);
          i += LLM_CHUNK
        ) {
          const chunk = unseen.slice(i, i + LLM_CHUNK);
          const step = Math.floor(i / LLM_CHUNK);
          emit(controller, encoder, {
            type: "stage",
            stage: "analyzing",
            message: "后台继续扩充更多对照…",
            progress: 0.72 + (0.25 * (step + 1)) / totalSteps,
          });

          const { pairs, clusters } = await analyzeWithLlm(
            notes,
            chunk,
            apiKey,
            baseUrl,
            model,
            ""
          );

          for (const pair of pairs) {
            pushPair(pair, { requireQuality: true });
          }

          if (includeClusters) {
            for (const cluster of clusters) {
              const key = [...cluster.nodeIds].sort().join("|");
              if (seenClusterKeys.has(key)) continue;
              seenClusterKeys.add(key);
              clusterCount++;
              emit(controller, encoder, { type: "cluster", cluster });
            }
          }
        }
      }

      try {
        let candidates: CandidatePair[] = [];

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
          for (const pair of pairs.slice(0, INITIAL_SIMILAR + INITIAL_OPPOSING)) {
            pushPair(pair, { requireQuality: false, maxNoteUse: 1 });
          }
          maybeInitialReady();
          if (!initialReadyEmitted) {
            initialReadyEmitted = true;
            emit(controller, encoder, {
              type: "initial_ready",
              similarCount: qualitySimilar,
              opposingCount: qualityOpposing,
            });
          }
          for (const pair of pairs.slice(INITIAL_SIMILAR + INITIAL_OPPOSING)) {
            pushPair(pair, { requireQuality: true });
          }
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
            message: `正在理解 ${notes.length} 条划线…`,
            progress: 0.08,
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
              message: "正在筛选高质量跨书关联…",
              progress: 0.28,
            });

            candidates = buildCandidatePairs(notes, vectors);
            const opposingPool = candidates.filter((c) => c.likelyOpposing);
            const similarPool = candidates.filter((c) => !c.likelyOpposing);

            await analyzePool(
              opposingPool,
              "opposing",
              INITIAL_OPPOSING,
              "精选对立观点…",
              0.32,
              0.48
            );
            await analyzePool(
              similarPool,
              "similar",
              INITIAL_SIMILAR,
              "精选相似观点…",
              0.48,
              0.64
            );

            if (!initialReadyEmitted) {
              initialReadyEmitted = true;
              emit(controller, encoder, {
                type: "initial_ready",
                similarCount: qualitySimilar,
                opposingCount: qualityOpposing,
              });
            }

            await analyzeRemaining(candidates, true);

            if (pairCount === 0 && candidates.length > 0) {
              for (const pair of pairsFromCandidates(notes, candidates).slice(
                0,
                6
              )) {
                pushPair(pair, { requireQuality: false, maxNoteUse: 1 });
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
