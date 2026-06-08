import type { InsightKind } from "@/lib/noteLinks";
import type { InsightCluster, ClusterSide } from "@/lib/noteGraph";
import type { EnrichedInsightPair } from "@/lib/insightTypes";
import { INSIGHT_CACHE_VERSION, toEnrichedPair } from "@/lib/insightTypes";

export interface NoteInput {
  id: string;
  bookId: string;
  bookTitle: string;
  text: string;
  type?: "mark" | "review";
}

const NEGATION =
  /不|非|没|无|未|勿|别|否|难以|无法|不能|不应|反对|拒绝|缺乏|避免|禁止|否定|并非|不是|不会|不要|不可|不必/;

export function isEmbeddingConfigured(): boolean {
  const embedModel = process.env.AI_EMBED_MODEL?.trim();
  const embedBase = process.env.AI_EMBED_BASE_URL?.trim();
  const chatBase = (process.env.AI_BASE_URL || "").replace(/\/$/, "");

  if (embedBase) return true;
  if (embedModel) return true;
  if (/openai\.com/i.test(chatBase)) return true;
  return false;
}

function resolveEmbedModel(embedBaseUrl: string, explicit?: string): string {
  if (explicit) return explicit;
  if (/siliconflow\.cn/i.test(embedBaseUrl)) {
    return "Qwen/Qwen3-Embedding-0.6B";
  }
  if (/openai\.com/i.test(embedBaseUrl)) return "text-embedding-3-small";
  return "text-embedding-3-small";
}

export function getAiConfig() {
  const apiKey = process.env.AI_API_KEY;
  const baseUrl = (process.env.AI_BASE_URL || "https://api.deepseek.com/v1").replace(
    /\/$/,
    ""
  );
  const model = process.env.AI_MODEL || "deepseek-chat";
  const embedEnabled = isEmbeddingConfigured();
  const embedBaseUrl = (
    process.env.AI_EMBED_BASE_URL?.trim() || baseUrl
  ).replace(/\/$/, "");
  const embedModel = embedEnabled
    ? resolveEmbedModel(embedBaseUrl, process.env.AI_EMBED_MODEL?.trim())
    : "";
  const embedApiKey =
    process.env.AI_EMBED_API_KEY?.trim() || apiKey;
  const embedDimensions = Number(process.env.AI_EMBED_DIMENSIONS) || 0;
  const embedBatch = Number(process.env.INSIGHT_BUILD_BATCH) || 64;
  return {
    apiKey,
    baseUrl,
    model,
    embedModel,
    embedBaseUrl,
    embedApiKey,
    embedDimensions,
    embedEnabled,
    embedBatch,
  };
}

export async function embedTexts(
  texts: string[],
  apiKey: string,
  baseUrl: string,
  model: string,
  batchSize: number,
  dimensions = 0
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const chunk = texts.slice(i, i + batchSize);
    const body: Record<string, unknown> = { model, input: chunk };
    if (dimensions > 0) body.dimensions = dimensions;

    const resp = await fetch(`${baseUrl}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    if (!resp.ok) {
      const t = await resp.text();
      throw new Error(`Embedding 失败(${resp.status})：${t.slice(0, 160)}`);
    }
    const data = await resp.json();
    const items = data?.data as { embedding: number[]; index: number }[];
    if (!Array.isArray(items)) throw new Error("Embedding 响应格式异常");
    items.sort((a, b) => a.index - b.index);
    vectors.push(...items.map((x) => x.embedding));
  }
  return vectors;
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

export interface CandidatePair {
  aIdx: number;
  bIdx: number;
  score: number;
  likelyOpposing: boolean;
}

export function buildCandidatePairs(
  notes: NoteInput[],
  vectors: number[][],
  topK = 4
): CandidatePair[] {
  const pairs: CandidatePair[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < notes.length; i++) {
    const scored: { j: number; score: number }[] = [];
    for (let j = 0; j < notes.length; j++) {
      if (i === j) continue;
      if (notes[i].bookId === notes[j].bookId) continue;
      const score = cosine(vectors[i], vectors[j]);
      if (score < 0.45) continue;
      scored.push({ j, score });
    }
    scored.sort((x, y) => y.score - x.score);
    for (const { j, score } of scored.slice(0, topK)) {
      const key = [i, j].sort((x, y) => x - y).join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const ai = Math.min(i, j);
      const bi = Math.max(i, j);
      const negA = NEGATION.test(notes[ai].text);
      const negB = NEGATION.test(notes[bi].text);
      pairs.push({
        aIdx: ai,
        bIdx: bi,
        score,
        likelyOpposing: negA !== negB && score >= 0.48,
      });
    }
  }

  pairs.sort((x, y) => y.score - x.score);
  return diversifyCandidatePairs(pairs, 2, 60);
}

/** 每条笔记最多参与 maxPerNote 个候选对，减少重复嵌入与 LLM 分析 */
export function diversifyCandidatePairs(
  pairs: CandidatePair[],
  maxPerNote = 2,
  limit = 60
): CandidatePair[] {
  const noteUse = new Map<number, number>();
  const out: CandidatePair[] = [];

  for (const p of pairs) {
    const ua = noteUse.get(p.aIdx) ?? 0;
    const ub = noteUse.get(p.bIdx) ?? 0;
    if (ua >= maxPerNote || ub >= maxPerNote) continue;
    out.push(p);
    noteUse.set(p.aIdx, ua + 1);
    noteUse.set(p.bIdx, ub + 1);
    if (out.length >= limit) break;
  }

  return out;
}

function extractJson(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]) as Record<string, unknown>;
      } catch {
        return {};
      }
    }
    return {};
  }
}

export async function analyzeWithLlm(
  notes: NoteInput[],
  candidatePairs: CandidatePair[],
  apiKey: string,
  baseUrl: string,
  model: string,
  feedbackContext = ""
): Promise<{ pairs: EnrichedInsightPair[]; clusters: InsightCluster[] }> {
  const pairLines = candidatePairs.slice(0, 60).map((p, idx) => {
    const a = notes[p.aIdx];
    const b = notes[p.bIdx];
    return `[P${idx + 1}] idA=${a.id} idB=${b.id} score=${p.score.toFixed(2)} likelyOpposing=${p.likelyOpposing}
A《${a.bookTitle}》：${a.text.slice(0, 160)}
B《${b.bookTitle}》：${b.text.slice(0, 160)}`;
  });

  const noteSample = notes.slice(0, 120).map(
    (n, i) =>
      `[N${i + 1}] id=${n.id}\n《${n.bookTitle}》：${n.text.slice(0, 140)}`
  );

  const prompt = `你是阅读笔记关联分析师。根据候选笔记对与笔记列表，输出 JSON（不要 markdown）：
{
  "pairs":[{"noteIds":["idA","idB"],"kind":"similar|opposing","theme":"","reflectionPrompt":"","confidence":0.0-1.0}],
  "clusters":[{"theme":"","kind":"resonance|debate","summary":"","noteIds":[],"sides":[{"label":"","noteIds":[]}]}]
}

规则：
- pairs 只使用候选对中的 id，kind 判断要准确；confidence 低于 0.6 的不要输出
- reflectionPrompt 必须是开放式问题，激发思考
- clusters 每组至少2条 noteIds，debate 需 sides 两派
- 最多 40 pairs、12 clusters
${feedbackContext ? `\n${feedbackContext}\n` : ""}

【候选对】
${pairLines.join("\n\n")}

【笔记样本】
${noteSample.join("\n\n")}`;

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.35,
      messages: [
        {
          role: "system",
          content: "只输出 JSON 对象，不要解释。",
        },
        { role: "user", content: prompt },
      ],
    }),
    cache: "no-store",
  });

  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`LLM 分析失败(${resp.status})：${t.slice(0, 160)}`);
  }

  const data = await resp.json();
  const content: string = data?.choices?.[0]?.message?.content ?? "{}";
  const parsed = extractJson(content);

  const noteMap = new Map(notes.map((n) => [n.id, n]));
  const pairs: EnrichedInsightPair[] = [];
  const pairArr = Array.isArray(parsed.pairs) ? parsed.pairs : [];
  const seenNotePair = new Set<string>();

  pairArr.forEach((raw, idx) => {
    const item = raw as Record<string, unknown>;
    const ids = Array.isArray(item.noteIds) ? (item.noteIds as string[]) : [];
    if (ids.length < 2) return;
    const source = noteMap.get(ids[0]);
    const target = noteMap.get(ids[1]);
    if (!source || !target) return;
    if (source.bookId === target.bookId) return;
    const kind = (item.kind === "opposing" ? "opposing" : "similar") as InsightKind;
    const id = [ids[0], ids[1], kind].sort().join("|");
    if (seenNotePair.has(id)) return;
    seenNotePair.add(id);
    pairs.push(
      toEnrichedPair(
        {
          id,
          kind,
          score: typeof item.confidence === "number" ? item.confidence : 0.7,
          sharedTerms: [],
          source: {
            id: source.id,
            bookId: source.bookId,
            bookTitle: source.bookTitle,
            text: source.text,
            type: source.type ?? "mark",
          },
          target: {
            id: target.id,
            bookId: target.bookId,
            bookTitle: target.bookTitle,
            text: target.text,
            type: target.type ?? "mark",
          },
        },
        "ai",
        {
          theme: typeof item.theme === "string" ? item.theme : undefined,
          reflectionPrompt:
            typeof item.reflectionPrompt === "string"
              ? item.reflectionPrompt
              : undefined,
          confidence:
            typeof item.confidence === "number" ? item.confidence : 0.7,
        }
      )
    );
  });

  const clusters: InsightCluster[] = [];
  const clusterArr = Array.isArray(parsed.clusters) ? parsed.clusters : [];
  clusterArr.forEach((raw, idx) => {
    const item = raw as Record<string, unknown>;
    const nodeIds = (Array.isArray(item.noteIds)
      ? (item.noteIds as string[])
      : []
    ).filter((id) => noteMap.has(id));
    if (nodeIds.length < 2) return;
    const sidesRaw = Array.isArray(item.sides) ? item.sides : [];
    const sides: ClusterSide[] = sidesRaw
      .map((s) => {
        const side = s as Record<string, unknown>;
        return {
          label: typeof side.label === "string" ? side.label : "",
          nodeIds: (Array.isArray(side.noteIds)
            ? (side.noteIds as string[])
            : []
          ).filter((id) => noteMap.has(id)),
        };
      })
      .filter((s) => s.nodeIds.length > 0);

    clusters.push({
      id: `ai-${idx}`,
      kind: item.kind === "debate" ? "debate" : "resonance",
      theme: typeof item.theme === "string" ? item.theme : "阅读思考",
      summary: typeof item.summary === "string" ? item.summary : undefined,
      nodeIds,
      sides: sides.length >= 2 ? sides : undefined,
      source: "ai",
    });
  });

  return { pairs: limitNoteExposureInPairs(pairs, 2), clusters };
}

function limitNoteExposureInPairs(
  pairs: EnrichedInsightPair[],
  maxPerNote: number
): EnrichedInsightPair[] {
  const noteCount = new Map<string, number>();
  const sorted = [...pairs].sort(
    (a, b) => (b.confidence ?? b.score) - (a.confidence ?? a.score)
  );
  const out: EnrichedInsightPair[] = [];
  for (const p of sorted) {
    const sc = noteCount.get(p.source.id) ?? 0;
    const tc = noteCount.get(p.target.id) ?? 0;
    if (sc >= maxPerNote || tc >= maxPerNote) continue;
    out.push(p);
    noteCount.set(p.source.id, sc + 1);
    noteCount.set(p.target.id, tc + 1);
  }
  return out;
}

/** LLM-only 降级：无 Embedding 时分批聚类 */
export async function analyzeLlmOnlyBatches(
  notes: NoteInput[],
  apiKey: string,
  baseUrl: string,
  model: string,
  feedbackContext = ""
): Promise<{ pairs: EnrichedInsightPair[]; clusters: InsightCluster[] }> {
  const BATCH = 45;
  const allPairs: EnrichedInsightPair[] = [];
  const allClusters: InsightCluster[] = [];
  const sample = notes.slice(0, 180);

  for (let i = 0; i < sample.length; i += BATCH) {
    const chunk = sample.slice(i, i + BATCH);
    if (chunk.length < 2) continue;

    const candidates: CandidatePair[] = [];
    const limit = Math.min(chunk.length, 12);
    for (let a = 0; a < limit; a++) {
      for (let b = a + 1; b < limit; b++) {
        candidates.push({
          aIdx: i + a,
          bIdx: i + b,
          score: 0.5,
          likelyOpposing:
            NEGATION.test(chunk[a].text) !== NEGATION.test(chunk[b].text),
        });
      }
    }

    const { pairs, clusters } = await analyzeWithLlm(
      sample,
      candidates.slice(0, 30),
      apiKey,
      baseUrl,
      model,
      i === 0 ? feedbackContext : ""
    );
    allPairs.push(...pairs);
    allClusters.push(...clusters);
  }

  const seenPairs = new Set<string>();
  const dedupedPairs = allPairs.filter((p) => {
    if (seenPairs.has(p.id)) return false;
    seenPairs.add(p.id);
    return true;
  });

  const seenClusters = new Set<string>();
  const dedupedClusters = allClusters.filter((c) => {
    const key = c.nodeIds.sort().join("|");
    if (seenClusters.has(key)) return false;
    seenClusters.add(key);
    return true;
  });

  return { pairs: limitNoteExposureInPairs(dedupedPairs, 2), clusters: dedupedClusters };
}

export function pairsFromCandidates(
  notes: NoteInput[],
  candidates: CandidatePair[]
): EnrichedInsightPair[] {
  return candidates.slice(0, 80).map((p) => {
    const a = notes[p.aIdx];
    const b = notes[p.bIdx];
    const kind: InsightKind = p.likelyOpposing ? "opposing" : "similar";
    return toEnrichedPair(
      {
        id: [a.id, b.id, kind].sort().join("|"),
        kind,
        score: p.score,
        sharedTerms: [],
        source: {
          id: a.id,
          bookId: a.bookId,
          bookTitle: a.bookTitle,
          text: a.text,
          type: a.type ?? "mark",
        },
        target: {
          id: b.id,
          bookId: b.bookId,
          bookTitle: b.bookTitle,
          text: b.text,
          type: b.type ?? "mark",
        },
      },
      "ai",
      { confidence: p.score }
    );
  });
}

export { INSIGHT_CACHE_VERSION };
