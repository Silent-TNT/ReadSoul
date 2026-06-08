import type { EnrichedInsightPair } from "@/lib/insightTypes";

const DISPLAY_SEED_KEY = "readsoul_insight_display_seed";

function pairScore(p: EnrichedInsightPair): number {
  return p.confidence ?? p.score ?? 0;
}

/** 限制单条划线在列表中的出现次数，避免同一笔记反复配对 */
export function limitNoteExposure<T extends {
  source: { id: string };
  target: { id: string };
  score?: number;
  confidence?: number;
}>(pairs: T[], maxPerNote = 2): T[] {
  const noteCount = new Map<string, number>();
  const sorted = [...pairs].sort((a, b) => pairScore(b as EnrichedInsightPair) - pairScore(a as EnrichedInsightPair));
  const out: T[] = [];

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

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithSeed<T>(items: T[], seedStr: string): T[] {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash * 31 + seedStr.charCodeAt(i)) | 0;
  }
  const rand = mulberry32(hash);
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** 每次进入页面生成新种子，同一会话内保持稳定 */
export function getOrCreateDisplaySeed(corpusHash: string): string {
  if (typeof sessionStorage === "undefined") return corpusHash;
  const key = `${DISPLAY_SEED_KEY}:${corpusHash}`;
  try {
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const seed = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    sessionStorage.setItem(key, seed);
    return seed;
  } catch {
    return `${corpusHash}-${Date.now()}`;
  }
}

export function clearDisplaySeed(corpusHash: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(`${DISPLAY_SEED_KEY}:${corpusHash}`);
  } catch {
    // ignore
  }
}

export function prepareInsightPairsForDisplay(
  pairs: EnrichedInsightPair[],
  corpusHash: string,
  maxPerNote = 2
): EnrichedInsightPair[] {
  const unique = dedupePairIds(pairs);
  const limited = limitNoteExposure(unique, maxPerNote);
  return shuffleWithSeed(limited, getOrCreateDisplaySeed(corpusHash));
}

function dedupePairIds(pairs: EnrichedInsightPair[]): EnrichedInsightPair[] {
  const seen = new Set<string>();
  const out: EnrichedInsightPair[] = [];
  for (const p of pairs) {
    if (seen.has(p.id)) continue;
    seen.add(p.id);
    out.push(p);
  }
  return out;
}
