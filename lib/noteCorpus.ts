import { fetchBookmarkList, fetchReviewListMine } from "@/lib/weread";
import {
  corpusFromBookmarks,
  markNoteId,
  type NoteCorpusItem,
} from "@/lib/noteLinks";
import type { NotebookBook } from "@/lib/types";

const BATCH = 5;

async function mapInBatches<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  batchSize = BATCH
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const chunk = items.slice(i, i + batchSize);
    const part = await Promise.all(chunk.map(fn));
    results.push(...part);
  }
  return results;
}

/** 拉取全部有笔记书籍的划线与想法，构建全局语料 */
export async function fetchFullNoteCorpus(
  apiKey: string,
  books: NotebookBook[],
  onProgress?: (msg: string, done: number, total: number) => void
): Promise<NoteCorpusItem[]> {
  const withNotes = books.filter(
    (b) => (b.noteCount ?? 0) > 0 || (b.reviewCount ?? 0) > 0
  );
  const total = withNotes.length;
  let done = 0;

  const bookTitles: Record<string, string> = {};
  const bookmarkRows: {
    bookmarkId?: string;
    bookId: string;
    markText?: string;
  }[] = [];
  const reviewItems: NoteCorpusItem[] = [];

  await mapInBatches(withNotes, async (book) => {
    const title = book.book?.title || "未知书名";
    bookTitles[book.bookId] = title;

    if ((book.noteCount ?? 0) > 0) {
      try {
        const list = await fetchBookmarkList(apiKey, book.bookId);
        if (list.book?.title) bookTitles[book.bookId] = list.book.title;
        for (const m of list.updated ?? []) {
          bookmarkRows.push({ ...m, bookId: book.bookId });
        }
      } catch {
        // 跳过单本失败
      }
    }

    if ((book.reviewCount ?? 0) > 0) {
      try {
        const reviews = await fetchReviewListMine(apiKey, book.bookId);
        for (const r of reviews) {
          const text = (r.content || r.abstract || "").trim();
          if (!text || text.length < 6) continue;
          reviewItems.push({
            id: `review:${r.reviewId || `${book.bookId}-${text.slice(0, 12)}`}`,
            bookId: book.bookId,
            bookTitle: bookTitles[book.bookId] || title,
            text,
            type: "review",
          });
        }
      } catch {
        // 跳过
      }
    }

    done++;
    onProgress?.(`正在加载笔记… ${done}/${total}`, done, total);
  });

  const markItems = corpusFromBookmarks(bookmarkRows, bookTitles);

  const merged = new Map<string, NoteCorpusItem>();
  for (const item of [...markItems, ...reviewItems]) {
    merged.set(item.id, item);
  }
  return Array.from(merged.values());
}

/** 限制语料规模，保证浏览器内分析流畅 */
export function capNoteCorpus(
  items: NoteCorpusItem[],
  maxTotal = 600,
  maxPerBook = 40
): NoteCorpusItem[] {
  const byBook = new Map<string, NoteCorpusItem[]>();
  for (const item of items) {
    const list = byBook.get(item.bookId) ?? [];
    if (list.length < maxPerBook) list.push(item);
    byBook.set(item.bookId, list);
  }
  const capped: NoteCorpusItem[] = [];
  byBook.forEach((list) => {
    for (const item of list) {
      if (capped.length >= maxTotal) return;
      capped.push(item);
    }
  });
  return capped;
}
