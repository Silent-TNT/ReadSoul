"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { toPng } from "html-to-image";
import { formatDate, wereadReadingLink } from "@/lib/format";
import {
  buildPosterBooks,
  filterPosterBooks,
  posterCounts,
  availableYears,
  POSTER_PRESETS,
  solidBgFrom,
  pillColorForBook,
  statBadgeColors,
  type PosterStyle,
  type PosterBook,
} from "@/lib/poster";
import PosterStylePanel from "@/components/poster/PosterStylePanel";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/components/Toast";
import type { NotebookBook, ShelfBook } from "@/lib/types";

interface Props {
  shelf: ShelfBook[];
  notebooks: NotebookBook[];
}

type StatusFilter = "all" | "finished" | "reading";
type TimeScope = "all" | "year" | "month";

const PILL_SIZE = {
  sm: "px-2.5 py-1 text-[11px]",
  md: "px-3.5 py-1.5 text-xs",
  lg: "px-4 py-2 text-sm",
};

interface TooltipState {
  book: PosterBook;
  x: number;
  y: number;
}

export default function ReadingPosterView({ shelf, notebooks }: Props) {
  const { theme } = useTheme();
  const posterRef = useRef<HTMLDivElement>(null);
  const [presetKey, setPresetKey] = useState("readsoul");
  const [style, setStyle] = useState<PosterStyle>(POSTER_PRESETS.readsoul);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeScope, setTimeScope] = useState<TimeScope>("all");
  const [year, setYear] = useState<number | undefined>();
  const [month, setMonth] = useState<number | undefined>(1);
  const [styleDrawerOpen, setStyleDrawerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [animKey, setAnimKey] = useState(0);
  const toast = useToast();

  const allBooks = useMemo(
    () => buildPosterBooks(shelf, notebooks),
    [shelf, notebooks]
  );
  const years = useMemo(() => availableYears(allBooks), [allBooks]);
  const counts = useMemo(() => posterCounts(allBooks), [allBooks]);

  const filtered = useMemo(
    () =>
      filterPosterBooks(allBooks, {
        statusFilter,
        timeScope,
        year: year ?? years[0],
        month,
      }),
    [allBooks, statusFilter, timeScope, year, month, years]
  );

  const applyPreset = useCallback((key: string) => {
    setPresetKey(key);
    if (POSTER_PRESETS[key]) setStyle({ ...POSTER_PRESETS[key] });
  }, []);

  function showTooltip(book: PosterBook, clientX: number, clientY: number) {
    setTooltip({ book, x: clientX, y: clientY });
  }

  function hideTooltip() {
    setTooltip(null);
  }

  function tooltipPos(x: number, y: number) {
    const pad = 14;
    const w = 260;
    const h = 120;
    let left = x + pad;
    let top = y + pad;
    if (typeof window !== "undefined") {
      if (left + w > window.innerWidth - 8) left = x - w - pad;
      if (top + h > window.innerHeight - 8) top = y - h - pad;
    }
    return { left: Math.max(8, left), top: Math.max(8, top) };
  }

  async function exportPoster() {
    const el = posterRef.current;
    if (!el) return;
    setExporting(true);
    hideTooltip();
    try {
      el.querySelectorAll(".poster-pill").forEach((node) => {
        (node as HTMLElement).style.animation = "none";
        (node as HTMLElement).style.transform = "none";
      });
      await new Promise((r) => setTimeout(r, 120));

      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        cacheBust: true,
        backgroundColor: solidBgFrom(style),
        skipAutoScale: true,
        style: { borderRadius: "0", overflow: "visible" },
      });
      const a = document.createElement("a");
      a.download = `阅己-阅读海报-${Date.now()}.png`;
      a.href = dataUrl;
      a.click();
    } catch {
      toast.show("导出失败，请重试", "error");
    } finally {
      setExporting(false);
    }
  }

  function onFilterChange(fn: () => void) {
    fn();
    setAnimKey((k) => k + 1);
  }

  const tp = tooltip ? tooltipPos(tooltip.x, tooltip.y) : null;
  const badges = statBadgeColors(style);

  return (
    <div className="relative space-y-4">
      {/* 顶栏 */}
      <div className="soul-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="soul-card-title">阅读海报</h2>
          <p className="soul-card-sub">
            将你的阅读记录化作可分享的图谱
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStyleDrawerOpen((v) => !v)}
            className={`rounded-lg border px-3 py-1.5 text-xs transition ${
              styleDrawerOpen
                ? "border-soul-gold/60 bg-soul-gold/15 text-soul-gold"
                : "border-white/10 text-white/60 hover:border-soul-gold/40 hover:text-soul-gold"
            }`}
          >
            {styleDrawerOpen ? "收起样式" : "调节样式"}
          </button>
          <button
            onClick={exportPoster}
            disabled={exporting}
            className="rounded-lg bg-gradient-to-r from-soul-amber to-soul-gold px-3 py-1.5 text-xs font-medium text-ink-950 transition hover:brightness-110 disabled:opacity-60"
          >
            {exporting ? "生成中…" : "导出海报"}
          </button>
        </div>
      </div>

      {styleDrawerOpen && (
        <PosterStylePanel
          style={style}
          presetKey={presetKey}
          onPreset={applyPreset}
          onChange={setStyle}
        />
      )}

      {/* 过滤器 */}
      <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["all", "全部", counts.total],
                ["finished", "已读", counts.finished],
                ["reading", "在读", counts.reading],
              ] as const
            ).map(([key, label, n]) => (
              <button
                key={key}
                onClick={() => onFilterChange(() => setStatusFilter(key))}
                className={`rounded-full border px-3 py-1 text-xs transition-all duration-300 ${
                  statusFilter === key
                    ? "border-soul-gold/60 bg-soul-gold/15 text-soul-gold scale-105"
                    : "border-white/10 text-white/55 hover:border-soul-gold/30"
                }`}
              >
                {label} {n}
              </button>
            ))}
            <span className="mx-1 h-4 w-px bg-white/15" />
            {(["all", "year", "month"] as TimeScope[]).map((s) => (
              <button
                key={s}
                onClick={() =>
                  onFilterChange(() => {
                    setTimeScope(s);
                    if (s === "year" && !year && years[0]) setYear(years[0]);
                  })
                }
                className={`rounded-full border px-3 py-1 text-xs transition-all duration-300 ${
                  timeScope === s
                    ? "border-soul-jade/50 bg-soul-jade/10 text-soul-jade"
                    : "border-white/10 text-white/55 hover:border-soul-jade/30"
                }`}
              >
                {s === "all" ? "全部时间" : s === "year" ? "按年" : "按月"}
              </button>
            ))}
            {timeScope === "year" && years.length > 0 && (
              <select
                value={year ?? years[0]}
                onChange={(e) => {
                  setYear(Number(e.target.value));
                  setAnimKey((k) => k + 1);
                }}
                className="rounded-lg border border-white/10 bg-ink-900/60 px-2 py-1 text-xs text-soul-cream outline-none"
              >
                {years.map((y) => (
                  <option key={y} value={y}>
                    {y} 年
                  </option>
                ))}
              </select>
            )}
            {timeScope === "month" && years.length > 0 && (
              <>
                <select
                  value={year ?? years[0]}
                  onChange={(e) => {
                    setYear(Number(e.target.value));
                    setAnimKey((k) => k + 1);
                  }}
                  className="rounded-lg border border-white/10 bg-ink-900/60 px-2 py-1 text-xs text-soul-cream outline-none"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y} 年
                    </option>
                  ))}
                </select>
                <select
                  value={month}
                  onChange={(e) => {
                    setMonth(Number(e.target.value));
                    setAnimKey((k) => k + 1);
                  }}
                  className="rounded-lg border border-white/10 bg-ink-900/60 px-2 py-1 text-xs text-soul-cream outline-none"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                    <option key={m} value={m}>
                      {m} 月
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>

          {/* 海报预览 */}
          <div className="overflow-hidden rounded-2xl shadow-lg shadow-black/10">
            <div
              ref={posterRef}
              className="px-5 py-8 sm:px-8 sm:py-10"
              style={{
                background: `linear-gradient(165deg, ${style.bgFrom} 0%, ${style.bgTo} 100%)`,
                minHeight: 280,
              }}
            >
              <header className="mb-6 text-center">
                <h1
                  className="font-serif text-xl font-black tracking-wide sm:text-2xl"
                  style={{ color: style.titleColor }}
                >
                  {style.title}
                </h1>
                <p
                  className="mt-1.5 text-xs tracking-[0.28em] sm:text-sm"
                  style={{ color: style.subtitleColor }}
                >
                  {style.subtitle}
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: badges.finished.bg,
                      color: badges.finished.text,
                    }}
                  >
                    已读 {counts.finished}
                  </span>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      backgroundColor: badges.reading.bg,
                      color: badges.reading.text,
                    }}
                  >
                    在读 {counts.reading}
                  </span>
                </div>
              </header>

              <div
                key={animKey}
                className="flex flex-wrap justify-center gap-2 sm:gap-2.5"
              >
                {filtered.map((book, i) => {
                  const colors = pillColorForBook(style, book, i);
                  return (
                    <span
                      key={book.bookId}
                      role="link"
                      tabIndex={0}
                      onMouseEnter={(e) =>
                        showTooltip(book, e.clientX, e.clientY)
                      }
                      onMouseMove={(e) =>
                        showTooltip(book, e.clientX, e.clientY)
                      }
                      onMouseLeave={hideTooltip}
                      onClick={() => {
                        window.location.href = wereadReadingLink(book.bookId);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          window.location.href = wereadReadingLink(
                            book.bookId
                          );
                      }}
                      className={`poster-pill inline-block cursor-pointer rounded-full font-medium transition-transform duration-200 hover:scale-105 ${PILL_SIZE[style.pillSize]}`}
                      style={{
                        backgroundColor: colors.bg,
                        color: colors.text,
                        animationDelay: `${Math.min(i * 5, 250)}ms`,
                        textDecoration:
                          book.status === "finished" &&
                          style.finishedStrikethrough
                            ? "line-through"
                            : "none",
                        textDecorationColor: colors.text,
                      }}
                    >
                      {book.title}
                    </span>
                  );
                })}
              </div>

              {filtered.length === 0 && (
                <p
                  className="py-16 text-center text-sm"
                  style={{ color: style.subtitleColor }}
                >
                  当前筛选条件下没有书籍
                </p>
              )}

              <p
                className="mt-8 text-center text-[10px] tracking-wider"
                style={{ color: style.footerColor }}
              >
                阅己 ReadSoul · readsoul.cn · 共展示 {filtered.length} 本
              </p>
            </div>
          </div>
      </div>

      {tooltip && tp && (
        <div
          className="poster-tooltip pointer-events-none fixed z-[100] w-[260px] rounded-xl border px-4 py-3 shadow-xl backdrop-blur-md"
          style={{ left: tp.left, top: tp.top }}
          data-theme={theme}
        >
          <p className="poster-tooltip-title font-serif text-sm font-bold leading-snug">
            {tooltip.book.title}
          </p>
          {tooltip.book.author && (
            <p className="poster-tooltip-meta mt-1 text-xs">
              {tooltip.book.author}
            </p>
          )}
          <div className="poster-tooltip-meta mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
            <span>{tooltip.book.status === "finished" ? "已读" : "在读"}</span>
            <span>{tooltip.book.progress}%</span>
            {tooltip.book.category && <span>{tooltip.book.category}</span>}
            {tooltip.book.readUpdateTime && (
              <span>{formatDate(tooltip.book.readUpdateTime)}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
