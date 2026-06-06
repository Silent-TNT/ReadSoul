import { NextRequest, NextResponse } from "next/server";
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
import { logApiError } from "@/lib/apiLog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_NOTES = 800;

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

export async function POST(req: NextRequest) {
  let body: { notes?: NoteInput[] };
  try {
    body = (await req.json()) as { notes?: NoteInput[] };
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const rawNotes = body.notes ?? [];
  if (rawNotes.length < 2) {
    return NextResponse.json(
      { error: "至少需要 2 条笔记才能分析" },
      { status: 400 }
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
    return NextResponse.json(
      { error: "未配置 AI_API_KEY" },
      { status: 503 }
    );
  }

  const notes = sampleNotes(rawNotes);

  try {
    let pairs: Awaited<ReturnType<typeof analyzeWithLlm>>["pairs"] = [];
    let clusters: Awaited<ReturnType<typeof analyzeWithLlm>>["clusters"] = [];
    let source = "ai";

    try {
      if (!embedEnabled) {
        source = "llm-only";
        const analyzed = await analyzeLlmOnlyBatches(
          notes,
          apiKey,
          baseUrl,
          model
        );
        pairs = analyzed.pairs;
        clusters = analyzed.clusters;
      } else {
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
      const candidates = buildCandidatePairs(notes, vectors);

      if (candidates.length === 0) {
        const fallback = pairsFromCandidates(notes, []);
        return NextResponse.json({
          source: "embedding-empty",
          pairs: fallback,
          clusters: [],
          version: INSIGHT_CACHE_VERSION,
        });
      }

      const analyzed = await analyzeWithLlm(
        notes,
        candidates,
        apiKey,
        baseUrl,
        model
      );
      pairs = analyzed.pairs;
      clusters = analyzed.clusters;

      if (pairs.length === 0) {
        pairs = pairsFromCandidates(notes, candidates);
      }
      }
    } catch (embedErr) {
      source = "llm-fallback";
      const analyzed = await analyzeLlmOnlyBatches(
        notes,
        apiKey,
        baseUrl,
        model
      );
      pairs = analyzed.pairs;
      clusters = analyzed.clusters;
      if (pairs.length === 0) {
        throw embedErr;
      }
    }

    pairs.sort((a, b) => (b.confidence ?? b.score) - (a.confidence ?? a.score));

    return NextResponse.json({
      source,
      pairs: pairs.slice(0, 120),
      clusters: clusters.slice(0, 20),
      version: INSIGHT_CACHE_VERSION,
    });
  } catch (e) {
    logApiError("/api/ai/insight-build", 502, (e as Error).message);
    return NextResponse.json(
      { error: "观点织网分析失败，请稍后重试" },
      { status: 502 }
    );
  }
}
