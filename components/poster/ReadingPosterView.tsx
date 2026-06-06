"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  statBadgeStrike,
  computePosterTypography,
  type PosterLayoutVariant,
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
type PosterVariant = "preview" | "export-mobile" | "export-desktop";

const COMPACT_PILL = "inline-block rounded-full font-medium align-top";

function useMinWidthSm(): boolean {
  const [smUp, setSmUp] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setSmUp(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return smUp;
}

function resolveLayoutVariant(
  variant: PosterVariant,
  previewSmUp: boolean
): PosterLayoutVariant {
  if (variant === "export-mobile") return "export-mobile";
  if (variant === "export-desktop") return "export-desktop";
  return previewSmUp ? "preview-desktop" : "preview-mobile";
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(body);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

function isMobileViewport(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 639px)").matches;
}

/** 固定导出宽度下计算 pixelRatio；宽画布 + 更高倍率以提升清晰度 */
function exportPixelRatio(width: number, height: number, mobile: boolean): number {
  const maxSide = 8192;
  const cap = maxSide / Math.max(width, height, 1);
  const base = mobile ? 4 : 2;
  return Math.max(1.5, Math.min(base, cap));
}

interface PosterCanvasProps {
  books: PosterBook[];
  style: PosterStyle;
  counts: { finished: number; reading: number; total: number };
  variant: PosterVariant;
  animKey?: number;
  interactive?: boolean;
  onBookHover?: (
    book: PosterBook,
    clientX: number,
    clientY: number
  ) => void;
  onBookLeave?: () => void;
}

function PosterCanvas({
  books,
  style,
  counts,
  variant,
  animKey = 0,
  interactive = false,
  onBookHover,
  onBookLeave,
}: PosterCanvasProps) {
  const badges = statBadgeColors(style);
  const previewSmUp = useMinWidthSm();
  const isExportMobile = variant === "export-mobile";
  const isExport = variant === "export-mobile" || variant === "export-desktop";
  const layoutVariant = resolveLayoutVariant(variant, previewSmUp);
  const typo = useMemo(
    () =>
      computePosterTypography(layoutVariant, style.pillSize, style.fontScale),
    [layoutVariant, style.pillSize, style.fontScale]
  );

  return (
    <div
      className={typo.rootWidth ? undefined : "w-full"}
      style={{
        width: typo.rootWidth,
        padding: `${typo.rootPaddingY}px ${typo.rootPaddingX}px`,
        background: `linear-gradient(165deg, ${style.bgFrom} 0%, ${style.bgTo} 100%)`,
        minHeight: isExportMobile ? undefined : 280,
      }}
    >
      <header
        className="text-center"
        style={{ marginBottom: typo.headerMb }}
      >
        <h1
          className="font-serif font-black tracking-wide"
          style={{ color: style.titleColor, fontSize: typo.title }}
        >
          {style.title}
        </h1>
        <p
          className="mt-1"
          style={{
            color: style.subtitleColor,
            fontSize: typo.subtitle,
            letterSpacing: typo.subtitleTracking,
          }}
        >
          {style.subtitle}
        </p>
        <div
          className="flex flex-wrap justify-center"
          style={{ marginTop: typo.badgeMt, gap: typo.badgeGap }}
        >
          <span
            className="inline-flex shrink-0 whitespace-nowrap rounded-full font-semibold leading-none"
            style={{
              fontSize: typo.badge,
              padding: `${typo.badgePaddingY}px ${typo.badgePaddingX}px`,
              backgroundColor: badges.finished.bg,
              color: badges.finished.text,
              textDecoration: statBadgeStrike(style, "finished")
                ? "line-through"
                : "none",
              textDecorationColor: badges.finished.text,
            }}
          >
            已读 {counts.finished}
          </span>
          <span
            className="inline-flex shrink-0 whitespace-nowrap rounded-full font-semibold leading-none"
            style={{
              fontSize: typo.badge,
              padding: `${typo.badgePaddingY}px ${typo.badgePaddingX}px`,
              backgroundColor: badges.reading.bg,
              color: badges.reading.text,
              textDecoration: statBadgeStrike(style, "reading")
                ? "line-through"
                : "none",
              textDecorationColor: badges.reading.text,
            }}
          >
            在读 {counts.reading}
          </span>
        </div>
      </header>

      <div
        key={isExport ? undefined : animKey}
        className="flex flex-wrap justify-start"
        style={{ gap: `${typo.bookGapY}px ${typo.bookGapX}px` }}
      >
        {books.map((book, i) => {
          const colors = pillColorForBook(style, book, i);
          return (
            <span
              key={book.bookId}
              role={interactive ? "link" : undefined}
              tabIndex={interactive ? 0 : undefined}
              onMouseEnter={
                interactive && onBookHover
                  ? (e) => onBookHover(book, e.clientX, e.clientY)
                  : undefined
              }
              onMouseMove={
                interactive && onBookHover
                  ? (e) => onBookHover(book, e.clientX, e.clientY)
                  : undefined
              }
              onMouseLeave={interactive ? onBookLeave : undefined}
              onClick={
                interactive
                  ? () => {
                      window.location.href = wereadReadingLink(book.bookId);
                    }
                  : undefined
              }
              onKeyDown={
                interactive
                  ? (e) => {
                      if (e.key === "Enter")
                        window.location.href = wereadReadingLink(book.bookId);
                    }
                  : undefined
              }
              className={`${isExport ? "" : "poster-pill"} ${COMPACT_PILL} ${
                interactive ? "cursor-pointer transition-transform duration-200 hover:scale-105" : ""
              }`}
              style={{
                fontSize: typo.pill,
                lineHeight: 1.2,
                padding: `${typo.pillPaddingY}px ${typo.pillPaddingX}px`,
                backgroundColor: colors.bg,
                color: colors.text,
                animationDelay: isExport ? undefined : `${Math.min(i * 5, 250)}ms`,
                textDecoration:
                  book.status === "finished" && style.finishedStrikethrough
                    ? "line-through"
                    : "none",
                textDecorationColor: colors.text,
                wordBreak: "break-word",
              }}
            >
              {book.title}
            </span>
          );
        })}
      </div>

      {books.length === 0 && (
        <p
          className="py-12 text-center"
          style={{ color: style.subtitleColor, fontSize: typo.subtitle }}
        >
          当前筛选条件下没有书籍
        </p>
      )}

      <p
        className="text-center tracking-wide"
        style={{
          color: style.footerColor,
          fontSize: typo.footer,
          marginTop: typo.footerMt,
        }}
      >
        阅己 ReadSoul · readsoul.cn · 共展示 {books.length} 本
      </p>
    </div>
  );
}

interface TooltipState {
  book: PosterBook;
  x: number;
  y: number;
}

export default function ReadingPosterView({ shelf, notebooks }: Props) {
  const { theme } = useTheme();
  const posterRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);
  const [presetKey, setPresetKey] = useState("readsoul");
  const [style, setStyle] = useState<PosterStyle>(POSTER_PRESETS.readsoul);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [timeScope, setTimeScope] = useState<TimeScope>("all");
  const [year, setYear] = useState<number | undefined>();
  const [month, setMonth] = useState<number | undefined>(1);
  const [styleDrawerOpen, setStyleDrawerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportMode, setExportMode] = useState<"mobile" | "desktop" | null>(
    null
  );
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
    setExporting(true);
    hideTooltip();
    const mobile = isMobileViewport();

    try {
      if (mobile) setExportMode("mobile");
      else setExportMode("desktop");

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      const el = mobile ? exportRef.current : posterRef.current;
      if (!el) throw new Error("export target missing");

      el.querySelectorAll(".poster-pill").forEach((node) => {
        (node as HTMLElement).style.animation = "none";
        (node as HTMLElement).style.transform = "none";
      });

      const width = el.offsetWidth;
      const height = el.scrollHeight;
      const dataUrl = await toPng(el, {
        pixelRatio: exportPixelRatio(width, height, mobile),
        cacheBust: false,
        skipFonts: true,
        backgroundColor: solidBgFrom(style),
        skipAutoScale: true,
        width,
        height,
        style: { borderRadius: "0", overflow: "visible" },
      });

      const blob = dataUrlToBlob(dataUrl);
      const filename = `阅己-阅读海报-${Date.now()}.png`;
      const file = new File([blob], filename, { type: "image/png" });

      if (
        mobile &&
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: "阅己 · 阅读海报",
            text: "readsoul.cn",
          });
          toast.show("海报已生成", "success");
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }

      const a = document.createElement("a");
      a.download = filename;
      a.href = dataUrl;
      a.click();
      toast.show("海报已保存", "success");
    } catch {
      toast.show("导出失败，请重试或换用电脑端导出", "error");
    } finally {
      setExportMode(null);
      setExporting(false);
    }
  }

  function onFilterChange(fn: () => void) {
    fn();
    setAnimKey((k) => k + 1);
  }

  const tp = tooltip ? tooltipPos(tooltip.x, tooltip.y) : null;

  return (
    <div className="relative space-y-4">
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

        <div className="rounded-2xl shadow-lg shadow-black/10">
          <div ref={posterRef}>
            <PosterCanvas
              books={filtered}
              style={style}
              counts={counts}
              variant="preview"
              animKey={animKey}
              interactive
              onBookHover={showTooltip}
              onBookLeave={hideTooltip}
            />
          </div>
        </div>
      </div>

      {exportMode && (
        <div
          aria-hidden
          className="pointer-events-none fixed -left-[9999px] top-0"
        >
          <div ref={exportRef}>
            <PosterCanvas
              books={filtered}
              style={style}
              counts={counts}
              variant={
                exportMode === "mobile" ? "export-mobile" : "export-desktop"
              }
            />
          </div>
        </div>
      )}

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
