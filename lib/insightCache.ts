import type { NoteCorpusItem } from "@/lib/noteLinks";
import {
  INSIGHT_CACHE_VERSION,
  type InsightBuildResult,
} from "@/lib/insightTypes";

const DB_NAME = "readsoul_insights";
const STORE = "insights";
const TTL_MS =
  (Number(process.env.NEXT_PUBLIC_INSIGHT_CACHE_TTL_DAYS) || 7) *
  24 *
  60 *
  60 *
  1000;

export function hashCorpus(corpus: NoteCorpusItem[]): string {
  const payload = corpus
    .map((c) => `${c.id}:${c.text.slice(0, 32)}`)
    .sort()
    .join("\n");
  let h = 5381;
  for (let i = 0; i < payload.length; i++) {
    h = (h * 33) ^ payload.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
  });
}

export async function getInsightCache(
  corpus: NoteCorpusItem[]
): Promise<InsightBuildResult | null> {
  if (corpus.length === 0) return null;
  const hash = hashCorpus(corpus);
  try {
    const db = await openDb();
    const result = await new Promise<InsightBuildResult | null>(
      (resolve, reject) => {
        const tx = db.transaction(STORE, "readonly");
        const store = tx.objectStore(STORE);
        const req = store.get(hash);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const data = req.result as InsightBuildResult | undefined;
          resolve(data ?? null);
        };
      }
    );
    db.close();
    if (!result) return null;
    if (result.version !== INSIGHT_CACHE_VERSION) return null;
    if (Date.now() - result.builtAt > TTL_MS) return null;
    if (result.corpusHash !== hash) return null;
    return result;
  } catch {
    return null;
  }
}

export async function setInsightCache(
  result: InsightBuildResult
): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.put(result, result.corpusHash);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
    db.close();
  } catch {
    // ignore persistence errors
  }
}

export async function clearInsightCache(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.clear();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
    db.close();
  } catch {
    // ignore
  }
}

/** 供 ChatDrawer 注入的简短摘要 */
export function formatInsightContext(result: InsightBuildResult): string {
  const opposing = result.pairs.filter((p) => p.kind === "opposing").slice(0, 8);
  const similar = result.pairs.filter((p) => p.kind === "similar").slice(0, 6);
  const lines: string[] = [];

  if (opposing.length > 0) {
    lines.push("【观点碰撞（已分析）】");
    opposing.forEach((p, i) => {
      lines.push(
        `${i + 1}. 《${p.source.bookTitle}》「${p.source.text.slice(0, 80)}」↔《${p.target.bookTitle}》「${p.target.text.slice(0, 80)}」${p.theme ? ` 主题：${p.theme}` : ""}`
      );
    });
  }
  if (similar.length > 0) {
    lines.push("【观点共鸣（已分析）】");
    similar.forEach((p, i) => {
      lines.push(
        `${i + 1}. 《${p.source.bookTitle}》↔《${p.target.bookTitle}》${p.theme ? ` 主题：${p.theme}` : ""}`
      );
    });
  }
  if (result.clusters.length > 0) {
    lines.push("【主题群】");
    result.clusters.slice(0, 6).forEach((c, i) => {
      lines.push(`${i + 1}. ${c.kind === "debate" ? "碰撞" : "共鸣"}·${c.theme}${c.summary ? `：${c.summary}` : ""}`);
    });
  }
  return lines.join("\n");
}

export async function loadInsightContextForChat(
  corpus: NoteCorpusItem[]
): Promise<string> {
  const cached = await getInsightCache(corpus);
  if (!cached) return "";
  return formatInsightContext(cached);
}
