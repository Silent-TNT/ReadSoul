import {
  buildGlobalInsightPairs,
  tokenize,
  type NoteCorpusItem,
  type InsightKind,
} from "@/lib/noteLinks";
import {
  buildLocalClusters,
  buildAllEdges,
} from "@/lib/noteGraph";
import {
  toEnrichedPair,
  type EnrichedInsightPair,
  type InsightBuildResult,
  INSIGHT_CACHE_VERSION,
} from "@/lib/insightTypes";
import { hashCorpus } from "@/lib/insightCache";

const NEGATION =
  /不|非|没|无|未|勿|别|否|难以|无法|不能|不应|反对|拒绝|缺乏|避免|禁止|否定|并非|不是|不会|不要|不可|不必/;

/** 倒排索引加速的本地预览关联对 */
export function buildLocalInsightPreview(
  corpus: NoteCorpusItem[],
  pairLimit = 24
): EnrichedInsightPair[] {
  if (corpus.length < 2) return [];

  const capped =
    corpus.length > 400 ? sampleCorpus(corpus, 400) : corpus;

  const pairs = buildGlobalInsightPairsFast(capped, pairLimit);
  return pairs.map((p) =>
    toEnrichedPair(p, "local", {
      theme: p.sharedTerms.slice(0, 3).join(" · ") || undefined,
      confidence: p.score,
    })
  );
}

export function buildLocalInsightResult(
  corpus: NoteCorpusItem[]
): InsightBuildResult {
  const pairs = buildLocalInsightPreview(corpus, 40);
  const capped = corpus.length > 200 ? sampleCorpus(corpus, 200) : corpus;
  const edges = buildAllEdges(capped, { minScore: 0.16, maxEdges: 120 });
  const clusters = buildLocalClusters(capped, edges);

  return {
    pairs,
    clusters,
    builtAt: Date.now(),
    version: INSIGHT_CACHE_VERSION,
    corpusHash: hashCorpus(corpus),
  };
}

function sampleCorpus(corpus: NoteCorpusItem[], max: number): NoteCorpusItem[] {
  const byBook = new Map<string, NoteCorpusItem[]>();
  for (const item of corpus) {
    const list = byBook.get(item.bookId) ?? [];
    list.push(item);
    byBook.set(item.bookId, list);
  }
  const perBook = Math.max(3, Math.floor(max / byBook.size));
  const out: NoteCorpusItem[] = [];
  byBook.forEach((items) => {
    for (const item of items.slice(0, perBook)) {
      if (out.length >= max) return;
      out.push(item);
    }
  });
  return out.length > 0 ? out : corpus.slice(0, max);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  a.forEach((t) => {
    if (b.has(t)) inter++;
  });
  return inter / (a.size + b.size - inter);
}

function sharedTerms(a: Set<string>, b: Set<string>, limit = 4): string[] {
  const out: string[] = [];
  a.forEach((t) => {
    if (b.has(t) && out.length < limit) out.push(t);
  });
  return out;
}

function isOpposingLocal(
  textA: string,
  textB: string,
  overlap: number
): boolean {
  if (overlap < 0.08) return false;
  const negA = NEGATION.test(textA);
  const negB = NEGATION.test(textB);
  if (negA !== negB && overlap >= 0.1) return true;
  const dutyA = /应|该|必须|需要|值得|应当/.test(textA);
  const dutyB = /应|该|必须|需要|值得|应当/.test(textB);
  const avoidA = /不应|不该|不必|不要|避免|切勿|勿/.test(textA);
  const avoidB = /不应|不该|不必|不要|避免|切勿|勿/.test(textB);
  if ((dutyA && avoidB) || (dutyB && avoidA)) return true;
  return false;
}

/** 倒排索引：仅比较共享 token 的笔记对 */
function buildGlobalInsightPairsFast(
  corpus: NoteCorpusItem[],
  limit = 24
): ReturnType<typeof buildGlobalInsightPairs> {
  const inverted = new Map<string, Set<number>>();
  const tokenSets: Set<string>[] = [];

  corpus.forEach((item, idx) => {
    const tokens = tokenize(item.text);
    tokenSets[idx] = tokens;
    tokens.forEach((t) => {
      if (!inverted.has(t)) inverted.set(t, new Set());
      inverted.get(t)!.add(idx);
    });
  });

  const candidatePairs = new Set<string>();
  inverted.forEach((indices) => {
    const arr = Array.from(indices);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const a = Math.min(arr[i], arr[j]);
        const b = Math.max(arr[i], arr[j]);
        candidatePairs.add(`${a}|${b}`);
      }
    }
  });

  const rawPairs: ReturnType<typeof buildGlobalInsightPairs> = [];
  const seen = new Set<string>();

  for (const key of Array.from(candidatePairs)) {
    const [ai, bi] = key.split("|").map(Number);
    const a = corpus[ai];
    const b = corpus[bi];
    if (!a || !b || a.bookId === b.bookId) continue;

    const pairKey = [a.id, b.id].sort().join("|");
    if (seen.has(pairKey)) continue;

    const ta = tokenSets[ai];
    const tb = tokenSets[bi];
    const overlap = jaccard(ta, tb);
    if (overlap < 0.06) continue;

    const opposing = isOpposingLocal(a.text, b.text, overlap);
    const kind: InsightKind = opposing ? "opposing" : "similar";
    if (!opposing && overlap < 0.18) continue;

    seen.add(pairKey);
    rawPairs.push({
      id: [a.id, b.id, kind].sort().join("|"),
      kind,
      score: overlap,
      sharedTerms: sharedTerms(ta, tb),
      source: a,
      target: b,
    });
  }

  rawPairs.sort((x, y) => y.score - x.score);
  return rawPairs.slice(0, limit);
}
