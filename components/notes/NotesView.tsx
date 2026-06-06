"use client";

import { useCallback, useMemo, useState } from "react";
import {
  fetchBookmarkList,
  fetchReviewListMine,
  WereadError,
} from "@/lib/weread";
import { bookNoteTotal } from "@/lib/aggregate";
import { wereadReadingLink, formatDate } from "@/lib/format";
import { useThoughts } from "@/hooks/useThoughts";
import Markdown from "@/components/Markdown";
import { apiFetch } from "@/lib/apiClient";
import { ExternalIcon, BookIcon } from "@/components/icons";
import type { NotebookBook, Bookmark, MineReview } from "@/lib/types";

interface Props {
  apiKey: string;
  books: NotebookBook[];
}

interface ChapterGroup {
  title: string;
  idx: number;
  marks: Bookmark[];
}

export default function NotesView({ apiKey, books }: Props) {
  const { thoughts, setThought } = useThoughts();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<NotebookBook | null>(null);

  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [chapters, setChapters] = useState<
    { chapterUid?: number; chapterIdx?: number; title?: string }[]
  >([]);
  const [reviews, setReviews] = useState<MineReview[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  const sortedBooks = useMemo(() => {
    const kw = search.trim().toLowerCase();
    return [...books]
      .filter((b) => {
        if (!kw) return true;
        const t = (b.book?.title || "").toLowerCase();
        const a = (b.book?.author || "").toLowerCase();
        return t.includes(kw) || a.includes(kw);
      })
      .sort((a, b) => bookNoteTotal(b) - bookNoteTotal(a));
  }, [books, search]);

  const loadDetail = useCallback(
    async (book: NotebookBook) => {
      setSelected(book);
      setLoading(true);
      setDetailError("");
      setBookmarks([]);
      setReviews([]);
      setChapters([]);
      setAiText("");
      try {
        const [bm, rv] = await Promise.all([
          fetchBookmarkList(apiKey, book.bookId),
          fetchReviewListMine(apiKey, book.bookId).catch(() => [] as MineReview[]),
        ]);
        setBookmarks(bm.updated ?? []);
        setChapters(bm.chapters ?? []);
        setReviews(rv);
      } catch (e) {
        setDetailError(
          e instanceof WereadError ? e.message : (e as Error).message
        );
      } finally {
        setLoading(false);
      }
    },
    [apiKey]
  );

  const chapterGroups = useMemo<ChapterGroup[]>(() => {
    const titleMap = new Map<number, { title: string; idx: number }>();
    chapters.forEach((c, i) => {
      if (c.chapterUid != null)
        titleMap.set(c.chapterUid, {
          title: c.title || "未命名章节",
          idx: c.chapterIdx ?? i,
        });
    });
    const groups = new Map<number, ChapterGroup>();
    for (const m of bookmarks) {
      const uid = m.chapterUid ?? -1;
      if (!groups.has(uid)) {
        const meta = titleMap.get(uid);
        groups.set(uid, {
          title: meta?.title || "其他",
          idx: meta?.idx ?? 9999,
          marks: [],
        });
      }
      groups.get(uid)!.marks.push(m);
    }
    return Array.from(groups.values()).sort((a, b) => a.idx - b.idx);
  }, [bookmarks, chapters]);

  function exportMarkdown() {
    if (!selected) return;
    const lines: string[] = [];
    lines.push(`# ${selected.book?.title || "未命名"}`);
    if (selected.book?.author) lines.push(`> 作者：${selected.book.author}`);
    lines.push("");
    const bookThought = thoughts[`book:${selected.bookId}`];
    if (bookThought) {
      lines.push("## 我的思考");
      lines.push(bookThought);
      lines.push("");
    }
    lines.push("## 划线");
    for (const g of chapterGroups) {
      lines.push(`### ${g.title}`);
      for (const m of g.marks) {
        lines.push(`> ${m.markText || ""}`);
        const th = m.bookmarkId ? thoughts[`mark:${m.bookmarkId}`] : "";
        if (th) lines.push(`想法：${th}`);
        lines.push("");
      }
    }
    if (reviews.length) {
      lines.push("## 我的想法/点评");
      for (const r of reviews) {
        if (r.chapterName) lines.push(`**${r.chapterName}**`);
        if (r.abstract) lines.push(`> ${r.abstract}`);
        lines.push(r.content || "");
        lines.push("");
      }
    }
    const md = lines.join("\n");
    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.book?.title || "笔记"}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function analyzeWithAI() {
    if (!selected || aiLoading) return;
    setAiLoading(true);
    setAiText("");

    const sampleMarks = bookmarks
      .slice(0, 40)
      .map((m) => `· ${m.markText}`)
      .join("\n");
    const sampleReviews = reviews
      .slice(0, 20)
      .map((r) => `· ${r.content}`)
      .join("\n");

    const prompt = `这是我在《${selected.book?.title}》（作者：${
      selected.book?.author || "未知"
    }）中的划线与想法，请帮我做一次深度解读：提炼这本书我最关注的主题、我的思考倾向，并给我 2-3 个延伸思考的问题。

【我的划线】
${sampleMarks || "（无）"}

【我的想法】
${sampleReviews || "（无）"}`;

    try {
      const resp = await apiFetch("/api/ai/chat", {
        method: "POST",
        apiKey,
        body: JSON.stringify({ messages: [{ role: "user", content: prompt }] }),
      });
      if (!resp.ok || !resp.body) {
        const err = await resp.json().catch(() => ({}));
        setAiText(`⚠️ ${err.error || "AI 服务不可用，请检查 AI_API_KEY 配置"}`);
        setAiLoading(false);
        return;
      }
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith("data:")) continue;
          const payload = t.slice(5).trim();
          if (payload === "[DONE]") continue;
          try {
            const json = JSON.parse(payload);
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) setAiText((prev) => prev + delta);
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      setAiText(`⚠️ ${(e as Error).message}`);
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <aside className={selected ? "hidden lg:block" : "block"}>
        <div className="soul-card lg:sticky lg:top-24">
          <h2 className="soul-card-title">我的笔记</h2>
          <p className="soul-card-sub mb-3">共 {books.length} 本有笔记的书</p>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索书名 / 作者"
            className="mb-3 w-full rounded-xl border border-white/10 bg-ink-900/80 px-3 py-2 text-sm text-soul-cream outline-none transition focus:border-soul-gold/50"
          />
          <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
            {sortedBooks.map((b) => (
              <button
                key={b.bookId}
                onClick={() => loadDetail(b)}
                className={`block w-full rounded-xl border px-3 py-2.5 text-left transition ${
                  selected?.bookId === b.bookId
                    ? "border-soul-gold/50 bg-soul-gold/10"
                    : "border-white/5 bg-white/[0.02] hover:border-soul-gold/30"
                }`}
              >
                <p className="truncate text-sm font-medium text-soul-cream">
                  {b.book?.title || "未命名"}
                </p>
                {b.book?.author && (
                  <p className="truncate text-xs soul-card-sub">{b.book.author}</p>
                )}
                <p className="mt-1 text-[11px] text-soul-gold/70">
                  划线 {b.noteCount ?? 0} · 想法 {b.reviewCount ?? 0}
                </p>
              </button>
            ))}
            {sortedBooks.length === 0 && (
              <p className="py-10 text-center text-sm soul-card-sub">没有匹配的书</p>
            )}
          </div>
        </div>
      </aside>

      <div className={selected ? "block" : "hidden lg:block"}>
        {!selected ? (
          <div className="soul-card flex min-h-[300px] flex-col items-center justify-center text-center">
            <BookIcon className="mb-3 h-10 w-10 text-soul-gold/40" />
            <p className="text-sm soul-card-sub">从左侧选择一本书，阅读你的划线</p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="soul-card">
              <button
                onClick={() => setSelected(null)}
                className="mb-3 text-xs soul-card-sub transition hover:text-soul-gold lg:hidden"
              >
                ← 返回书架
              </button>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-serif text-xl font-bold text-soul-cream">
                    {selected.book?.title}
                  </h2>
                  {selected.book?.author && (
                    <p className="mt-0.5 text-sm soul-card-sub">
                      {selected.book.author}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <a
                    href={wereadReadingLink(selected.bookId)}
                    className="flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-soul-gold/40 hover:text-soul-gold"
                  >
                    微信读书 <ExternalIcon className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={exportMarkdown}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-white/60 transition hover:border-soul-gold/40 hover:text-soul-gold"
                  >
                    导出 Markdown
                  </button>
                  <button
                    onClick={analyzeWithAI}
                    disabled={aiLoading || loading}
                    className="rounded-lg bg-gradient-to-r from-soul-amber to-soul-gold px-3 py-1.5 text-xs font-medium text-ink-950 transition hover:brightness-110 disabled:opacity-60"
                  >
                    {aiLoading ? "AI 解读中…" : "AI 解读这本书"}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <label className="text-xs text-soul-gold/70">我的整本思考</label>
                <textarea
                  value={thoughts[`book:${selected.bookId}`] || ""}
                  onChange={(e) =>
                    setThought(`book:${selected.bookId}`, e.target.value)
                  }
                  placeholder="写下你读完这本书的整体思考…（仅保存在本地）"
                  rows={3}
                  className="soul-input mt-1.5 resize-y"
                />
              </div>
            </div>

            {(aiText || aiLoading) && (
              <div className="soul-card">
                <h3 className="soul-card-title mb-2 text-base">AI 解读</h3>
                {aiText ? (
                  <Markdown content={aiText} className="text-white/80" />
                ) : (
                  <p className="text-sm soul-card-sub">正在解读你的笔记…</p>
                )}
              </div>
            )}

            {loading && (
              <div className="soul-card text-center text-sm soul-card-sub">
                正在加载笔记…
              </div>
            )}
            {detailError && (
              <div className="soul-card text-center text-sm text-red-400">
                {detailError}
              </div>
            )}

            {!loading && chapterGroups.length > 0 && (
              <div className="soul-card">
                <h3 className="soul-card-title mb-4 text-base">
                  划线 · {bookmarks.length} 条
                </h3>
                <div className="space-y-5">
                  {chapterGroups.map((g, gi) => (
                    <div key={gi}>
                      <p className="mb-2 text-sm font-medium text-soul-amber">
                        {g.title}
                      </p>
                      <div className="space-y-3">
                        {g.marks.map((m, mi) => (
                          <MarkNoteCard
                            key={m.bookmarkId || mi}
                            mark={m}
                            thought={
                              m.bookmarkId
                                ? thoughts[`mark:${m.bookmarkId}`] ?? ""
                                : ""
                            }
                            onThoughtChange={(v) =>
                              m.bookmarkId &&
                              setThought(`mark:${m.bookmarkId}`, v)
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading && reviews.length > 0 && (
              <div className="soul-card">
                <h3 className="soul-card-title mb-3 text-base">
                  我的想法 · {reviews.length} 条
                </h3>
                <div className="space-y-3">
                  {reviews.map((r, i) => (
                    <div
                      key={r.reviewId || i}
                      className="rounded-xl border border-white/5 bg-white/[0.02] p-3"
                    >
                      {r.chapterName && (
                        <p className="mb-1 text-xs text-soul-amber">
                          {r.chapterName}
                        </p>
                      )}
                      {r.abstract && (
                        <blockquote className="mb-2 border-l-2 border-white/15 pl-3 text-xs italic soul-card-sub">
                          {r.abstract}
                        </blockquote>
                      )}
                      <p className="text-sm leading-relaxed text-soul-cream">
                        {r.content}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!loading &&
              !detailError &&
              chapterGroups.length === 0 &&
              reviews.length === 0 && (
                <div className="soul-card text-center text-sm soul-card-sub">
                  这本书暂无可导出的划线与想法
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function MarkNoteCard({
  mark,
  thought,
  onThoughtChange,
}: {
  mark: Bookmark;
  thought: string;
  onThoughtChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(Boolean(thought.trim()));
  const hasThought = Boolean(thought.trim());

  return (
    <div className="relative rounded-xl border border-white/5 bg-white/[0.02] px-3 pb-3 pt-3">
      <blockquote className="border-l-2 border-soul-gold/40 pl-3 pr-16 font-serif text-sm leading-relaxed text-soul-cream">
        {mark.markText}
      </blockquote>

      <div className="mt-2 flex items-end justify-between gap-2">
        <span className="text-[11px] soul-card-sub">
          {mark.createTime ? formatDate(mark.createTime) : ""}
        </span>
        {mark.bookmarkId && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] transition ${
              hasThought
                ? "border-soul-gold/35 text-soul-gold"
                : "border-white/10 soul-card-sub hover:border-soul-gold/30 hover:text-soul-gold"
            }`}
          >
            {open ? "收起" : hasThought ? "想法" : "写想法"}
          </button>
        )}
      </div>

      {open && mark.bookmarkId && (
        <textarea
          value={thought}
          onChange={(e) => onThoughtChange(e.target.value)}
          placeholder="写下你对这句话的想法…（仅本地）"
          rows={2}
          className="soul-input mt-2 resize-none text-xs"
        />
      )}
    </div>
  );
}
