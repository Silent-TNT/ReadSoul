import type { EnrichedInsightPair } from "@/lib/insightTypes";

const FEEDBACK_KEY = "readsoul_insight_feedback";
const DISMISSED_KEY = "readsoul_dismissed_pairs";

export interface InsightFeedbackEntry {
  pairId: string;
  kind: string;
  theme?: string;
  sourceBookId: string;
  targetBookId: string;
  sourceSnippet: string;
  targetSnippet: string;
  at: number;
}

export function loadDismissedIds(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    if (raw) return new Set(JSON.parse(raw) as string[]);
  } catch {
    // ignore
  }
  return new Set();
}

export function saveDismissedIds(ids: Set<string>): void {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    // ignore
  }
}

export function loadInsightFeedback(): InsightFeedbackEntry[] {
  try {
    const raw = localStorage.getItem(FEEDBACK_KEY);
    if (raw) return JSON.parse(raw) as InsightFeedbackEntry[];
  } catch {
    // ignore
  }
  return [];
}

export function addInsightFeedback(pair: EnrichedInsightPair): InsightFeedbackEntry[] {
  const entry: InsightFeedbackEntry = {
    pairId: pair.id,
    kind: pair.kind,
    theme: pair.theme,
    sourceBookId: pair.source.bookId,
    targetBookId: pair.target.bookId,
    sourceSnippet: pair.source.text.slice(0, 80),
    targetSnippet: pair.target.text.slice(0, 80),
    at: Date.now(),
  };
  const list = loadInsightFeedback().filter((f) => f.pairId !== pair.id);
  list.unshift(entry);
  const trimmed = list.slice(0, 80);
  try {
    localStorage.setItem(FEEDBACK_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore
  }
  return trimmed;
}

/** 与负反馈过于相似的对（同书对 + 相近主题） */
export function isSimilarToFeedback(
  pair: EnrichedInsightPair,
  feedback: InsightFeedbackEntry[]
): boolean {
  for (const f of feedback) {
    if (f.pairId === pair.id) return true;
    const sameBooks =
      (f.sourceBookId === pair.source.bookId &&
        f.targetBookId === pair.target.bookId) ||
      (f.sourceBookId === pair.target.bookId &&
        f.targetBookId === pair.source.bookId);
    if (sameBooks) return true;
    if (
      f.theme &&
      pair.theme &&
      f.kind === pair.kind &&
      (f.theme.includes(pair.theme.slice(0, 4)) ||
        pair.theme.includes(f.theme.slice(0, 4)))
    ) {
      return true;
    }
  }
  return false;
}

export function formatFeedbackForAi(feedback: InsightFeedbackEntry[]): string {
  if (feedback.length === 0) return "";
  const lines = feedback.slice(0, 12).map((f, i) => {
    return `${i + 1}. [${f.kind}] ${f.theme || "无主题"} · 《${f.sourceSnippet.slice(0, 24)}…》↔《${f.targetSnippet.slice(0, 24)}…》`;
  });
  return `【用户标记「不太准」的组合，请避免推荐相似配对】\n${lines.join("\n")}`;
}
