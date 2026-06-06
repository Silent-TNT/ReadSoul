"use client";

import { useEffect, useMemo, useRef, useState, forwardRef } from "react";
import { toPng } from "html-to-image";
import type { EnrichedInsightPair } from "@/lib/insightTypes";
import type { InsightKind } from "@/lib/noteLinks";
import { useThoughts } from "@/hooks/useThoughts";

type FilterKind = "all" | InsightKind;

interface Props {
  pairs: EnrichedInsightPair[];
  filter: FilterKind;
  search: string;
  building?: boolean;
  buildProgress?: number;
  buildMessage?: string;
  onDismissPair?: (pair: EnrichedInsightPair) => void;
}

function truncate(text: string, max: number) {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length <= max ? t : `${t.slice(0, max)}…`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, body] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] ?? "image/png";
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function shareBackgroundColor() {
  if (typeof document === "undefined") return "#0b0b0f";
  return document.documentElement.getAttribute("data-theme") === "light"
    ? "#fffdf8"
    : "#0b0b0f";
}

export default function InsightPairFeed({
  pairs,
  filter,
  search,
  building,
  buildProgress,
  buildMessage,
  onDismissPair,
}: Props) {
  const { thoughts, setThought, ready } = useThoughts();
  const [index, setIndex] = useState(0);
  const [toast, setToast] = useState("");
  const [errorToast, setErrorToast] = useState("");
  const [exporting, setExporting] = useState(false);
  const [shareTarget, setShareTarget] = useState<{
    pair: EnrichedInsightPair;
    thought: string;
  } | null>(null);
  const shareRef = useRef<HTMLDivElement>(null);

  const kw = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      pairs.filter((p) => {
        if (filter === "similar" && p.kind !== "similar") return false;
        if (filter === "opposing" && p.kind !== "opposing") return false;
        if (!kw) return true;
        const hay = [
          p.theme ?? "",
          p.source.text,
          p.target.text,
          p.source.bookTitle,
          p.target.bookTitle,
          ...p.sharedTerms,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(kw);
      }),
    [pairs, filter, kw]
  );

  useEffect(() => {
    setIndex((i) => Math.min(i, Math.max(0, filtered.length - 1)));
  }, [filtered.length, filter, kw]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!errorToast) return;
    const t = setTimeout(() => setErrorToast(""), 4500);
    return () => clearTimeout(t);
  }, [errorToast]);

  if (building && filtered.length === 0) {
    return (
      <div className="soul-card text-center">
        <div className="mx-auto mb-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-soul-gold transition-all duration-500"
            style={{ width: `${Math.round((buildProgress ?? 0.15) * 100)}%` }}
          />
        </div>
        <p className="text-sm text-soul-cream">
          {buildMessage || "AI 正在分析你的划线…"}
        </p>
        <p className="mt-2 text-[11px] soul-card-sub">
          分析出一组就显示一组，无需等待全部完成
        </p>
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="soul-card text-center text-sm soul-card-sub">
        {building
          ? "正在寻找第一组关联，请稍候…"
          : "暂无匹配的观点对，可调整筛选或点击「重新分析」"}
      </div>
    );
  }

  const pair = filtered[index];
  const thought = ready ? thoughts[`pair:${pair.id}`] ?? "" : "";
  const atStart = index === 0;
  const atEnd = index === filtered.length - 1;
  const isOpp = pair.kind === "opposing";

  function handleDismiss() {
    if (!onDismissPair || !pair) return;
    const nextIndex =
      index >= filtered.length - 1 ? Math.max(0, index - 1) : index;
    onDismissPair(pair);
    setIndex(nextIndex);
    setToast("已反馈给 AI，后续会避开类似推荐");
  }

  async function handleShare() {
    setExporting(true);
    setErrorToast("");
    setShareTarget({ pair, thought });

    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      });

      if (!shareRef.current) throw new Error("share template missing");

      const dataUrl = await toPng(shareRef.current, {
        pixelRatio: Math.min(window.devicePixelRatio || 1, 1.5),
        cacheBust: false,
        skipFonts: true,
        backgroundColor: shareBackgroundColor(),
      });

      const blob = dataUrlToBlob(dataUrl);
      const file = new File([blob], `阅己-观点对照-${Date.now()}.png`, {
        type: "image/png",
      });

      if (
        typeof navigator !== "undefined" &&
        navigator.share &&
        navigator.canShare?.({ files: [file] })
      ) {
        try {
          await navigator.share({
            files: [file],
            title: "阅己 · 观点对照",
            text: "readsoul.cn",
          });
          setToast("分享图已生成");
          return;
        } catch (e) {
          if ((e as Error).name === "AbortError") return;
        }
      }

      const link = document.createElement("a");
      link.download = file.name;
      link.href = dataUrl;
      link.click();
      setToast("分享图已保存到下载文件夹");
    } catch {
      setErrorToast("生成分享图失败，请稍后重试或刷新页面后再试");
    } finally {
      setShareTarget(null);
      setExporting(false);
    }
  }

  return (
    <div className="w-full space-y-3">
      {building && (
        <div className="rounded-xl border border-soul-gold/20 bg-soul-gold/5 px-3 py-2">
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-soul-gold transition-all duration-500"
              style={{
                width: `${Math.round((buildProgress ?? 0.6) * 100)}%`,
              }}
            />
          </div>
          <p className="text-[11px] soul-card-sub">
            {buildMessage || "AI 还在继续分析…"} · 已找到 {pairs.length} 组
          </p>
        </div>
      )}

      {toast && (
        <div className="rounded-lg border border-soul-jade/30 bg-soul-jade/10 px-3 py-2 text-center text-xs text-soul-jade">
          {toast}
        </div>
      )}

      {errorToast && (
        <div className="rounded-lg border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-center text-xs leading-relaxed text-red-300">
          {errorToast}
        </div>
      )}

      <article
        className={`soul-card border-l-2 ${
          isOpp ? "border-l-soul-amber/60" : "border-l-soul-jade/60"
        }`}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <span
            className={`text-xs font-medium md:text-sm ${
              isOpp ? "text-soul-amber" : "text-soul-jade"
            }`}
          >
            {isOpp ? "对立观点" : "相似观点"}
            {pair.theme ? ` · ${pair.theme}` : ""}
          </span>
          {onDismissPair && (
            <button
              type="button"
              onClick={handleDismiss}
              className="shrink-0 rounded-md border border-white/10 px-2 py-0.5 text-[10px] soul-card-sub hover:border-white/25 md:text-xs"
            >
              不太准
            </button>
          )}
        </div>

        {/* 手机：上下排列；电脑：左右并排，等高对齐 */}
        <div className="grid gap-3 md:grid-cols-2 md:items-stretch md:gap-4">
          <QuoteBlock item={pair.source} />
          <QuoteBlock item={pair.target} />
        </div>

        {pair.reflectionPrompt && (
          <p className="mt-4 text-sm leading-relaxed soul-card-sub md:text-[15px]">
            {pair.reflectionPrompt}
          </p>
        )}

        <div className="mt-4">
          <label className="mb-1.5 block text-xs font-medium text-soul-gold/90">
            记下我的见解
          </label>
          <textarea
            value={thought}
            onChange={(e) => setThought(`pair:${pair.id}`, e.target.value)}
            rows={3}
            placeholder="这组对照让你想到了什么？（仅存本地）"
            className="soul-input resize-none"
          />
        </div>

        <button
          type="button"
          onClick={handleShare}
          disabled={exporting}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-soul-amber to-soul-gold py-2.5 text-sm font-medium text-ink-950 disabled:opacity-60 md:py-3"
        >
          {exporting ? "生成分享图…" : "保存 / 分享这组对照"}
        </button>
      </article>

      {/* 分享图：仅在导出时挂载，减少常驻 DOM 与截屏开销 */}
      {shareTarget && (
        <div
          aria-hidden
          className="pointer-events-none fixed -left-[9999px] top-0 z-[-1]"
        >
          <InsightShareCard
            ref={shareRef}
            pair={shareTarget.pair}
            thought={shareTarget.thought}
          />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-1 md:gap-4">
        <button
          type="button"
          disabled={atStart}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className="flex-1 rounded-lg border border-white/10 py-2.5 text-xs text-soul-cream disabled:opacity-30 md:max-w-[140px] md:flex-none md:px-6"
        >
          ← 上一组
        </button>
        <span className="shrink-0 px-1 text-[11px] soul-card-sub md:text-xs">
          {index + 1} / {filtered.length}
          {building ? "+" : ""}
        </span>
        <button
          type="button"
          disabled={atEnd}
          onClick={() => setIndex((i) => Math.min(filtered.length - 1, i + 1))}
          className="flex-1 rounded-lg border border-white/10 py-2.5 text-xs text-soul-cream disabled:opacity-30 md:max-w-[140px] md:flex-none md:px-6"
        >
          下一组 →
        </button>
      </div>
    </div>
  );
}

function QuoteBlock({ item }: { item: EnrichedInsightPair["source"] }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 md:p-4">
      <p className="text-[11px] font-medium text-soul-gold/80 md:text-xs">
        《{item.bookTitle}》
      </p>
      <blockquote className="mt-2 flex-1 border-l-2 border-soul-gold/35 pl-3 text-left font-serif text-sm leading-relaxed text-soul-cream md:text-[15px] md:leading-loose">
        {item.text}
      </blockquote>
    </div>
  );
}

function ShareQuote({ item }: { item: EnrichedInsightPair["source"] }) {
  return (
    <div>
      <p className="share-book text-[10px] font-medium text-[#c8a45c]">
        《{truncate(item.bookTitle, 20)}》
      </p>
      <p className="share-text mt-1.5 font-serif text-[13px] leading-relaxed text-[#f3ead6]">
        {truncate(item.text, 160)}
      </p>
    </div>
  );
}

const InsightShareCard = forwardRef<
  HTMLDivElement,
  { pair: EnrichedInsightPair; thought: string }
>(function InsightShareCard({ pair, thought }, ref) {
  const isOpp = pair.kind === "opposing";

  return (
    <div
      ref={ref}
      className="share-surface w-[375px] overflow-hidden rounded-2xl border border-soul-gold/25 bg-gradient-to-b from-[#12101a] via-[#0b0b0f] to-[#0a090e] p-5"
    >
      <p
        className={`share-kicker text-xs font-semibold ${
          isOpp ? "share-kicker--opp text-[#e8a830]" : "share-kicker--similar text-[#3dd68c]"
        }`}
      >
        {isOpp ? "对立观点" : "相似观点"}
        {pair.theme ? ` · ${pair.theme}` : ""}
      </p>

      <div className="mt-4 space-y-4">
        <ShareQuote item={pair.source} />
        <div className="share-divider h-px bg-white/10" />
        <ShareQuote item={pair.target} />
      </div>

      {thought.trim() && (
        <div className="share-thought-box mt-4 rounded-xl border border-[#c8a45c]/25 bg-white/[0.04] p-3">
          <p className="share-thought-label text-[10px] font-medium text-[#c8a45c]">
            我的见解
          </p>
          <p className="share-thought-body mt-1 text-xs leading-relaxed text-[#f3ead6]">
            {truncate(thought, 120)}
          </p>
        </div>
      )}

      <p className="share-footer mt-5 border-t border-white/10 pt-3 text-center text-[10px] tracking-wide text-[#c8a45c]/75">
        阅己 · readsoul.cn
      </p>
    </div>
  );
});
