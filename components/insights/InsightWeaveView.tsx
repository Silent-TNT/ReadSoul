"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  startTransition,
} from "react";
import dynamic from "next/dynamic";
import { bookNoteTotal } from "@/lib/aggregate";
import { fetchFullNoteCorpus } from "@/lib/noteCorpus";
import { buildBookOverview, filterCorpusByBooks } from "@/lib/noteGraph";
import type { InsightKind, NoteCorpusItem } from "@/lib/noteLinks";
import type { NotebookBook } from "@/lib/types";
import {
  getInsightCache,
  peekInsightCache,
  setInsightCache,
  clearInsightCache,
  hashCorpus,
} from "@/lib/insightCache";
import {
  loadDismissedIds,
  saveDismissedIds,
  loadInsightFeedback,
  addInsightFeedback,
  isSimilarToFeedback,
  type InsightFeedbackEntry,
} from "@/lib/insightFeedback";
import { fetchInsightBuildStream } from "@/lib/insightBuildClient";
import type { InsightBuildResult, InsightBuildStage } from "@/lib/insightTypes";
import type { EnrichedInsightPair } from "@/lib/insightTypes";
import type { InsightStreamEvent } from "@/lib/insightStream";
import {
  prepareInsightPairsForDisplay,
  clearDisplaySeed,
} from "@/lib/insightDisplay";
import InsightPairFeed from "@/components/insights/InsightPairFeed";
import InsightTopicView from "@/components/insights/InsightTopicView";

const BookOverviewChart = dynamic(
  () => import("@/components/insights/BookOverviewChart"),
  { ssr: false }
);

/** 跨 Tab 切换保留构建状态，避免反复触发分析 */
const buildGuard = new Map<string, "running" | "done">();

function filterPairsForDisplay(
  pairs: EnrichedInsightPair[],
  dismissed: Set<string>,
  feedback: InsightFeedbackEntry[]
): EnrichedInsightPair[] {
  return pairs.filter(
    (p) => !dismissed.has(p.id) && !isSimilarToFeedback(p, feedback)
  );
}

interface Props {
  apiKey: string;
  books: NotebookBook[];
  sharedCorpus?: NoteCorpusItem[];
  sharedLoading?: boolean;
  active?: boolean;
  onCorpusLoaded?: (corpus: NoteCorpusItem[]) => void;
}

type FilterKind = "all" | InsightKind;
type ViewTab = "feed" | "topics";

export default function InsightWeaveView({
  apiKey,
  books,
  sharedCorpus,
  sharedLoading,
  active = true,
  onCorpusLoaded,
}: Props) {
  const [corpus, setCorpus] = useState<NoteCorpusItem[]>(sharedCorpus ?? []);
  const [loading, setLoading] = useState(!sharedCorpus?.length);
  const [progress, setProgress] = useState("正在加载笔记…");
  const [error, setError] = useState("");
  const [insightData, setInsightData] = useState<InsightBuildResult | null>(
    null
  );
  const [buildStage, setBuildStage] = useState<InsightBuildStage>("idle");
  const [buildMessage, setBuildMessage] = useState("");
  const [buildProgress, setBuildProgress] = useState(0);
  const [building, setBuilding] = useState(false);
  const [backgroundBuilding, setBackgroundBuilding] = useState(false);
  const [buildError, setBuildError] = useState("");
  const [tab, setTab] = useState<ViewTab>("feed");
  const [filter, setFilter] = useState<FilterKind>("all");
  const [search, setSearch] = useState("");
  const [selectedBookIds, setSelectedBookIds] = useState<Set<string>>(
    new Set()
  );
  const [bookPickerOpen, setBookPickerOpen] = useState(false);
  const [booksOpen, setBooksOpen] = useState(false);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const lastBuiltHashRef = useRef("");
  const feedbackRef = useRef<InsightFeedbackEntry[]>([]);
  const pendingPairsRef = useRef<EnrichedInsightPair[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backgroundModeRef = useRef(false);
  const corpusHashRef = useRef("");

  const booksWithNotes = useMemo(
    () =>
      books.filter(
        (b) => (b.noteCount ?? 0) > 0 || (b.reviewCount ?? 0) > 0
      ),
    [books]
  );

  useEffect(() => {
    setDismissedIds(loadDismissedIds());
    feedbackRef.current = loadInsightFeedback();
  }, []);

  const loadCorpus = useCallback(async () => {
    setLoading(true);
    setError("");
    setProgress("正在加载笔记…");
    try {
      const items = await fetchFullNoteCorpus(apiKey, books, (msg) =>
        setProgress(msg)
      );
      setCorpus(items);
      onCorpusLoaded?.(items);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiKey, books, onCorpusLoaded]);

  useEffect(() => {
    if (sharedCorpus && sharedCorpus.length > 0) {
      setCorpus(sharedCorpus);
      setLoading(false);
      return;
    }
    if (!active) return;
    if (!sharedLoading) loadCorpus();
  }, [sharedCorpus, sharedLoading, loadCorpus, active]);

  const activeCorpus = useMemo(() => {
    if (selectedBookIds.size === 0) return corpus;
    return filterCorpusByBooks(corpus, selectedBookIds);
  }, [corpus, selectedBookIds]);

  const activeCorpusHash = useMemo(
    () => hashCorpus(activeCorpus),
    [activeCorpus]
  );
  corpusHashRef.current = activeCorpusHash;

  const overview = useMemo(() => {
    if (!booksOpen || corpus.length === 0) return null;
    return buildBookOverview(corpus);
  }, [booksOpen, corpus]);

  const nodeMap = useMemo(() => {
    const m = new Map<string, NoteCorpusItem>();
    activeCorpus.forEach((c) => m.set(c.id, c));
    return m;
  }, [activeCorpus]);

  const flushPendingPairs = useCallback(() => {
    const batch = pendingPairsRef.current;
    if (batch.length === 0) return;
    pendingPairsRef.current = [];
    startTransition(() => {
      setInsightData((prev) => {
        const base = prev ?? {
          pairs: [],
          clusters: [],
          builtAt: Date.now(),
          version: 1,
          corpusHash: corpusHashRef.current,
        };
        const existing = new Set(base.pairs.map((p) => p.id));
        const merged = [...base.pairs];
        for (const p of batch) {
          if (!existing.has(p.id)) merged.push(p);
        }
        return { ...base, pairs: merged };
      });
    });
  }, []);

  const schedulePairFlush = useCallback(
    (immediate = false) => {
      if (immediate) {
        if (flushTimerRef.current) {
          clearTimeout(flushTimerRef.current);
          flushTimerRef.current = null;
        }
        flushPendingPairs();
        return;
      }
      if (flushTimerRef.current) return;
      flushTimerRef.current = setTimeout(() => {
        flushTimerRef.current = null;
        flushPendingPairs();
      }, 450);
    },
    [flushPendingPairs]
  );

  const handleStreamEvent = useCallback(
    (event: InsightStreamEvent) => {
      if (event.type === "stage") {
        setBuildMessage(event.message);
        if (event.progress != null) setBuildProgress(event.progress);
        const stageMap: Record<string, InsightBuildStage> = {
          embedding: "embedding",
          matching: "embedding",
          analyzing: "clustering",
        };
        setBuildStage(stageMap[event.stage] ?? "clustering");
      } else if (event.type === "pair") {
        if (isSimilarToFeedback(event.pair, feedbackRef.current)) return;
        if (backgroundModeRef.current) {
          pendingPairsRef.current.push(event.pair);
          schedulePairFlush(false);
        } else {
          pendingPairsRef.current.push(event.pair);
          schedulePairFlush(true);
        }
      } else if (event.type === "initial_ready") {
        flushPendingPairs();
        setBuilding(false);
        setBackgroundBuilding(true);
        backgroundModeRef.current = true;
        setBuildMessage(
          `已精选 ${event.opposingCount} 组对立、${event.similarCount} 组相似，后台继续加载更多…`
        );
        setBuildProgress(0.68);
      } else if (event.type === "cluster") {
        startTransition(() => {
          setInsightData((prev) => {
            const base = prev ?? {
              pairs: [],
              clusters: [],
              builtAt: Date.now(),
              version: 1,
              corpusHash: corpusHashRef.current,
            };
            const key = event.cluster.nodeIds.sort().join("|");
            if (
              base.clusters.some((c) => c.nodeIds.sort().join("|") === key)
            ) {
              return base;
            }
            return { ...base, clusters: [...base.clusters, event.cluster] };
          });
        });
      } else if (event.type === "error") {
        setBuildError(event.error);
        setBuildStage("error");
      } else if (event.type === "done") {
        flushPendingPairs();
        setBuildProgress(1);
        setBuildStage("done");
        setBuilding(false);
        setBackgroundBuilding(false);
        backgroundModeRef.current = false;
        setBuildMessage(`共找到 ${event.pairCount} 组对照、${event.clusterCount} 个话题`);
      }
    },
    [flushPendingPairs, schedulePairFlush]
  );

  const runInsightBuild = useCallback(
    async (items: NoteCorpusItem[], force = false) => {
      if (items.length < 2) return;

      const hash = hashCorpus(items);
      if (!force && buildGuard.get(hash) === "running") return;

      setBuildError("");
      backgroundModeRef.current = false;
      pendingPairsRef.current = [];

      const memCached = peekInsightCache(items);
      if (!force && memCached && memCached.pairs.some((p) => p.dataSource === "ai")) {
        setInsightData({
          ...memCached,
          pairs: filterPairsForDisplay(
            memCached.pairs,
            loadDismissedIds(),
            feedbackRef.current
          ),
        });
        setBuilding(false);
        setBackgroundBuilding(false);
        setBuildStage("done");
        setBuildProgress(1);
        buildGuard.set(hash, "done");
        return;
      }

      buildGuard.set(hash, "running");
      setBuilding(true);
      setBackgroundBuilding(false);
      setBuildStage("embedding");
      setBuildMessage("正在启动 AI 分析…");
      setBuildProgress(0.05);
      setInsightData({
        pairs: [],
        clusters: [],
        builtAt: Date.now(),
        version: 1,
        corpusHash: hash,
      });

      try {
        const cached = !force ? await getInsightCache(items) : null;
        if (cached && cached.pairs.some((p) => p.dataSource === "ai")) {
          setInsightData({
            ...cached,
            pairs: filterPairsForDisplay(
              cached.pairs,
              loadDismissedIds(),
              feedbackRef.current
            ),
          });
          setBuilding(false);
          setBackgroundBuilding(false);
          setBuildStage("done");
          setBuildProgress(1);
          buildGuard.set(hash, "done");
          return;
        }

        const result = await fetchInsightBuildStream(
          items,
          handleStreamEvent,
          feedbackRef.current,
          apiKey
        );
        result.pairs = filterPairsForDisplay(
          result.pairs.sort(
            (a, b) => (b.confidence ?? b.score) - (a.confidence ?? a.score)
          ),
          loadDismissedIds(),
          feedbackRef.current
        );
        await setInsightCache(result);
        setInsightData(result);
        setBuildStage("done");
        setBuildProgress(1);
        buildGuard.set(hash, "done");
      } catch (e) {
        setBuildError((e as Error).message);
        setBuildStage("error");
        buildGuard.delete(hash);
      } finally {
        setBuilding(false);
        setBackgroundBuilding(false);
        backgroundModeRef.current = false;
      }
    },
    [apiKey, handleStreamEvent]
  );

  useEffect(() => {
    if (!active || activeCorpus.length < 2 || loading || sharedLoading) return;
    if (lastBuiltHashRef.current === activeCorpusHash) return;
    lastBuiltHashRef.current = activeCorpusHash;

    const memCached = peekInsightCache(activeCorpus);
    if (memCached?.pairs.some((p) => p.dataSource === "ai")) {
      startTransition(() => {
        setInsightData({
          ...memCached,
          pairs: filterPairsForDisplay(
            memCached.pairs,
            dismissedIds,
            feedbackRef.current
          ),
        });
        setBuildStage("done");
        setBuildProgress(1);
      });
      buildGuard.set(activeCorpusHash, "done");
      return;
    }

    void runInsightBuild(activeCorpus);
  }, [
    active,
    activeCorpus,
    activeCorpusHash,
    loading,
    sharedLoading,
    runInsightBuild,
    dismissedIds,
  ]);

  async function handleRebuild() {
    await clearInsightCache();
    clearDisplaySeed(activeCorpusHash);
    buildGuard.delete(activeCorpusHash);
    lastBuiltHashRef.current = "";
    await runInsightBuild(activeCorpus, true);
  }

  function dismissPair(pair: EnrichedInsightPair) {
    const nextFeedback = addInsightFeedback(pair);
    feedbackRef.current = nextFeedback;
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(pair.id);
      saveDismissedIds(next);
      return next;
    });
    setInsightData((prev) => {
      if (!prev) return prev;
      const nextPairs = prev.pairs.filter((p) => p.id !== pair.id);
      void setInsightCache({ ...prev, pairs: nextPairs });
      return { ...prev, pairs: nextPairs };
    });
  }

  const orderedPairs = useMemo(() => {
    if (!insightData) return [];
    const filtered = filterPairsForDisplay(
      insightData.pairs,
      dismissedIds,
      feedbackRef.current
    );
    if (filtered.length === 0) return filtered;
    return prepareInsightPairsForDisplay(
      filtered,
      insightData.corpusHash || activeCorpusHash
    );
  }, [insightData, dismissedIds, activeCorpusHash]);

  const clusters = insightData?.clusters ?? [];

  const stats = useMemo(() => {
    const bookSet = new Set(corpus.map((c) => c.bookId));
    return {
      totalNotes: corpus.length,
      books: bookSet.size,
      activeNotes: activeCorpus.length,
      pairs: orderedPairs.length,
      clusters: clusters.length,
    };
  }, [corpus, activeCorpus, orderedPairs, clusters]);

  function toggleBook(bookId: string) {
    const allIds = booksWithNotes.map((b) => b.bookId);
    setSelectedBookIds((prev) => {
      const current = prev.size === 0 ? new Set(allIds) : new Set(prev);
      if (current.has(bookId)) current.delete(bookId);
      else current.add(bookId);
      if (current.size === allIds.length) return new Set<string>();
      return current;
    });
    lastBuiltHashRef.current = "";
  }

  function selectAllBooks() {
    setSelectedBookIds(new Set());
    lastBuiltHashRef.current = "";
  }

  const tabHint =
    tab === "feed"
      ? "先展示 3 组高质量相似 + 3 组对立，翻页时后台继续加载更多"
      : "把讨论同一主题的划线归在一起，逐个话题翻看";

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5">
      <div className="soul-card">
        <h2 className="soul-card-title">观点织网</h2>
        <p className="soul-card-sub">
          从 {stats.totalNotes} 条划线中，AI 精选跨书相似与对立，一次专注一组
        </p>

        {!loading && !error && (
          <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
            <StatChip label="全库笔记" value={stats.totalNotes} />
            <StatChip label="书籍" value={stats.books} />
            <StatChip label="已找到对照" value={stats.pairs} tone="jade" />
            <StatChip label="已找到话题" value={stats.clusters} tone="amber" />
          </div>
        )}

        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap gap-2">
          {(
            [
              ["feed", "两两对照"],
              ["topics", "同题归类"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                tab === key
                  ? "border-soul-gold/60 bg-soul-gold/15 text-soul-gold"
                  : "border-white/10 text-white/55"
              }`}
            >
              {label}
            </button>
          ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
          {(
            [
              ["all", "全部"],
              ["similar", "相似观点"],
              ["opposing", "对立观点"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`rounded-full border px-3 py-1 text-xs ${
                filter === key
                  ? "border-soul-gold/60 bg-soul-gold/15 text-soul-gold"
                  : "border-white/10 text-white/55"
              }`}
            >
              {label}
            </button>
          ))}

          <button
            onClick={() => setBookPickerOpen((v) => !v)}
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-white/55 hover:border-soul-gold/40"
          >
            {selectedBookIds.size === 0
              ? "筛选书籍（全部）"
              : `已选 ${selectedBookIds.size} 本`}
          </button>

          <button
            onClick={handleRebuild}
            disabled={building || backgroundBuilding}
            className="rounded-lg border border-soul-gold/30 px-3 py-1.5 text-xs text-soul-gold hover:bg-soul-gold/10 disabled:opacity-50"
          >
            重新分析
          </button>
          </div>
        </div>

        <p className="mt-2 text-[11px] soul-card-sub">{tabHint}</p>

        <div className="mt-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索主题或划线内容…"
            className="soul-input w-full rounded-xl px-3 py-2 text-sm"
          />
        </div>

        {bookPickerOpen && (
          <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-ink-900/40 p-3">
            <button
              onClick={selectAllBooks}
              className="mb-2 text-[11px] text-soul-gold hover:underline"
            >
              全选 / 清除
            </button>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {booksWithNotes.map((b) => (
                <label
                  key={b.bookId}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-xs hover:bg-white/5"
                >
                  <input
                    type="checkbox"
                    checked={
                      selectedBookIds.size === 0 ||
                      selectedBookIds.has(b.bookId)
                    }
                    onChange={() => toggleBook(b.bookId)}
                  />
                  <span className="truncate text-soul-cream">
                    {b.book?.title || "未命名"}
                  </span>
                  <span className="ml-auto shrink-0 soul-card-sub">
                    {bookNoteTotal(b)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {(loading || sharedLoading) && !corpus.length && (
        <div className="soul-card text-center text-sm soul-card-sub">
          {progress}
        </div>
      )}

      {error && (
        <div className="soul-card text-center text-sm text-red-400">
          {error}
          <button onClick={loadCorpus} className="ml-2 text-soul-gold">
            重试
          </button>
        </div>
      )}

      {!loading && !error && corpus.length > 0 && (
        <>
          {buildError && (
            <div className="soul-card text-sm text-red-400/90">
              AI 分析失败：{buildError}
            </div>
          )}

          {tab === "feed" ? (
            <InsightPairFeed
              pairs={orderedPairs}
              filter={filter}
              search={search}
              building={building}
              backgroundBuilding={backgroundBuilding}
              buildProgress={buildProgress}
              buildMessage={buildMessage}
              onDismissPair={dismissPair}
            />
          ) : (
            <InsightTopicView
              clusters={clusters}
              nodeMap={nodeMap}
              filter={filter}
              search={search}
              building={building || backgroundBuilding}
              buildMessage={buildMessage}
            />
          )}

          {overview && (
            <div className="soul-card">
              <button
                type="button"
                onClick={() => setBooksOpen((v) => !v)}
                className="flex w-full items-center justify-between text-left"
              >
                <span className="text-sm font-medium text-soul-cream">
                  书籍关联总览
                </span>
                <span className="text-[11px] soul-card-sub">
                  {booksOpen ? "收起" : "展开"}
                </span>
              </button>
              {booksOpen && (
                <div className="mt-3 p-1">
                  <p className="mb-2 px-1 text-[11px] soul-card-sub">
                    节点 = 书籍 · 连线 = 跨书观点关联
                  </p>
                  <BookOverviewChart
                    overview={overview}
                    selectedBookIds={selectedBookIds}
                    onSelectBook={(id) => toggleBook(id)}
                  />
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatChip({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "jade" | "amber";
}) {
  const cls =
    tone === "jade"
      ? "border-soul-jade/25 bg-soul-jade/10 text-soul-jade"
      : tone === "amber"
      ? "border-soul-amber/25 bg-soul-amber/10 text-soul-amber"
      : "border-white/10 bg-white/[0.03] text-white/55";
  return (
    <span className={`rounded-md border px-2 py-0.5 ${cls}`}>
      {label} {value}
    </span>
  );
}
