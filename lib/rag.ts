import { tokenize, type NoteCorpusItem } from "@/lib/noteLinks";

export interface RagChunk {
  id: string;
  bookTitle: string;
  text: string;
  score: number;
}

/** 基于词重叠的轻量 RAG 检索（本地，无需向量库） */
export function retrieveNotes(
  corpus: NoteCorpusItem[],
  query: string,
  topK = 8
): RagChunk[] {
  const qTokens = tokenize(query);
  if (qTokens.size === 0) return [];

  const scored: RagChunk[] = [];
  for (const note of corpus) {
    const nTokens = tokenize(note.text);
    if (nTokens.size === 0) continue;
    let inter = 0;
    qTokens.forEach((t) => {
      if (nTokens.has(t)) inter++;
    });
    if (inter === 0) {
      // 子串兜底
      const q = query.trim();
      if (q.length >= 2 && note.text.includes(q)) {
        scored.push({ id: note.id, bookTitle: note.bookTitle, text: note.text, score: 0.35 });
      }
      continue;
    }
    const score = inter / Math.sqrt(qTokens.size * nTokens.size);
    if (score >= 0.08) {
      scored.push({
        id: note.id,
        bookTitle: note.bookTitle,
        text: note.text,
        score,
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topK);
}

export function formatRagContext(chunks: RagChunk[]): string {
  if (chunks.length === 0) return "";
  const lines = chunks.map(
    (c, i) =>
      `[笔记${i + 1}] 《${c.bookTitle}》\n${c.text.slice(0, 400)}`
  );
  return `【RAG 检索到的相关划线/想法】\n${lines.join("\n\n")}`;
}

/** 为 AI 构建阅读数据摘要 + RAG */
export function buildAiContext(
  statsContext: string,
  ragChunks: RagChunk[]
): string {
  const parts = [statsContext];
  const rag = formatRagContext(ragChunks);
  if (rag) parts.push(rag);
  return parts.join("\n\n");
}
