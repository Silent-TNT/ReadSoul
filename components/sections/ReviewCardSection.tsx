"use client";

import { useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { formatDate } from "@/lib/format";
import type { Bookmark } from "@/lib/types";
import { useToast } from "@/components/Toast";

interface Props {
  bookmarks: Bookmark[];
  bookTitles: Record<string, string>;
}

function shareBackgroundColor() {
  if (typeof document === "undefined") return "#0b0b0f";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "#fffdf8"
    : "#0b0b0f";
}

export default function ReviewCardSection({ bookmarks, bookTitles }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  const pool = useMemo(
    () => bookmarks.filter((b) => (b.markText || "").trim().length > 4),
    [bookmarks]
  );

  if (!pool.length) {
    return (
      <section className="soul-card text-center">
        <p className="soul-card-title">今日一句</p>
        <p className="mt-3 text-sm soul-card-sub">暂无可回顾的划线</p>
      </section>
    );
  }

  const current = pool[idx % pool.length];
  const title = current.bookId ? bookTitles[current.bookId] : undefined;

  function shuffle() {
    setIdx((i) => (i + 1 + Math.floor(Math.random() * pool.length)) % pool.length);
  }

  async function handleExport() {
    if (!cardRef.current) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        cacheBust: false,
        skipFonts: true,
        backgroundColor: shareBackgroundColor(),
      });
      const link = document.createElement("a");
      link.download = `阅己-回顾-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
      toast.show("分享图已保存", "success");
    } catch {
      toast.show("导出失败，请重试", "error");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className="soul-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="soul-card-title">今日一句</h2>
          <p className="soul-card-sub">重逢你划下的句子</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={shuffle}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-xs soul-card-sub transition hover:border-soul-gold/40 hover:text-soul-gold"
          >
            换一句
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="rounded-lg bg-gradient-to-r from-soul-amber to-soul-gold px-3 py-1.5 text-xs font-medium text-ink-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {exporting ? "生成中…" : "分享"}
          </button>
        </div>
      </div>

      <div
        ref={cardRef}
        className="share-surface mx-auto max-w-lg overflow-hidden rounded-2xl border border-soul-gold/20 bg-gradient-to-br from-ink-900 to-ink-950 px-6 py-5"
      >
        <blockquote className="font-serif text-base leading-relaxed text-soul-cream sm:text-lg sm:leading-loose">
          <span className="text-soul-gold/40">「</span>
          {current.markText}
          <span className="text-soul-gold/40">」</span>
        </blockquote>

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-3">
          {title ? (
            <p className="min-w-0 truncate text-xs font-medium text-soul-gold/85">
              《{title}》
            </p>
          ) : (
            <span />
          )}
          {current.createTime && (
            <p className="shrink-0 text-[11px] soul-card-sub">
              {formatDate(current.createTime)}
            </p>
          )}
        </div>

        <p className="share-footer mt-4 border-t border-white/10 pt-3 text-center text-[10px] tracking-wide text-soul-gold/55">
          阅己 · readsoul.cn
        </p>
      </div>
    </section>
  );
}
